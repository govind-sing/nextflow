import { task } from '@trigger.dev/sdk/v3';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

// Set binary paths once at module load time
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export interface ExtractFramePayload {
  nodeExecutionId: string;
  videoUrl: string;
  timestamp: string; // e.g. "5" (seconds) or "50%" (percentage)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const getVideoDuration = (filePath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });

const resolveTimestamp = async (filePath: string, ts: string): Promise<number> => {
  if (ts.endsWith('%')) {
    const percent = parseFloat(ts) / 100;
    const duration = await getVideoDuration(filePath);
    return duration * percent;
  }
  return parseFloat(ts) || 0;
};

const extractFrame = (inputPath: string, outputPath: string, seekTime: number): Promise<void> =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [seekTime],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x?',
      })
      .on('end', () => resolve())
      .on('error', reject);
  });

const uploadToTransloadit = async (filePath: string): Promise<string> => {
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();

  formData.append(
    'params',
    JSON.stringify({
      auth: { key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY },
      steps: { ':original': { robot: '/upload/handle' } },
    })
  );

  formData.append(
    'file',
    new Blob([fileBuffer], { type: 'image/jpeg' }),
    path.basename(filePath)
  );

  const res = await fetch('https://api2.transloadit.com/assemblies', {
    method: 'POST',
    body: formData,
  });
  const result = await res.json();

  if (!result.assembly_ssl_url) {
    throw new Error(`Transloadit assembly creation failed: ${JSON.stringify(result)}`);
  }

  // Poll until complete
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const poll = await fetch(result.assembly_ssl_url);
      const data = await poll.json();

      console.log(
        `[ExtractFrame] Transloadit poll ${i}: status=${data.ok}, ` +
        `uploads=${data.uploads?.length ?? 0}, results=${Object.keys(data.results ?? {}).length}`
      );

      if (data.ok === 'ASSEMBLY_COMPLETED') {
        // Check in order of likelihood
        const url =
          data.uploads?.[0]?.ssl_url ??
          data.results?.[':original']?.[0]?.ssl_url ??
          data.results?.uploaded?.[0]?.ssl_url ??
          (Object.values(data.results ?? {}).flat() as any[])[0]?.ssl_url;

        if (url) return url;

        throw new Error(
          `Assembly completed but no URL found. ` +
          `uploads=${data.uploads?.length ?? 0}, results=${Object.keys(data.results ?? {}).length}`
        );
      }

      if (data.error) throw new Error(`Transloadit error: ${data.error}`);
      // ASSEMBLY_UPLOADING / ASSEMBLY_EXECUTING → keep polling
    } catch (pollErr) {
      console.error(`[ExtractFrame] Poll error at iteration ${i}:`, pollErr);
      if (i > 10) throw pollErr;
    }
  }

  throw new Error('Transloadit upload timed out after 90 seconds');
};

// ─── Task ───────────────────────────────────────────────────────────────────

export const extractFrameTask = task({
  id: 'extract-frame',

  run: async (payload: ExtractFramePayload) => {
    const { nodeExecutionId, videoUrl, timestamp = '0' } = payload;

    if (!videoUrl?.trim()) {
      throw new Error('videoUrl is required and cannot be empty');
    }

    await prisma.nodeExecution.update({
      where: { id: nodeExecutionId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const startTime = Date.now();
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `video-${nodeExecutionId}.mp4`);
    const outputPath = path.join(tmpDir, `frame-${nodeExecutionId}.jpg`);

    try {
      // 1. Download video
      const videoRes = await fetch(videoUrl);
      const buffer = Buffer.from(await videoRes.arrayBuffer());
      fs.writeFileSync(inputPath, buffer);

      // 2. Resolve timestamp
      const seekTime = await resolveTimestamp(inputPath, timestamp);
      console.log(`[ExtractFrame] Extracting frame at ${seekTime}s`);

      // 3. Extract frame
      await extractFrame(inputPath, outputPath, seekTime);

      // 4. Upload to Transloadit
      const outputUrl = await uploadToTransloadit(outputPath);

      // 5. Cleanup
      fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      await prisma.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status: 'SUCCESS',
          outputData: { imageUrl: outputUrl },
          duration,
          completedAt: new Date(),
        },
      });

      return { success: true, outputUrl, duration };
    } catch (error) {
      const err = error as Error;

      // Cleanup on failure too
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      await prisma.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status: 'FAILED',
          error: err.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  },
});