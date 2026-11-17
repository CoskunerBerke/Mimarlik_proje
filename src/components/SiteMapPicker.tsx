import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SiteMapPickerProps {
  lat: number;
  lng: number;
  onPickCoordinate?: (lat: number, lng: number) => void;
  heightClass?: string;
  interactivePick?: boolean;
  defaultLayer?: 'satellite' | 'street';
}

export const SiteMapPicker: React.FC<SiteMapPickerProps> = ({
  lat,
  lng,
  onPickCoordinate,
  heightClass = 'h-80',
  interactivePick = true,
  defaultLayer = 'satellite',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satLayerRef = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPickCoordinate);
  const internalPickRef = useRef(false);

  const [layerMode, setLayerMode] = useState<'satellite' | 'street'>(defaultLayer);
  const [imageryMeta, setImageryMeta] = useState<string | null>(null);

  onPickRef.current = onPickCoordinate;

  // Seçilen koordinattaki uydu görüntüsünün gerçek çekim tarihini ve çözünürlüğünü sorgula
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const url = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify?geometry=${lng.toFixed(
          5
        )},${lat.toFixed(
          5
        )}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=1&mapExtent=${(
          lng - 0.01
        ).toFixed(4)},${(lat - 0.01).toFixed(4)},${(lng + 0.01).toFixed(4)},${(
          lat + 0.01
        ).toFixed(4)}&imageDisplay=800,600,96&returnGeometry=false&f=json`;
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const hit = Array.isArray(data?.results)
          ? data.results.find(
              (r: { attributes?: Record<string, unknown> }) =>
                r.attributes?.['DATE (YYYYMMDD)'] || r.attributes?.SRC_DATE
            )
          : null;
        if (hit?.attributes && !cancelled) {
          const rawDate = String(
            hit.attributes['DATE (YYYYMMDD)'] || hit.attributes.SRC_DATE || ''
          );
          const rawRes = Number(
            hit.attributes['RESOLUTION (M)'] || hit.attributes.SRC_RES || 0
          );
          if (/^\d{8}$/.test(rawDate)) {
            const formatted = `${rawDate.slice(6, 8)}.${rawDate.slice(4, 6)}.${rawDate.slice(
              0,
              4
            )}`;
            const resText = rawRes > 0 ? ` · ${rawRes.toFixed(2)}m çözünürlük` : '';
            setImageryMeta(`Uydu Çekim Tarihi: ${formatted}${resText}`);
          }
        }
      } catch {
        // Metadata alınamazsa sessizce geç
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [lat, lng]);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapInstanceRef.current) return;

    const initialZoom = interactivePick ? 16 : 17;
    const map = L.map(el, {
      center: [lat, lng],
      zoom: initialZoom,
      scrollWheelZoom: true,
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    });

    const satImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri — Uydu Görünümü',
        maxZoom: 19,
      }
    );
    const satLabels = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        opacity: 0.9,
      }
    );
    const satGroup = L.layerGroup([satImagery, satLabels]);

    streetLayerRef.current = streetLayer;
    satLayerRef.current = satGroup;

    if (defaultLayer === 'satellite') {
      satGroup.addTo(map);
    } else {
      streetLayer.addTo(map);
    }

    // Hassas hedef artılı pin ikonu
    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="width:22px;height:22px;background:#C85A17;border:3px solid #FFFFFF;border-radius:9999px;box-shadow:0 2px 10px rgba(0,0,0,0.55);"></div>
        <div style="position:absolute;width:4px;height:4px;background:#FFFFFF;border-radius:9999px;"></div>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([lat, lng], {
      icon: pinIcon,
      draggable: interactivePick,
    }).addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    if (interactivePick) {
      map.on('click', (ev: L.LeafletMouseEvent) => {
        const nextLat = Number(ev.latlng.lat.toFixed(6));
        const nextLng = Number(ev.latlng.lng.toFixed(6));
        internalPickRef.current = true;
        marker.setLatLng([nextLat, nextLng]);
        onPickRef.current?.(nextLat, nextLng);
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const nextLat = Number(pos.lat.toFixed(6));
        const nextLng = Number(pos.lng.toFixed(6));
        internalPickRef.current = true;
        onPickRef.current?.(nextLat, nextLng);
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

  // Katman değişimi (Uydu <-> Sokak Haritası)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const street = streetLayerRef.current;
    const sat = satLayerRef.current;
    if (!map || !street || !sat) return;

    if (layerMode === 'satellite') {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(sat)) sat.addTo(map);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (!map.hasLayer(street)) street.addTo(map);
    }
  }, [layerMode]);

  // Koordinat dışarıdan (arama/öneri seçimi ile) güncellendiğinde tam parsele yakınlaş
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);

    if (internalPickRef.current) {
      internalPickRef.current = false;
      return;
    }

    map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, [lat, lng]);

  return (
    <div className="relative w-full border border-stone-300 overflow-hidden bg-stone-100">
      {/* Üst Katman Seçici Çubuk (Mobil & Masaüstü Uyumlu) */}
      <div className="bg-[#FAF9F6] border-b border-stone-200 px-2.5 sm:px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLayerMode('satellite')}
            className={`px-2.5 py-1.5 font-semibold border transition whitespace-nowrap ${
              layerMode === 'satellite'
                ? 'bg-[#181816] text-white border-[#181816]'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            <span className="sm:hidden">Uydu (Parsel)</span>
            <span className="hidden sm:inline">Uydu Görünümü (Tam Parsel & Çatılar)</span>
          </button>
          <button
            type="button"
            onClick={() => setLayerMode('street')}
            className={`px-2.5 py-1.5 font-semibold border transition whitespace-nowrap ${
              layerMode === 'street'
                ? 'bg-[#181816] text-white border-[#181816]'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            <span className="sm:hidden">Sokak</span>
            <span className="hidden sm:inline">Sokak & Mahalle Haritası</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {layerMode === 'satellite' && imageryMeta && (
            <span className="font-semibold text-[#15803D]">{imageryMeta}</span>
          )}
          <span className="font-mono font-semibold text-[#181816]">
            {lat.toFixed(5)}°K, {lng.toFixed(5)}°D
          </span>
        </div>
      </div>

      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0 cursor-crosshair`} />

      {interactivePick && (
        <div className="bg-white/95 border-t border-stone-200 px-3 py-2 text-xs text-stone-700 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Tam Arsa Kilidi:</strong> Uydu görüntüsünde arsanızın üzerine dokunun / tıklayın
            veya turuncu pini sürükleyin; seçtiğiniz nokta milimetrik olarak korunur.
          </span>
        </div>
      )}
    </div>
  );
};
