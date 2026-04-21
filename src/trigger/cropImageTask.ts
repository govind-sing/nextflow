import { task }    from '@trigger.dev/sdk/v3';
import { prisma }  from '@/lib/prisma';
import * as fs     from 'fs';
import * as path   from 'path';
import * as os     from 'os';

export interface CropImagePayload {
  nodeExecutionId: string;
  imageUrl:        string;
  xPercent:        number;  // 0-100
  yPercent:        number;
  widthPercent:    number;
  heightPercent:   number;
}

export const cropImageTask = task({
  id: 'crop-image',

  run: async (payload: CropImagePayload) => {
    // ✅ Dynamic import inside run function
    const ffmpeg      = (await import('fluent-ffmpeg')).default;
    const ffmpegPath  = (await import('@ffmpeg-installer/ffmpeg')).default;
    const ffprobePath = (await import('@ffprobe-installer/ffprobe')).default;

    // Set BOTH paths
    ffmpeg.setFfmpegPath(ffmpegPath.path);
    ffmpeg.setFfprobePath(ffprobePath.path);  // ← this was missing

    const {
      nodeExecutionId,
      imageUrl,
      xPercent     = 0,
      yPercent     = 0,
      widthPercent = 100,
      heightPercent = 100,
    } = payload;

    // Validate imageUrl
    if (!imageUrl || imageUrl.trim() === '') {
      throw new Error('imageUrl is required and cannot be empty');
    }

    // Mark as running
    await prisma.nodeExecution.update({
      where: { id: nodeExecutionId },
      data:  { status: 'RUNNING', startedAt: new Date() },
    });

    const startTime = Date.now();

    try {
      // Step 1: Download image to temp directory
      const tmpDir    = os.tmpdir();
      const inputPath = path.join(tmpDir, `input-${nodeExecutionId}.jpg`);
      const outputPath = path.join(tmpDir, `output-${nodeExecutionId}.jpg`);

      const imageRes = await fetch(imageUrl);
      const buffer   = Buffer.from(await imageRes.arrayBuffer());
      fs.writeFileSync(inputPath, buffer);

      // Helper: get image dimensions via ffprobe
      const getImageDimensions = (filePath: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
            if (err) return reject(err);
            const stream = metadata.streams.find((s: any) => s.width && s.height);
            if (!stream) return reject(new Error('No video stream found'));
            resolve({ width: stream.width!, height: stream.height! });
          });
        });
      };

      // Step 2: Get image dimensions using ffprobe
      const dimensions = await getImageDimensions(inputPath);
      const { width: imgW, height: imgH } = dimensions;

      // Step 3: Convert percentages to pixels
      const x = Math.floor((xPercent / 100) * imgW);
      const y = Math.floor((yPercent / 100) * imgH);
      const w = Math.floor((widthPercent / 100) * imgW);
      const h = Math.floor((heightPercent / 100) * imgH);

      // Step 4: Run FFmpeg crop
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilter(`crop=${w}:${h}:${x}:${y}`)
          .output(outputPath)
          .on('end',   () => resolve())
          .on('error', reject)
          .run();
      });

      // Step 5: Upload result to Transloadit
      const uploadToTransloadit = async (filePath: string): Promise<string> => {
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

            console.log(`[Crop] Transloadit poll ${i}: status=${data.ok}, results=${Object.keys(data.results || {}).length} items`);

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
            console.error(`[Crop] Poll error at iteration ${i}:`, pollErr);
            if (i > 10) throw pollErr;  // After several retries, give up on network errors
          }
        }

        throw new Error('Transloadit upload timed out after 90 seconds');
      };

      const outputUrl = await uploadToTransloadit(outputPath);

      // Cleanup temp files
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      // Step 6: Save result to DB
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
