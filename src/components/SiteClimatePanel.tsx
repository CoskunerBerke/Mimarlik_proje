import React, { useState } from 'react';
import {
  CityClimateProfile,
  NeighborContextBlock,
  SeasonKey,
  SiteParameters,
} from '../types/architecture';
import { CITIES } from '../data/cities';
import {
  doyToTurkishDate,
  getSeasonalSolarSummary,
} from '../engine/solarEngine';
import {
  fetchLiveClimateProfile,
  GeocodingResult,
  searchLocationByName,
} from '../engine/climateApi';
import { Loader2, MapPin, Search, Sun, Thermometer, Wind } from 'lucide-react';

interface SiteClimatePanelProps {
  city: CityClimateProfile;
  onSelectCity: (c: CityClimateProfile) => void;
  season: SeasonKey;
  onSelectSeason: (s: SeasonKey) => void;
  dayOfYear: number;
  onChangeDayOfYear: (d: number) => void;
  site: SiteParameters;
  onChangeSite: (s: SiteParameters) => void;
  neighbors: NeighborContextBlock[];
  onChangeNeighbors: (n: NeighborContextBlock[]) => void;
}

export const SiteClimatePanel: React.FC<SiteClimatePanelProps> = ({
  city,
  onSelectCity,
  season,
  dayOfYear,
  onChangeDayOfYear,
  site,
  onChangeSite,
  neighbors,
  onChangeNeighbors,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const seasonData = city.seasons[season];
  const solarSummary = getSeasonalSolarSummary(
    city.lat,
    season,
    seasonData.directRadiationWm2,
    seasonData.diffuseRadiationWm2
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingLive(true);
    setLiveError(null);
    try {
      const res = await searchLocationByName(searchQuery);
      setSearchResults(res);
      if (res.length === 0) {
        setLiveError('Eşleşen yerleşim bulunamadı.');
      }
    } catch {
      setLiveError('Arama servisine ulaşılamadı, hazır şehir profillerini kullanabilirsiniz.');
    } finally {
      setLoadingLive(false);
    }
  };

  const handlePickGeoResult = async (item: GeocodingResult) => {
    setLoadingLive(true);
    setLiveError(null);
    try {
      const liveProfile = await fetchLiveClimateProfile(
        item.name,
        item.admin1 || '',
        item.country,
        item.latitude,
        item.longitude,
        item.elevation ?? 100
      );
      onSelectCity(liveProfile);
      setSearchResults([]);
      setSearchQuery('');
    } catch {
      setLiveError('ERA5 canlı iklim verisi çekilemedi.');
    } finally {
      setLoadingLive(false);
    }
  };

  // SVG Rüzgar Gülü için yön vektörü
  const windRad = ((seasonData.windDirectionDeg - 90) * Math.PI) / 180;
  const wx = 60 + Math.cos(windRad) * 38;
  const wy = 60 + Math.sin(windRad) * 38;

  return (
    <div className="space-y-5 text-xs">
      {/* 01.1 Konum Seçimi & Canlı ERA5 İklim Sorgusu */}
      <section className="space-y-2.5 border-b border-[#E2E0D8] pb-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            01.1 Lokasyon & İklim Kuşağı
          </span>
          <span className="font-mono text-[11px] text-[#161615] font-semibold">
            Köppen: {city.koppen}
          </span>
        </div>

        <label className="block text-[11px] font-medium text-stone-700">
          Hazır Türkiye İklim İstasyonları
        </label>
        <select
          value={CITIES.some((c) => c.id === city.id) ? city.id : 'custom'}
          onChange={(e) => {
            const found = CITIES.find((c) => c.id === e.target.value);
            if (found) onSelectCity(found);
          }}
          className="w-full bg-white border border-[#CFCBC0] px-2.5 py-2 text-xs font-medium text-[#161615] focus:outline-none focus:border-[#161615]"
        >
          {!CITIES.some((c) => c.id === city.id) && (
            <option value="custom">
              {city.name} ({city.lat.toFixed(2)}°, {city.lng.toFixed(2)}° - Canlı ERA5)
            </option>
          )}
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — TS 825 Bölge {c.ts825Zone} ({c.koppen})
            </option>
          ))}
        </select>

        {/* Herhangi bir il/ilçe canlı meteoroloji arama */}
        <form onSubmit={handleSearch} className="flex gap-1.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Başka şehir/ilçe ara (ör. Çanakkale, Mardin, Van)..."
              className="w-full pl-8 pr-2 py-1.5 bg-[#F8F7F3] border border-[#D4D1C7] text-xs focus:outline-none focus:bg-white focus:border-[#161615]"
            />
          </div>
          <button
            type="submit"
            disabled={loadingLive}
            className="px-3 py-1.5 bg-[#161615] text-white font-medium hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
          >
            {loadingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            Canlı Veri
          </button>
        </form>

        {liveError && <div className="text-[11px] text-red-700">{liveError}</div>}

        {searchResults.length > 0 && (
          <div className="border border-[#D0CDC2] bg-white divide-y divide-[#ECEAE2]">
            {searchResults.map((r, idx) => (
              <button
                key={`${r.latitude}_${r.longitude}_${idx}`}
                onClick={() => handlePickGeoResult(r)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-stone-100 flex items-center justify-between"
              >
                <span className="font-medium text-[#161615]">
                  {r.name} {r.admin1 ? `(${r.admin1})` : ''} — {r.country}
                </span>
                <span className="font-mono text-[10px] text-stone-500">
                  {r.latitude.toFixed(2)}°K, {r.longitude.toFixed(2)}°D
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2.5 space-y-1">
          <div className="font-semibold text-[#161615]">{city.koppenDesc}</div>
          <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-stone-600">
            <div>Enlem: {city.lat.toFixed(2)}°</div>
            <div>Rakım: {city.elevationM} m</div>
            <div>Kar: {city.annualSnowLoadKnM2} kN/m²</div>
          </div>
        </div>
      </section>

      {/* 01.2 Mevsimsel Sıcaklık, Güneş ve Rüzgar Gülü Analizi */}
      <section className="space-y-3 border-b border-[#E2E0D8] pb-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            01.2 Mevsimsel Arazi & Rüzgar Analizi
          </span>
          <span className="font-mono text-[11px] text-stone-600">
            Gün #{dayOfYear} ({doyToTurkishDate(dayOfYear)})
          </span>
        </div>

        <div>
          <label className="flex justify-between text-[11px] text-stone-600 mb-1">
            <span>Yılın Günü (Güneş Deklinasyon Ayarı)</span>
            <span className="font-mono font-semibold text-[#161615]">
              {doyToTurkishDate(dayOfYear)}
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={365}
            value={dayOfYear}
            onChange={(e) => onChangeDayOfYear(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* İklim Metrikleri + SVG Rüzgar Gülü */}
        <div className="grid grid-cols-12 gap-2.5 items-center">
          <div className="col-span-7 grid grid-cols-2 gap-1.5">
            <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
              <div className="text-[10px] text-stone-500 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-[#C85A17]" /> Ort. Sıcaklık
              </div>
              <div className="font-mono text-sm font-bold text-[#161615] mt-0.5">
                {seasonData.avgTempC}°C
              </div>
              <div className="font-mono text-[10px] text-stone-500">
                {seasonData.minTempC}° / {seasonData.maxTempC}°C
              </div>
            </div>

            <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
              <div className="text-[10px] text-stone-500 flex items-center gap-1">
                <Wind className="w-3 h-3 text-sky-700" /> Hakim Rüzgar
              </div>
              <div className="font-mono text-sm font-bold text-[#161615] mt-0.5">
                {seasonData.windSpeedMs} m/s
              </div>
              <div className="text-[10px] text-stone-600 truncate">{seasonData.windLabel}</div>
            </div>

            <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
              <div className="text-[10px] text-stone-500 flex items-center gap-1">
                <Sun className="w-3 h-3 text-amber-600" /> Dik Işınım
              </div>
              <div className="font-mono text-sm font-bold text-[#161615] mt-0.5">
                {seasonData.directRadiationWm2} <span className="text-[10px] font-normal">W/m²</span>
              </div>
              <div className="font-mono text-[10px] text-stone-500">
                Yayılı: {seasonData.diffuseRadiationWm2} W/m²
              </div>
            </div>

            <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
              <div className="text-[10px] text-stone-500">Nem & Yağış</div>
              <div className="font-mono text-sm font-bold text-[#161615] mt-0.5">
                %{seasonData.humidityPct}
              </div>
              <div className="font-mono text-[10px] text-stone-500">
                {seasonData.precipitationMm} mm/mevsim
              </div>
            </div>
          </div>

          {/* Polar Rüzgar Gülü SVG */}
          <div className="col-span-5 bg-[#F8F7F3] border border-[#E2E0D8] p-2 flex flex-col items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-24 h-24">
              <circle cx="60" cy="60" r="44" fill="#FFFFFF" stroke="#D4D1C7" strokeWidth="1" />
              <circle
                cx="60"
                cy="60"
                r="26"
                fill="none"
                stroke="#E5E3DC"
                strokeDasharray="2 2"
              />
              <line x1="60" y1="12" x2="60" y2="108" stroke="#E5E3DC" />
              <line x1="12" y1="60" x2="108" y2="60" stroke="#E5E3DC" />
              <text x="60" y="10" textAnchor="middle" fontSize="9" fontWeight="700" fill="#161615">
                K
              </text>
              <text x="60" y="117" textAnchor="middle" fontSize="9" fontWeight="700" fill="#C85A17">
                G
              </text>
              <text x="113" y="63" textAnchor="middle" fontSize="9" fill="#57534E">
                D
              </text>
              <text x="7" y="63" textAnchor="middle" fontSize="9" fill="#57534E">
                B
              </text>

              {/* Diğer mevsimlerin soluk vektörleri */}
              {(['spring', 'summer', 'autumn', 'winter'] as SeasonKey[]).map((sk) => {
                const st = city.seasons[sk];
                const rad = ((st.windDirectionDeg - 90) * Math.PI) / 180;
                const rLen = Math.min(40, st.windSpeedMs * 7.2);
                return (
                  <line
                    key={sk}
                    x1="60"
                    y1="60"
                    x2={60 + Math.cos(rad) * rLen}
                    y2={60 + Math.sin(rad) * rLen}
                    stroke={sk === season ? '#0284C7' : '#CBD5E1'}
                    strokeWidth={sk === season ? '3' : '1.5'}
                  />
                );
              })}

              {/* Aktif mevsim rüzgar kaynağı noktası */}
              <circle cx={wx} cy={wy} r="4.5" fill="#0284C7" />
              <circle cx="60" cy="60" r="2.5" fill="#161615" />
            </svg>
            <span className="font-mono text-[10px] text-stone-600 mt-0.5">
              Azimut: {seasonData.windDirectionDeg}°
            </span>
          </div>
        </div>

        {/* Cephelere Göre Günlük Güneş Işınımı Yükü */}
        <div className="bg-white border border-[#E2E0D8] p-2.5 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="font-semibold text-[#161615]">
              Cephe Günlük Güneşlenme Yükü (kWh/m²·gün)
            </span>
            <span className="font-mono text-stone-500">
              Öğle Maks: {solarSummary.summerNoonAltDeg}° Yaz / {solarSummary.winterNoonAltDeg}° Kış
            </span>
          </div>
          {[
            { label: 'Güney Cephe', val: solarSummary.facadeDailyKwhM2.south, color: 'bg-[#C85A17]' },
            { label: 'Doğu Cephe', val: solarSummary.facadeDailyKwhM2.east, color: 'bg-amber-500' },
            { label: 'Batı Cephe', val: solarSummary.facadeDailyKwhM2.west, color: 'bg-orange-500' },
            { label: 'Kuzey Cephe', val: solarSummary.facadeDailyKwhM2.north, color: 'bg-sky-600' },
            { label: 'Yatay Çatı', val: solarSummary.facadeDailyKwhM2.horizontal, color: 'bg-stone-800' },
          ].map((row) => (
            <div key={row.label} className="grid grid-cols-12 items-center gap-2 text-[11px]">
              <span className="col-span-4 text-stone-600">{row.label}</span>
              <div className="col-span-6 h-2 bg-stone-200 overflow-hidden">
                <div
                  className={`h-full ${row.color}`}
                  style={{ width: `${Math.min(100, (row.val / 8.5) * 100)}%` }}
                />
              </div>
              <span className="col-span-2 font-mono text-right text-[#161615]">{row.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 01.3 Arsa Boyutları & Komşu Gölgeleme Bağlamı */}
      <section className="space-y-2.5 border-b border-[#E2E0D8] pb-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500 block">
          01.3 Arsa Geometrisi & Komşu Kütle Gölgesi
        </span>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-1">
              <span>Arsa Genişliği (D-B)</span>
              <span className="font-mono font-semibold">{site.parcelWidthM} m</span>
            </label>
            <input
              type="range"
              min={35}
              max={130}
              step={5}
              value={site.parcelWidthM}
              onChange={(e) =>
                onChangeSite({ ...site, parcelWidthM: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-1">
              <span>Arsa Derinliği (K-G)</span>
              <span className="font-mono font-semibold">{site.parcelDepthM} m</span>
            </label>
            <input
              type="range"
              min={35}
              max={130}
              step={5}
              value={site.parcelDepthM}
              onChange={(e) =>
                onChangeSite({ ...site, parcelDepthM: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-medium text-stone-700">
            Çevre Komşu Yapılar (Gölge & Rüzgar Perdesi)
          </div>
          {neighbors.map((nb, idx) => (
            <div
              key={nb.id}
              className="flex items-center justify-between gap-2 bg-[#F8F7F3] border border-[#E2E0D8] px-2.5 py-1.5"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nb.enabled}
                  onChange={(e) => {
                    const next = [...neighbors];
                    next[idx] = { ...nb, enabled: e.target.checked };
                    onChangeNeighbors(next);
                  }}
                  className="accent-[#161615]"
                />
                <span className="font-medium text-[#161615]">{nb.label}</span>
              </label>
              {nb.enabled && (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-stone-500">Yükseklik:</span>
                  <input
                    type="number"
                    min={4}
                    max={55}
                    value={nb.heightM}
                    onChange={(e) => {
                      const next = [...neighbors];
                      next[idx] = { ...nb, heightM: Math.max(3, Number(e.target.value)) };
                      onChangeNeighbors(next);
                    }}
                    className="w-12 border border-[#D0CDC2] bg-white px-1 py-0.5 text-right"
                  />
                  <span>m</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 01.4 Pasif İklimsel Tasarım İlkeleri */}
      <section className="space-y-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500 block">
          01.4 {city.name} İçin Biyoklimatik Tasarım İlkeleri
        </span>
        <ul className="space-y-1.5">
          {city.passiveStrategies.map((st, i) => (
            <li
              key={i}
              className="flex items-start gap-2 bg-[#F8F7F3] border-l-2 border-[#161615] px-2.5 py-1.5 text-[11px] text-stone-700"
            >
              <span className="font-mono text-[10px] font-bold text-[#161615] mt-0.5">
                0{i + 1}
              </span>
              <span>{st}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
