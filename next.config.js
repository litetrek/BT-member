/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Static help pages in public/<name>/index.html get a clean URL (/<name>).
  async rewrites() {
    return [
      { source: '/lantern-guide', destination: '/lantern-guide/index.html' },
    ]
  },
}

module.exports = nextConfig
