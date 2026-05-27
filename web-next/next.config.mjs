/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiUrl = (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      'https://jarvis-ai-production.up.railway.app'
    ).trim();
    console.log('[Next.js Rewrites] Proxy API_URL =', apiUrl);
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${apiUrl}/health`,
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  poweredByHeader: false,
};

export default nextConfig;
