import React, { useState } from 'react';
import {
  CityClimateProfile,
  NeighborContextBlock,
  SeasonKey,
  SiteParameters,
} from '../types/architecture';
import { CITIES } from '../data/cities';
import { getSeasonalSolarSummary } from '../engine/solarEngine';
import {
  fetchLiveClimateProfile,
  GeocodingResult,
  searchLocationByName,
} from '../engine/climateApi';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Droplets,
  Loader2,
  MapPin,
  Search,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';

interface SiteClimatePanelProps {
  city: CityClimateProfile;
  onSelectCity: (c: CityClimateProfile) => void;
  season: SeasonKey;
  site: SiteParameters;
  onChangeSite: (s: SiteParameters) => void;
  neighbors: NeighborContextBlock[];
  onChangeNeighbors: (n: NeighborContextBlock[]) => void;
  onNextStep: () => void;
}

const SEASON_TR: Record<SeasonKey, string> = {
  spring: 'İlkbahar',
  summer: 'Yaz',
  autumn: 'Sonbahar',
  winter: 'Kış',
};

export const SiteClimatePanel: React.FC<SiteClimatePanelProps> = ({
  city,
  onSelectCity,
  season,
  site,
  onChangeSite,
  neighbors,
  onChangeNeighbors,
  onNextStep,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [showSiteAdvanced, setShowSiteAdvanced] = useState(false);

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
      if (res.length === 0) setLiveError('Şehir bulunamadı.');
    } catch {
      setLiveError('Bağlantı kurulamadı, listedeki şehirleri seçebilirsiniz.');
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
      setLiveError('İklim verisi alınamadı.');
    } finally {
      setLoadingLive(false);
    }
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Başlık ve Rehber Açıklama */}
      <div>
        <h2 className="text-base font-bold text-[#161615]">
          1. Arsa Konumu ve Mevsim İklimi
        </h2>
        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
          Binayı yapacağınız şehri seçin. Üst menüden mevsimi ve saati değiştirerek güneşin ve
          rüzgarın araziye nasıl vurduğunu sol tarafta canlı izleyebilirsiniz.
        </p>
      </div>

      {/* Şehir Seçimi */}
      <div className="space-y-2.5">
        <label className="block text-xs font-semibold text-stone-800">
          Şehir Seçin
        </label>
        <select
          value={CITIES.some((c) => c.id === city.id) ? city.id : 'custom'}
          onChange={(e) => {
            const found = CITIES.find((c) => c.id === e.target.value);
            if (found) onSelectCity(found);
          }}
          className="w-full bg-white border border-stone-300 px-3 py-2.5 text-sm font-semibold text-[#161615] focus:outline-none focus:border-[#161615]"
        >
          {!CITIES.some((c) => c.id === city.id) && (
            <option value="custom">{city.name} (Canlı İklim Verisi)</option>
          )}
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.region}
            </option>
          ))}
        </select>

        {/* Başka Şehir Arama */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Listede yoksa şehir/ilçe yazın (ör. Çanakkale, Mardin)..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8F7F3] border border-stone-300 text-xs focus:outline-none focus:bg-white focus:border-[#161615]"
            />
          </div>
          <button
            type="submit"
            disabled={loadingLive}
            className="px-3 py-2 bg-stone-800 text-white text-xs font-semibold hover:bg-black disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
          >
            {loadingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            Bul
          </button>
        </form>

        {liveError && <div className="text-xs text-red-700">{liveError}</div>}

        {searchResults.length > 0 && (
          <div className="border border-stone-300 bg-white divide-y divide-stone-100">
            {searchResults.map((r, idx) => (
              <button
                key={`${r.latitude}_${r.longitude}_${idx}`}
                onClick={() => handlePickGeoResult(r)}
                className="w-full text-left px-3 py-2 hover:bg-stone-100 flex items-center justify-between text-xs"
              >
                <span className="font-semibold text-[#161615]">
                  {r.name} {r.admin1 ? `(${r.admin1})` : ''} — {r.country}
                </span>
                <span className="text-stone-500">Seç</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Anlaşılır 4'lü Mevsim Özeti */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-800">
            {city.name} — {SEASON_TR[season]} Mevsimi Özeti
          </span>
          <span className="text-xs text-stone-500">{city.koppenDesc}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#F8F7F3] border border-stone-200 p-3">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-[#C85A17]" /> Ortalama Sıcaklık
            </div>
            <div className="text-lg font-bold text-[#161615] mt-1">{seasonData.avgTempC}°C</div>
            <div className="text-xs text-stone-500">
              Gece {seasonData.minTempC}° / Gündüz {seasonData.maxTempC}°C
            </div>
          </div>

          <div className="bg-[#F8F7F3] border border-stone-200 p-3">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-sky-600" /> Hakim Rüzgar
            </div>
            <div className="text-base font-bold text-[#161615] mt-1 truncate">
              {seasonData.windLabel}
            </div>
            <div className="text-xs text-stone-500">Hız: {seasonData.windSpeedMs} m/s</div>
          </div>

          <div className="bg-[#F8F7F3] border border-stone-200 p-3">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" /> Öğle Güneş Açısı
            </div>
            <div className="text-base font-bold text-[#161615] mt-1">
              Yaz {solarSummary.summerNoonAltDeg}° / Kış {solarSummary.winterNoonAltDeg}°
            </div>
            <div className="text-xs text-stone-500">Yazın dik, kışın eğik gelir</div>
          </div>

          <div className="bg-[#F8F7F3] border border-stone-200 p-3">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-teal-600" /> Nem ve Yağış
            </div>
            <div className="text-lg font-bold text-[#161615] mt-1">%{seasonData.humidityPct}</div>
            <div className="text-xs text-stone-500">{seasonData.precipitationMm} mm yağış</div>
          </div>
        </div>
      </div>

      {/* Bu İklimde Nasıl Tasarım Yapılmalı? (Sade Türkçe Maddeler) */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-stone-800">
          Bu İklim İçin Tasarım İpuçları
        </div>
        <div className="space-y-2">
          {city.passiveStrategies.slice(0, 3).map((tip, idx) => (
            <div
              key={idx}
              className="bg-[#F8F7F3] border-l-2 border-[#161615] px-3 py-2 text-xs text-stone-700 leading-relaxed"
            >
              <strong className="text-[#161615] mr-1.5">0{idx + 1}.</strong>
              {tip}
            </div>
          ))}
        </div>
      </div>

      {/* İsteğe Bağlı Açılır Bölüm: Arsa Boyutu & Komşu Binalar */}
      <div className="border border-stone-200 bg-[#FAF9F6]">
        <button
          onClick={() => setShowSiteAdvanced((v) => !v)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
        >
          <span>Arsa Boyutu ve Komşu Bina Gölgesi Ayarları</span>
          {showSiteAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showSiteAdvanced && (
          <div className="p-3.5 pt-1 border-t border-stone-200 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Arsa Genişliği</span>
                  <strong className="text-[#161615]">{site.parcelWidthM} m</strong>
                </label>
                <input
                  type="range"
                  min={40}
                  max={120}
                  step={5}
                  value={site.parcelWidthM}
                  onChange={(e) =>
                    onChangeSite({ ...site, parcelWidthM: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Arsa Derinliği</span>
                  <strong className="text-[#161615]">{site.parcelDepthM} m</strong>
                </label>
                <input
                  type="range"
                  min={40}
                  max={120}
                  step={5}
                  value={site.parcelDepthM}
                  onChange={(e) =>
                    onChangeSite({ ...site, parcelDepthM: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-medium text-stone-700">
                Çevredeki Komşu Binalar (Arsaya Düşen Gölgeyi Görmek İçin Açın)
              </div>
              {neighbors.map((nb, idx) => (
                <div
                  key={nb.id}
                  className="flex items-center justify-between bg-white border border-stone-200 px-2.5 py-1.5"
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
                    <span>{nb.direction} Komşu Bina</span>
                  </label>
                  {nb.enabled && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-500">Yükseklik:</span>
                      <input
                        type="number"
                        min={4}
                        max={50}
                        value={nb.heightM}
                        onChange={(e) => {
                          const next = [...neighbors];
                          next[idx] = { ...nb, heightM: Math.max(3, Number(e.target.value)) };
                          onChangeNeighbors(next);
                        }}
                        className="w-12 border border-stone-300 px-1 py-0.5 text-right"
                      />
                      <span>m</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sonraki Adım Butonu */}
      <button
        onClick={onNextStep}
        className="w-full py-3 bg-[#161615] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
      >
        2. Adıma Geç: Bina Türü ve Avlu/Kütle Önerisi
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
