import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey || !placeId) return NextResponse.json({ photos: [] })

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos,editorialSummary,reviews',
        'Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://bangkok-guide-alpha.vercel.app/',
      },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return NextResponse.json({ photos: [] })
    const data = await res.json()

    const photos = ((data.photos ?? []) as Array<{ name: string }>)
      .slice(0, 6)
      .map((p) => `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`)

    const editorial: string | null = data.editorialSummary?.text ?? null

    const reviewSnippets: string[] = ((data.reviews ?? []) as Array<{ text?: { text: string } }>)
      .slice(0, 3)
      .map((r) => r.text?.text ?? '')
      .filter((t) => t.length > 30 && t.length < 300)

    return NextResponse.json({ photos, editorial, reviewSnippets })
  } catch {
    return NextResponse.json({ photos: [] })
  }
}
