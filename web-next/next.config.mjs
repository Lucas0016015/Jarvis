/**
 * JARVIS Next.js Config — Railway deployment
 * Backend real: https://backend-production-2522d.up.railway.app
 */
const API_BASE = 'https://backend-production-2522d.up.railway.app'

const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_BASE}/api/v1/:path*` },
      { source: '/health', destination: `${API_BASE}/health` },
    ]
  },
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
}

export default nextConfig
