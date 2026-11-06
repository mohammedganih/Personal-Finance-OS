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
    ];
  },
};

export default nextConfig;
