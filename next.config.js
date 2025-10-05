/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
