/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === 'true' || process.env.NEXT_OUTPUT === 'export';
const basePathEnv = process.env.NEXT_BASE_PATH || '';
const assetPrefixEnv = process.env.NEXT_ASSET_PREFIX || basePathEnv || '';

const nextConfig = {
  reactStrictMode: true,
  // Enable static export for GitHub Pages when desired
  ...(isExport ? { output: 'export' } : {}),
  // If deploying under a subpath (e.g., /your-repo), set via env in CI
  ...(basePathEnv ? { basePath: basePathEnv } : {}),
  ...(assetPrefixEnv ? { assetPrefix: assetPrefixEnv } : {}),
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // GeoTIFF 라이브러리의 압축 모듈들이 제대로 번들링되도록 설정
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    
    // GeoTIFF 압축 모듈들을 명시적으로 포함
    config.module.rules.push({
      test: /node_modules\/geotiff\/dist\/module\/compression/,
      use: 'null-loader',
    });
    
    // GeoTIFF를 동적 import로 처리
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('geotiff');
    }
    
    return config;
  },
  // 정적 파일 서빙을 위한 설정
  ...(isExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
              ],
            },
          ];
        },
      }),
};

module.exports = nextConfig;
