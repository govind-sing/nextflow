import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Empty turbopack config silences the webpack warning
  turbopack: {},

  // These packages are server-only, never bundle them
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    '@ffprobe-installer/ffprobe',
    'fluent-ffmpeg',
    '@ffmpeg-installer/darwin-arm64',
    '@ffmpeg-installer/linux-x64',
  ],
};

export default nextConfig;