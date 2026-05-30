'use client'

function extractTikTokId(url: string): string | null {
  return url.match(/\/video\/(\d+)/)?.[1] ?? null
}

function extractInstagramShortcode(url: string): string | null {
  return url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

export function SocialEmbed({ url }: { url: string }) {
  if (url.includes('tiktok.com')) {
    const id = extractTikTokId(url)
    if (!id) return null
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ paddingBottom: '177%' }}>
        <iframe
          src={`https://www.tiktok.com/embed/v2/${id}`}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  if (url.includes('instagram.com')) {
    const code = extractInstagramShortcode(url)
    if (!code) return null
    return (
      <div className="w-full rounded-2xl overflow-hidden">
        <iframe
          src={`https://www.instagram.com/p/${code}/embed/`}
          className="w-full border-0"
          height="480"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  return null
}
