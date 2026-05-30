import Image from 'next/image'
import { IconPin } from './icons/CategoryIcons'
import type { Location, Source } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

const SOURCE_BADGE: Record<Source, { label: keyof typeof strings.zh; style: string }> = {
  tiktok:     { label: 'sourceTikTok',    style: 'bg-green-50 text-green-700 border border-green-200' },
  instagram:  { label: 'sourceIG',        style: 'bg-purple-50 text-purple-700 border border-purple-200' },
  pantip:     { label: 'sourcePantip',    style: 'bg-orange-50 text-orange-700 border border-orange-200' },
  wongnai:    { label: 'sourceWongnai',   style: 'bg-red-50 text-red-700 border border-red-200' },
  googlemaps: { label: 'sourceGoogleMaps',style: 'bg-blue-50 text-blue-700 border border-blue-200' },
  manual:     { label: 'sourceManual',    style: 'bg-gray-50 text-gray-600 border border-gray-200' },
}

type Props = { location: Location; lang: Lang }

export function LocationCard({ location, lang }: Props) {
  const badge = SOURCE_BADGE[location.source]
  const name = lang === 'zh' ? location.name_zh : location.name_en
  const desc = lang === 'zh' ? location.description_zh : location.description_en

  const mapsUrl = location.lat && location.lng
    ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name_en + ' Bangkok')}`

  const rawPhoto = location.photos[0] ?? ''
  const photo = rawPhoto.startsWith('places/')
    ? `https://places.googleapis.com/v1/${rawPhoto}/media?maxWidthPx=800&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : rawPhoto || 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=300&fit=crop'

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative h-24 w-full">
        <Image src={photo} alt={name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
      </div>
      <div className="p-2.5">
        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-lg mb-1 ${badge.style}`}>
          {strings[lang][badge.label] as string}
        </span>
        <h3 className="text-[13px] font-bold text-[#1a1a2e] leading-tight mb-0.5 line-clamp-1">{name}</h3>
        <p className="text-[10px] text-gray-400 mb-1 line-clamp-2">{desc}</p>
        {location.highlights && location.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {location.highlights.map((h) => (
              <span key={h} className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full font-semibold">
                {h}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-500">★ {location.rating.toFixed(1)}</span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-[#1e1b4b] text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-[#2d2a6e] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <IconPin size={11} />
            {strings[lang].navigate as string}
          </a>
        </div>
      </div>
    </div>
  )
}
