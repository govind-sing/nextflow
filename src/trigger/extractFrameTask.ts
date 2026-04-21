import { task }   from '@trigger.dev/sdk/v3';
import { prisma } from '@/lib/prisma';
import * as fs    from 'fs';
import * as path  from 'path';
import * as os    from 'os';

export interface ExtractFramePayload {
  nodeExecutionId: string;
  videoUrl:        string;
  timestamp:       string;  // e.g. "5" (seconds) or "50%" (percentage)
}

export const extractFrameTask = task({
  id: 'extract-frame',

  run: async (payload: ExtractFramePayload) => {
    // ✅ Dynamic import inside run function
    const ffmpeg      = (await import('fluent-ffmpeg')).default;
    const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
    const ffprobeInstaller = await import('@ffprobe-installer/ffprobe');

    // Get the actual binary paths - don't use .default
    const ffmpegBinary = ffmpegInstaller.path;
    const ffprobeBinary = ffprobeInstaller.path;

    if (!ffmpegBinary || !ffprobeBinary) {
      throw new Error(
        `FFmpeg binaries not found. ` +
        `ffmpeg: ${ffmpegBinary}, ffprobe: ${ffprobeBinary}. ` +
        `Please ensure @ffmpeg-installer/ffmpeg and @ffprobe-installer/ffprobe are in dependencies.`
      );
    }

    console.log('[ExtractFrame] FFmpeg paths:', { ffmpegBinary, ffprobeBinary });

    ffmpeg.setFfmpegPath(ffmpegBinary);
    ffmpeg.setFfprobePath(ffprobeBinary);

    const { nodeExecutionId, videoUrl, timestamp = '0' } = payload;

    // Validate videoUrl
    if (!videoUrl || videoUrl.trim() === '') {
      throw new Error('videoUrl is required and cannot be empty');
    }

    await prisma.nodeExecution.update({
      where: { id: nodeExecutionId },
      data:  { status: 'RUNNING', startedAt: new Date() },
    });

    const startTime = Date.now();

    try {
      // Step 1: Download video
      const tmpDir     = os.tmpdir();
      const inputPath  = path.join(tmpDir, `video-${nodeExecutionId}.mp4`);
      const outputPath = path.join(tmpDir, `frame-${nodeExecutionId}.jpg`);

      const videoRes = await fetch(videoUrl);
      const buffer   = Buffer.from(await videoRes.arrayBuffer());
      fs.writeFileSync(inputPath, buffer);

      // Helper: get video duration via ffprobe
      const getVideoDuration = (filePath: string): Promise<number> => {
        return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
            if (err) return reject(err);
            resolve(metadata.format.duration || 0);
          });
        });
      };

      // Helper: resolve timestamp percentage or seconds
      const resolveTimestamp = async (filePath: string, ts: string): Promise<number> => {
        if (ts.endsWith('%')) {
          const percent  = parseFloat(ts) / 100;
          const duration = await getVideoDuration(filePath);
          return duration * percent;
        }
        return parseFloat(ts) || 0;
      };

      // Step 2: Resolve timestamp
      // If "50%" → get video duration → calculate seconds
      const seekTime = await resolveTimestamp(inputPath, timestamp);

      // Step 3: Extract frame with FFmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: [seekTime],
            filename:   path.basename(outputPath),
            folder:     tmpDir,
            size:       '1280x?',   // maintain aspect ratio
          })
          .on('end',   () => resolve())
          .on('error', reject);
      });

      // Step 4: Upload frame to Transloadit
      const uploadFrameToTransloadit = async (filePath: string): Promise<string> => {
        const fileBuffer = fs.readFileSync(filePath);
        const formData   = new FormData();

        formData.append(
          'params',
          JSON.stringify({
            auth:  { key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY },
            steps: { ':original': { robot: '/upload/handle' } },
          })
        );

        formData.append(
          'file',
          new Blob([fileBuffer], { type: 'image/jpeg' }),
          path.basename(filePath)
        );

        const res    = await fetch('https://api2.transloadit.com/assemblies', {
          method: 'POST',
          body:   formData,
        });
        const result = await res.json();

        if (!result.assembly_ssl_url) {
          throw new Error(`Transloadit upload failed: ${JSON.stringify(result)}`);
        }

        // Poll until complete - with longer waits for slow uploads
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 1500));  // Wait 1.5s between polls
          
          try {
            const poll = await fetch(result.assembly_ssl_url);
            const data = await poll.json();

            console.log(`[ExtractFrame] Transloadit poll ${i}: status=${data.ok}, results=${Object.keys(data.results || {}).length} items`);

            if (data.ok === 'ASSEMBLY_COMPLETED') {
              // First check: uploaded files (for simple /upload/handle jobs)
              if (data.uploads?.[0]?.ssl_url) {
                return data.uploads[0].ssl_url;
              }
              
              // Second check: processed results
              if (data.results?.[':original']?.[0]?.ssl_url) {
                return data.results[':original'][0].ssl_url;
              }
              
              // Third check: any uploaded file in results
              if (data.results?.uploaded?.[0]?.ssl_url) {
                return data.results.uploaded[0].ssl_url;
              }
              
              // Fallback: try any available result
              const allResults = Object.values(data.results || {}).flat() as any[];
              if (allResults.length > 0 && allResults[0].ssl_url) {
                return allResults[0].ssl_url;
              }
              
              throw new Error(`No SSL URL found. Uploads: ${data.uploads?.length || 0}, Results: ${Object.keys(data.results || {}).length}`);
            }
            
            if (data.error) throw new Error(`Transloadit error: ${data.error}`);
            if (data.ok === 'ASSEMBLY_UPLOADING' || data.ok === 'ASSEMBLY_EXECUTING') {
              continue;  // Still processing
            }
          } catch (pollErr) {
            console.error(`[ExtractFrame] Poll error at iteration ${i}:`, pollErr);
            if (i > 10) throw pollErr;  // After several retries, give up on network errors
          }
        }

        throw new Error('Transloadit upload timed out after 90 seconds');
      };

      const outputUrl = await uploadFrameToTransloadit(outputPath);

      // Cleanup
      fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      await prisma.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status:      'SUCCESS',
          outputData:  { imageUrl: outputUrl },
          duration,
          completedAt: new Date(),
        },
      });

      return { success: true, outputUrl, duration };

    } catch (error) {
      const err = error as Error;

      await prisma.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status:      'FAILED',
          error:       err.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  },
});
