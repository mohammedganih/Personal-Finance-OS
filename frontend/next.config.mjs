/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // Transactions and Budgets became one Spending page (limits live on it).
  async redirects() {
    return [
      { source: '/transactions', destination: '/spending', permanent: false },
      { source: '/budgets', destination: '/spending', permanent: false },
      // The old Analytics and Reports pages became the Health check.
      { source: '/reports', destination: '/health', permanent: false },
      { source: '/analytics', destination: '/health', permanent: false },
    ];
  },
};

export default nextConfig;
