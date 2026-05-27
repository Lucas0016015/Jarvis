/**
 * JARVIS Next.js Config — Railway deployment
 * NOTA: Railway usa Nixpacks que corre "next start" — NO usar output:standalone
 */
const API_BASE = 'https://jarvis-ai-production.up.railway.app'

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
