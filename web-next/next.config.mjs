/** JARVIS Next.js Config — Railway */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'https://jarvis-ai-production.up.railway.app/api/v1/:path*' },
    ]
  },
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
}
export default nextConfig
