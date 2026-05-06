/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${API_URL}/health`,
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  // Para que funcione en mobile vertical sin cortes
  eslint: {
    dirs: ['src'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;