'use client'
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { useState, useEffect, useRef } from 'react'
import type { Location } from '@/lib/types'
import type { Lang } from '@/lib/i18n'
import { strings } from '@/lib/i18n'

const CATEGORY_COLORS: Record<string, string> = {
  food:      '#dc2626',
  cafe:      '#92400e',
  shopping:  '#065f46',
  nightlife: '#4c1d95',
  hotel:     '#0369a1',
}

type Props = { locations: Location[]; lang: Lang; userLocation?: { lat: number; lng: number } | null }

export function LocationMap({ locations, lang, userLocation: externalLocation }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [internalLocation, setInternalLocation] = useState<{ lat: number; lng: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const selected = locations.find((l) => l.id === selectedId) ?? null
  const userLoc = externalLocation ?? internalLocation

  useEffect(() => {
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setInternalLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  return (
    <APIProvider apiKey={apiKey}>
      <div className="h-44 w-full">
        <Map
          defaultCenter={{ lat: 13.7563, lng: 100.5018 }}
          defaultZoom={12}
          mapId="bangkok-guide-map"
          disableDefaultUI
          gestureHandling="cooperative"
          onClick={() => setSelectedId(null)}
        >
          {locations.map((loc) => {
            const color = CATEGORY_COLORS[loc.category] ?? '#1e1b4b'
            const isSelected = selectedId === loc.id
            return (
              <AdvancedMarker
                key={loc.id}
                position={{ lat: loc.lat, lng: loc.lng }}
                onClick={(e) => { e.stop(); setSelectedId(isSelected ? null : loc.id) }}
              >
                <div
                  className="w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                  style={{ background: color, transform: isSelected ? 'scale(1.25)' : undefined }}
                >
                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              </AdvancedMarker>
            )
          })}

          {userLoc && (
            <AdvancedMarker position={userLoc} zIndex={999}>
              <div className="relative flex items-center justify-center">
                <div className="absolute w-10 h-10 rounded-full bg-blue-400/30 animate-ping" />
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              </div>
            </AdvancedMarker>
          )}

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelectedId(null)}
              pixelOffset={[0, -36]}
            >
              <div className="p-1 max-w-[180px]">
                <p className="font-bold text-sm text-[#1a1a2e] mb-0.5">
                  {lang === 'zh' ? selected.name_zh : selected.name_en}
                </p>
                <p className="text-xs text-gray-500 mb-2">★ {selected.rating.toFixed(1)}</p>
                <a
                  href={selected.source_url?.includes('place_id:')
                    ? selected.source_url
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.name_en + (selected.address ? ' ' + selected.address : ' Bangkok'))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#1e1b4b] underline"
                >
                  {strings[lang].openMaps as string}
                </a>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  )
}
