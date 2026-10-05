/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 地點分享圖（動態 OG）在執行時用 fs 讀資料檔與字型，Next 的自動追蹤沒抓到，
    // 部署到 Vercel 後函式裡沒有這些檔案會直接 500，所以明確指定要打包進去。
    outputFileTracingIncludes: {
      '/location/*/opengraph-image': ['./data/locations.json', './public/fonts/og-openhuninn.woff', './public/fonts/og-noto-thai.woff'],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'places.googleapis.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
