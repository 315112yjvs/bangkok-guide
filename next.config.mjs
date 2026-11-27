/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本機照片檔內容不會變（重抓也是整批換），讓瀏覽器記 30 天，回訪不用每張都重新確認
  async headers() {
    return [{ source: '/photos/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] }]
  },
  experimental: {
    // 地點分享圖（動態 OG）在執行時用 fs 讀資料檔與字型，Next 的自動追蹤沒抓到，
    // 部署到 Vercel 後函式裡沒有這些檔案會直接 500，所以明確指定要打包進去。
    outputFileTracingIncludes: {
      '/location/*/opengraph-image': ['./data/locations.json', './public/fonts/og-openhuninn.woff', './public/fonts/og-noto-thai.woff'],
    },
  },
  images: {
    // Vercel 依螢幕大小縮圖並轉成 AVIF/WebP。照片網址內容不會變（新上傳的檔名都不同），快取一個月
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400,
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
