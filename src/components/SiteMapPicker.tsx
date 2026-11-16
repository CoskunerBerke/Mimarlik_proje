import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SiteMapPickerProps {
  lat: number;
  lng: number;
  onPickCoordinate?: (lat: number, lng: number) => void;
  heightClass?: string;
  interactivePick?: boolean;
}

export const SiteMapPicker: React.FC<SiteMapPickerProps> = ({
  lat,
  lng,
  onPickCoordinate,
  heightClass = 'h-72',
  interactivePick = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapInstanceRef.current) return;

    const map = L.map(el, {
      center: [lat, lng],
      zoom: 13,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap katılımcıları',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;background:#C85A17;border:3px solid #FFFFFF;border-radius:9999px;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    markerRef.current = marker;
    mapInstanceRef.current = map;

    if (interactivePick && onPickCoordinate) {
      map.on('click', (ev: L.LeafletMouseEvent) => {
        const nextLat = Number(ev.latlng.lat.toFixed(5));
        const nextLng = Number(ev.latlng.lng.toFixed(5));
        marker.setLatLng([nextLat, nextLng]);
        onPickCoordinate(nextLat, nextLng);
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }, [lat, lng]);

  return (
    <div className="relative w-full border border-stone-300 overflow-hidden bg-stone-100">
      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0`} />
      {interactivePick && (
        <div className="bg-white/95 border-t border-stone-200 px-3 py-2 text-xs text-stone-600 flex items-center justify-between">
          <span>Haritada arsanızın bulunduğu noktaya tıklayarak tam konumu seçebilirsiniz.</span>
          <span className="font-mono font-semibold text-[#161615]">
            {lat.toFixed(4)}°K, {lng.toFixed(4)}°D
          </span>
        </div>
      )}
    </div>
  );
};
