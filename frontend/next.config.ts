import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // node:sqlite is a Node built-in used by src/lib/db.ts; keep it out of the bundle.
  serverExternalPackages: ['node:sqlite'],
};

export default nextConfig;
