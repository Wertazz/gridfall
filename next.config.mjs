/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // OG images replay the world from a checkpoint read from disk.
    outputFileTracingIncludes: {
      '/t/[iso]/opengraph-image': ['./public/checkpoints/**'],
      '/opengraph-image': ['./public/checkpoints/**'],
      '/t/[iso]': ['./public/checkpoints/**'],
    },
  },
};

export default nextConfig;
