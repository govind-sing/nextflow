import { defineConfig } from '@trigger.dev/sdk/v3';
import { additionalPackages } from '@trigger.dev/build/extensions/core';

export default defineConfig({
  project: 'proj_ywtxnwhsofvjvekvtdrt',  // from trigger.dev dashboard
  build: {
    extensions: [
      additionalPackages({
        packages: ['@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe'],
      }),
    ],
  },
  logLevel: 'log',
  maxDuration: 3600,      // max 1 hour per task
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ['./src/trigger'],   // where your tasks live
});

