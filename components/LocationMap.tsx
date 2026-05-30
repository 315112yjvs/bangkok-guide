'use client'
import { APIProvider, Map, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { useState, useEffect, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
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

type Props = {
  locations: Location[]
  lang: Lang
  userLocation?: { lat: number; lng: number } | null
  nearbyMode?: boolean
}

function MapContent({ locations, lang, userLoc, nearbyMode }: {
  locations: Location[]
  lang: Lang
  userLoc: { lat: number; lng: number } | null
  nearbyMode: boolean
}) {
  const map = useMap()
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = locations.find((l) => l.id === selectedId) ?? null

  // Fit bounds
  useEffect(() => {
    if (!map) return
    if (nearbyMode && userLoc) {
      map.panTo(userLoc)
      map.setZoom(14)
      return
    }
    if (locations.length === 0) return
    if (locations.length === 1) {
      map.panTo({ lat: locations[0].lat, lng: locations[0].lng })
      map.setZoom(15)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    for (const loc of locations) bounds.extend({ lat: loc.lat, lng: loc.lng })
    map.fitBounds(bounds, 40)
  }, [map, locations, userLoc, nearbyMode])

  // Create clustered markers imperatively
  useEffect(() => {
    if (!map) return

    // Clean up old markers
    markersRef.current.forEach((m) => { m.map = null })
    markersRef.current = []
    clustererRef.current?.clearMarkers()

    const newMarkers = locations.map((loc) => {
      const color = CATEGORY_COLORS[loc.category] ?? '#1e1b4b'
      const el = document.createElement('div')
      el.style.cssText = `width:26px;height:26px;border-radius:50%;border:2.5px solid white;background:${color};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center`
      el.innerHTML = `<div style="width:8px;height:8px;background:white;border-radius:50%"></div>`

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: loc.lat, lng: loc.lng },
        content: el,
        map: null,
      })
      marker.addListener('click', () => setSelectedId((prev) => prev === loc.id ? null : loc.id))
      return marker
    })

    markersRef.current = newMarkers

    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({ map, markers: newMarkers })
    } else {
      clustererRef.current.addMarkers(newMarkers)
    }

    return () => {
      newMarkers.forEach((m) => { m.map = null })
      clustererRef.current?.clearMarkers()
    }
  }, [map, locations])

  // User location dot
  useEffect(() => {
    if (!map) return
    if (userMarkerRef.current) { userMarkerRef.current.map = null; userMarkerRef.current = null }
    if (!userLoc) return

    const el = document.createElement('div')
    el.style.cssText = 'position:relative;width:16px;height:16px'
    el.innerHTML = `
      <div style="position:absolute;inset:-12px;border-radius:50%;background:rgba(59,130,246,0.2);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 2px 6px rgba(59,130,246,0.5)"></div>
    `

    userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      position: userLoc,
      content: el,
      map,
      zIndex: 999,
    })
  }, [map, userLoc])

  return (
    <>
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
    </>
  )
}

export function LocationMap({ locations, lang, userLocation: externalLocation, nearbyMode = false }: Props) {
  const [internalLocation, setInternalLocation] = useState<{ lat: number; lng: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
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
    <APIProvider apiKey={apiKey} libraries={['marker']}>
      <div className="h-36 w-full">
        <Map
          defaultCenter={{ lat: 13.7563, lng: 100.5018 }}
          defaultZoom={12}
          mapId="bangkok-guide-map"
          disableDefaultUI
          gestureHandling="cooperative"
        >
          <MapContent locations={locations} lang={lang} userLoc={userLoc} nearbyMode={nearbyMode} />
        </Map>
      </div>
    </APIProvider>
  )
}
