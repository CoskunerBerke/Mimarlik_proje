import React, { useEffect, useMemo, useState } from 'react';
import {
  BuildingFunctionKey,
  CityClimateProfile,
  MassBlock,
  MassTypologyKey,
  MaterialCategoryKey,
  NeighborContextBlock,
  RoofTypeKey,
  SeasonKey,
  SiteParameters,
  TypologyRecommendation,
} from './types/architecture';
import { CITIES } from './data/cities';
import { BUILDING_PROGRAMS } from './data/programs';
import {
  calculateSolarPosition,
  getSeasonalSolarSummary,
  SEASON_REPRESENTATIVE_DOY,
} from './engine/solarEngine';
import {
  fetchLiveClimateProfile,
  GeocodingResult,
  searchLocationByName,
} from './engine/climateApi';
import { generateTypologyRecommendations } from './engine/massingEngine';
import {
  analyzeBlockRoofPerformance,
  recommendOptimalRoofForBlock,
  ROOF_TYPES_META,
} from './engine/roofEngine';
import {
  calculateAssemblySummary,
  evaluateMaterialsForProject,
  getRecommendedMaterialSelection,
  MATERIAL_CATEGORY_LABELS,
} from './engine/materialEngine';
import { Viewport3D } from './components/Viewport3D';
import {
  Box,
  CheckCircle2,
  Compass,
  Download,
  Leaf,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Truck,
  Wind,
} from 'lucide-react';

const INITIAL_SITE: SiteParameters = {
  parcelWidthM: 65,
  parcelDepthM: 55,
  slopeDeg: 2,
  slopeAspect: 'Güney',
  maxTaks: 0.45,
  maxKaks: 1.8,
  setbackM: 5,
};

const INITIAL_NEIGHBORS: NeighborContextBlock[] = [
  {
    id: 'nb_south',
    label: 'Güney Komşu Bina',
    direction: 'Güney',
    enabled: false,
    heightM: 15,
    distanceM: 12,
    widthM: 42,
    depthM: 16,
  },
];

const SEASON_LIST: Array<{ key: SeasonKey; label: string; dateLabel: string }> = [
  { key: 'spring', label: 'İlkbahar', dateLabel: '21 Mart' },
  { key: 'summer', label: 'Yaz', dateLabel: '21 Haziran' },
  { key: 'autumn', label: 'Sonbahar', dateLabel: '23 Eylül' },
  { key: 'winter', label: 'Kış', dateLabel: '21 Aralık' },
];

const FUNCTION_OPTIONS: Array<{ key: BuildingFunctionKey; label: string }> = [
  { key: 'residential', label: 'Konut / Yaşam Binası' },
  { key: 'education', label: 'Okul / Eğitim Binası' },
  { key: 'office', label: 'Ofis / Çalışma Binası' },
  { key: 'cultural', label: 'Kültür Merkezi / Müze / Kütüphane' },
  { key: 'healthcare', label: 'Sağlık / Klinik Binası' },
  { key: 'atelier', label: 'Üretim / Tasarım Atölyesi' },
  { key: 'mixed', label: 'Karma Kullanım (Ticaret + Konut)' },
];

const ROOF_OPTIONS: Array<{ key: RoofTypeKey; label: string }> = [
  { key: 'sawtooth', label: 'Testere Dişi Kuzey Işıklığı (Sawtooth)' },
  { key: 'mono_pitch', label: 'Tek Eğimli Güneş Çatısı (Mono-Pitch)' },
  { key: 'asymmetric_gable', label: 'Asimetrik İklimsel Beşik Çatı' },
  { key: 'gable', label: 'Simetrik Beşik Çatı' },
  { key: 'flat_green', label: 'Yeşil Teras Çatı + Tepe Işık Feneri' },
  { key: 'butterfly', label: 'Kelebek (V-Kesit) Yağmur Hasadı Çatısı' },
  { key: 'louver_canopy', label: 'Güneş Kırıcı Pergola Çatı' },
];

function formatHour(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export const App: React.FC = () => {
  // 1. Temel Kullanıcı Seçimleri (Konum, Fonksiyon, Metrekare, Mevsim)
  const [city, setCity] = useState<CityClimateProfile>(CITIES[0]);
  const [funcKey, setFuncKey] = useState<BuildingFunctionKey>('education');
  const [targetAreaM2, setTargetAreaM2] = useState<number>(3600);
  const [season, setSeason] = useState<SeasonKey>('summer');
  const [dayOfYear, setDayOfYear] = useState<number>(SEASON_REPRESENTATIVE_DOY.summer.doy);
  const [solarHour, setSolarHour] = useState<number>(13.0);

  // Canlı Şehir Arama Durumu
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Kütle ve Çatı Durumu
  const [site] = useState<SiteParameters>(INITIAL_SITE);
  const [neighbors] = useState<NeighborContextBlock[]>(INITIAL_NEIGHBORS);
  const [globalOrientationDeg, setGlobalOrientationDeg] = useState<number>(8);

  const recommendations = useMemo(
    () => generateTypologyRecommendations(city, funcKey, targetAreaM2, site),
    [city, funcKey, targetAreaM2, site]
  );

  const [activeTypologyKey, setActiveTypologyKey] = useState<MassTypologyKey>(
    recommendations[0].key
  );
  const [blocks, setBlocks] = useState<MassBlock[]>(recommendations[0].blocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    recommendations[0].blocks[0]?.id ?? null
  );
  const [courtyardAreaM2, setCourtyardAreaM2] = useState<number>(
    recommendations[0].courtyardAreaM2
  );

  useEffect(() => {
    const topRec = recommendations[0];
    if (!topRec) return;
    setActiveTypologyKey(topRec.key);
    setBlocks(topRec.blocks);
    setSelectedBlockId(topRec.blocks[0]?.id ?? null);
    setCourtyardAreaM2(topRec.courtyardAreaM2);
    setGlobalOrientationDeg(topRec.recommendedOrientationDeg);
  }, [city.id, funcKey, targetAreaM2]);

  // Malzeme Önerileri
  const evaluatedMaterials = useMemo(
    () => evaluateMaterialsForProject(city, funcKey),
    [city, funcKey]
  );

  const [selectedMaterials, setSelectedMaterials] = useState<
    Record<MaterialCategoryKey, string>
  >(() => getRecommendedMaterialSelection(evaluatedMaterials));

  useEffect(() => {
    setSelectedMaterials(getRecommendedMaterialSelection(evaluatedMaterials));
  }, [city.id, funcKey]);

  const actualBuiltAreaM2 = useMemo(
    () => Math.round(blocks.reduce((acc, b) => acc + b.width * b.depth * b.floors, 0)),
    [blocks]
  );

  const assemblySummary = useMemo(
    () =>
      calculateAssemblySummary(
        selectedMaterials,
        evaluatedMaterials,
        city,
        actualBuiltAreaM2
      ),
    [selectedMaterials, evaluatedMaterials, city, actualBuiltAreaM2]
  );

  const solarSummary = useMemo(
    () =>
      getSeasonalSolarSummary(
        city.lat,
        season,
        city.seasons[season].directRadiationWm2,
        city.seasons[season].diffuseRadiationWm2
      ),
    [city, season]
  );

  const activeRec =
    recommendations.find((r) => r.key === activeTypologyKey) || recommendations[0];
  const activeBlock = blocks.find((b) => b.id === selectedBlockId) || blocks[0];
  const roofPerf = useMemo(
    () => analyzeBlockRoofPerformance(activeBlock, city),
    [activeBlock, city]
  );
  const optRoofAdvice = useMemo(
    () => recommendOptimalRoofForBlock(activeBlock, city, funcKey),
    [activeBlock, city, funcKey]
  );

  const [exportTrigger, setExportTrigger] = useState(0);

  // Şehir Arama
  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchLocationByName(searchQuery);
      setSearchResults(res);
      if (res.length === 0) setSearchError('Konum bulunamadı.');
    } catch {
      setSearchError('Arama servisine ulaşılamadı, hazır şehir listesinden seçebilirsiniz.');
    } finally {
      setSearching(false);
    }
  };

  const handlePickGeo = async (item: GeocodingResult) => {
    setSearching(true);
    setSearchError(null);
    try {
      const liveProfile = await fetchLiveClimateProfile(
        item.name,
        item.admin1 || '',
        item.country,
        item.latitude,
        item.longitude,
        item.elevation ?? 100
      );
      setCity(liveProfile);
      setSearchResults([]);
      setSearchQuery('');
    } catch {
      setSearchError('İklim verisi çekilemedi.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSeason = (s: SeasonKey) => {
    setSeason(s);
    setDayOfYear(SEASON_REPRESENTATIVE_DOY[s].doy);
  };

  const handleApplyTypology = (rec: TypologyRecommendation) => {
    setActiveTypologyKey(rec.key);
    setBlocks(rec.blocks.map((b) => ({ ...b })));
    setSelectedBlockId(rec.blocks[0]?.id ?? null);
    setCourtyardAreaM2(rec.courtyardAreaM2);
    setGlobalOrientationDeg(rec.recommendedOrientationDeg);
  };

  const handleUpdateActiveBlock = (patch: Partial<MassBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === activeBlock.id ? { ...b, ...patch } : b))
    );
  };

  const handleAddBlock = () => {
    const fh = BUILDING_PROGRAMS[funcKey].defaultFloorHeightM;
    const draft: MassBlock = {
      id: `blk_${Date.now().toString().slice(-4)}`,
      label: `Ek Kütle #${blocks.length + 1}`,
      role: 'north_daylight',
      x: 0,
      z: 0,
      width: 16,
      depth: 11,
      floors: 2,
      floorHeight: fh,
      rotationDeg: 0,
      roofType: 'sawtooth',
      roofPitchDeg: 32,
      secondaryPitchDeg: 86,
      overhangSouthM: 1.1,
      sawtoothCount: 3,
      skylightRatio: 0.35,
      ridgeDirection: 'EW',
      hasPvPanels: true,
    };
    const opt = recommendOptimalRoofForBlock(draft, city, funcKey);
    const created: MassBlock = {
      ...draft,
      roofType: opt.roofType,
      roofPitchDeg: opt.roofPitchDeg,
      secondaryPitchDeg: opt.secondaryPitchDeg,
      overhangSouthM: opt.overhangSouthM,
      sawtoothCount: opt.sawtoothCount,
      skylightRatio: opt.skylightRatio,
      hasPvPanels: opt.hasPvPanels,
    };
    setBlocks((prev) => [...prev, created]);
    setSelectedBlockId(created.id);
  };

  const handleDeleteActiveBlock = () => {
    if (blocks.length <= 1) return;
    const next = blocks.filter((b) => b.id !== activeBlock.id);
    setBlocks(next);
    setSelectedBlockId(next[0]?.id ?? null);
  };

  const handleExportReport = () => {
    const prog = BUILDING_PROGRAMS[funcKey];
    const matLines = (Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategoryKey[])
      .map((cat) => {
        const ev = evaluatedMaterials.find((e) => e.material.id === selectedMaterials[cat]);
        if (!ev) return '';
        return `- **${MATERIAL_CATEGORY_LABELS[cat]}:** ${ev.material.name} (${ev.material.originCity}, ${ev.distanceKm} km — Geri Dönüşüm: %${ev.material.recyclabilityPct})`;
      })
      .join('\n');

    const md = `# İKLİMFORM — ${city.name} Mimari İklim, Kütle, Çatı ve Malzeme Raporu

## 1. İklim ve Arazi Özellikleri (${city.name})
- **İklim Tipi:** ${city.koppenDesc} (TS 825 Bölge ${city.ts825Zone})
- **Yaz Öğle Güneşi Açısı:** ${solarSummary.summerNoonAltDeg}° | **Kış Öğle Güneşi Açısı:** ${solarSummary.winterNoonAltDeg}°
- **Yaz Sıcaklık & Rüzgar:** ${city.seasons.summer.avgTempC}°C, ${city.seasons.summer.windLabel} (${city.seasons.summer.windSpeedMs} m/s)
- **Kış Sıcaklık & Rüzgar:** ${city.seasons.winter.avgTempC}°C, ${city.seasons.winter.windLabel} (${city.seasons.winter.windSpeedMs} m/s)

## 2. Önerilen Kütle ve Avlu Dağılımı (${prog.title} - ${targetAreaM2} m²)
- **En Uygun Kütle Formu:** ${activeRec.name} (%${activeRec.totalScore} İklim Uyumu)
- **Avlu Büyüklüğü:** ${courtyardAreaM2} m² (${activeRec.courtyardRatioHW})
- **Önerilen Yönelim:** ${globalOrientationDeg}°

## 3. Önerilen Çatı ve Güneş Açısı
- **Çatı Tipi:** ${ROOF_TYPES_META[activeBlock.roofType].name}
- **Çatı Eğim Açısı:** ${activeBlock.roofPitchDeg}° | **Güney Saçak Uzantısı:** ${activeBlock.overhangSouthM} m
- **Kış Güneşi İçeri Giriş Derinliği:** ${roofPerf.winterSunPenetrationM} m

## 4. Lokasyona Uygun Yerel ve Sürdürülebilir Malzemeler
${matLines}
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iklimform_${city.id}_rapor.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const prog = BUILDING_PROGRAMS[funcKey];
  const summerShadowRatio = calculateSolarPosition(city.lat, 172, 12).shadowMultiplier;
  const winterShadowRatio = calculateSolarPosition(city.lat, 355, 12).shadowMultiplier;

  // 2D Oda Güneş Kesiti SVG hesapları
  const svgW = 360;
  const svgH = 165;
  const groundY = 136;
  const bLeft = 60;
  const bRight = 250;
  const bWidthPx = bRight - bLeft;
  const wallTopY = 80;
  const pxPerMeter = bWidthPx / Math.max(8, activeBlock.depth);
  const overPx = Math.min(40, activeBlock.overhangSouthM * pxPerMeter * 1.4);
  const risePx = Math.min(
    36,
    Math.max(10, Math.tan((activeBlock.roofPitchDeg * Math.PI) / 180) * 48)
  );
  const winterRad = (roofPerf.winterNoonAltDeg * Math.PI) / 180;
  const summerRad = (roofPerf.summerNoonAltDeg * Math.PI) / 180;
  const penPx = Math.min(bWidthPx - 6, roofPerf.winterSunPenetrationM * pxPerMeter);

  const activeWallColor =
    evaluatedMaterials.find((e) => e.material.id === selectedMaterials.envelope_wall)?.material
      .colorHex ?? '#D6D3C9';
  const activeRoofColor =
    evaluatedMaterials.find((e) => e.material.id === selectedMaterials.roof_finish)?.material
      .colorHex ?? '#334155';

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#161615]">
      {/* SADE ÜST BAR */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-[#161615] text-white flex items-center justify-center font-bold text-xs">
              İF
            </div>
            <div>
              <div className="font-bold text-base tracking-tight whitespace-nowrap">İKLİMFORM</div>
              <div className="text-xs text-stone-500 hidden sm:block">
                Konum Bazlı Mimari İklim, Kütle, Çatı ve Yerel Malzeme Rehberi
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setExportTrigger((n) => n + 1)}
              className="px-3 py-2 text-xs font-semibold border border-stone-300 bg-white hover:bg-stone-100 transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <Box className="w-3.5 h-3.5 text-[#C85A17]" />
              3D Model (.OBJ)
            </button>
            <button
              onClick={handleExportReport}
              className="px-3.5 py-2 text-xs font-semibold bg-[#161615] text-white hover:bg-stone-800 transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Raporu İndir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ===================================================================== */}
        {/* GİRİŞ PANELİ: SADECE KONUM, BİNA TÜRÜ VE METREKARE SEÇİMİ            */}
        {/* ===================================================================== */}
        <section className="bg-white border border-stone-200 p-6 space-y-5">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#161615]">
              Konumu ve Bina İhtiyacını Seçin
            </h1>
            <p className="text-sm text-stone-600 mt-1">
              Şehri, bina fonksiyonunu ve toplam metrekareyi seçtiğiniz anda aşağıda o lokasyonun
              mevsimsel iklim analizi, en uygun kütle/avlu şekli, çatı açıları ve yerel malzeme
              önerileri otomatik listelenir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. KONUM SEÇİMİ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                1. Konum (Şehir Seçin)
              </label>
              <select
                value={CITIES.some((c) => c.id === city.id) ? city.id : 'custom'}
                onChange={(e) => {
                  const found = CITIES.find((c) => c.id === e.target.value);
                  if (found) setCity(found);
                }}
                className="w-full bg-[#FAF9F6] border border-stone-300 px-3.5 py-2.5 text-sm font-semibold text-[#161615] focus:outline-none focus:border-[#161615]"
              >
                {!CITIES.some((c) => c.id === city.id) && (
                  <option value="custom">
                    {city.name} ({city.lat.toFixed(2)}°K, {city.lng.toFixed(2)}°D)
                  </option>
                )}
                {CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.region})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. BİNA FONKSİYONU */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                2. Bina Fonksiyonu
              </label>
              <select
                value={funcKey}
                onChange={(e) => setFuncKey(e.target.value as BuildingFunctionKey)}
                className="w-full bg-[#FAF9F6] border border-stone-300 px-3.5 py-2.5 text-sm font-semibold text-[#161615] focus:outline-none focus:border-[#161615]"
              >
                {FUNCTION_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. TOPLAM METREKARE */}
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-500">
                <span>3. Toplam İnşaat Alanı</span>
                <span className="text-[#161615] font-mono">
                  {targetAreaM2.toLocaleString('tr-TR')} m²
                </span>
              </label>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min={800}
                  max={16000}
                  step={200}
                  value={targetAreaM2}
                  onChange={(e) => setTargetAreaM2(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={500}
                  max={30000}
                  step={100}
                  value={targetAreaM2}
                  onChange={(e) =>
                    setTargetAreaM2(Math.max(500, Number(e.target.value) || 1000))
                  }
                  className="w-24 bg-[#FAF9F6] border border-stone-300 px-2.5 py-1.5 text-sm font-semibold text-right"
                />
              </div>
            </div>
          </div>

          {/* İsteğe Bağlı Başka İlçe/Şehir Arama Satırı */}
          <form onSubmit={handleSearchCity} className="flex flex-wrap sm:flex-nowrap gap-2 pt-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Listede olmayan başka bir il, ilçe veya ülke arayın (ör. Rize, Mardin, Çanakkale, Bodrum)..."
                className="w-full pl-9 pr-3 py-2 bg-[#FAF9F6] border border-stone-200 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#161615]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-stone-800 hover:bg-black text-white text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              Konumu Bul
            </button>
          </form>

          {searchError && <p className="text-xs text-red-700">{searchError}</p>}

          {searchResults.length > 0 && (
            <div className="border border-stone-300 bg-white divide-y divide-stone-100">
              {searchResults.map((r, i) => (
                <button
                  key={`${r.latitude}_${r.longitude}_${i}`}
                  onClick={() => handlePickGeo(r)}
                  className="w-full px-3.5 py-2.5 text-left text-sm hover:bg-stone-50 flex items-center justify-between"
                >
                  <span className="font-semibold">
                    {r.name} {r.admin1 ? `(${r.admin1})` : ''} — {r.country}
                  </span>
                  <span className="text-xs font-semibold text-[#C85A17]">Bu Konumu Seç →</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ===================================================================== */}
        {/* BÖLÜM 01: SEÇİLEN KONUMUN İKLİM VE MEVSİMSEL ARAZİ ÖZELLİKLERİ        */}
        {/* ===================================================================== */}
        <section className="bg-white border border-stone-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-4">
            <div>
              <span className="font-mono text-xs font-bold text-[#C85A17]">BÖLÜM 01</span>
              <h2 className="text-lg font-bold text-[#161615]">
                {city.name} — Mevsimsel Güneş, Gölge ve Rüzgar Analizi
              </h2>
            </div>
            <div className="text-xs font-medium text-stone-600 bg-[#F7F6F2] border border-stone-200 px-3 py-1.5">
              İklim: <strong>{city.koppenDesc}</strong> · TS 825 Bölge {city.ts825Zone} · Rakım{' '}
              {city.elevationM} m
            </div>
          </div>

          {/* 4 Mevsim Yan Yana Karşılaştırma Kartları */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Mevsimlere Göre Sıcaklık, Hakim Rüzgar, Nem ve Yağış (Aktif Mevsimi Seçebilirsiniz)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SEASON_LIST.map((s) => {
                const st = city.seasons[s.key];
                const isSelected = season === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => handleSelectSeason(s.key)}
                    className={`text-left p-4 border transition ${
                      isSelected
                        ? 'border-[#161615] bg-[#FAF9F5] ring-1 ring-[#161615]'
                        : 'border-stone-200 bg-white hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-[#161615]">{s.label}</span>
                      <span className="text-xs text-stone-400">{s.dateLabel}</span>
                    </div>
                    <div className="text-2xl font-bold text-[#161615]">{st.avgTempC}°C</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      En düşük {st.minTempC}° / En yüksek {st.maxTempC}°C
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-stone-200 space-y-1 text-xs text-stone-700">
                      <div className="flex items-center gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>
                          <strong>{st.windLabel}</strong> ({st.windSpeedMs} m/s)
                        </span>
                      </div>
                      <div>
                        Nem: <strong>%{st.humidityPct}</strong> · Yağış:{' '}
                        <strong>{st.precipitationMm} mm</strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Güneş Açısı, Gölge Boyu ve Arazi Kuralları */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-3">
              <div className="font-bold text-sm text-[#161615] flex items-center gap-2">
                <Sun className="w-4 h-4 text-[#C85A17]" />
                Güneş Geliş Açıları ve Bina Gölge Boyu
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white border border-stone-200 p-3">
                  <span className="text-stone-500 block">Yaz Öğle Güneşi (21 Haz)</span>
                  <strong className="text-base text-[#161615]">
                    {solarSummary.summerNoonAltDeg}° Dik Açı
                  </strong>
                  <span className="block text-stone-500 mt-1">
                    Gölge çok kısadır ({summerShadowRatio.toFixed(2)} × bina boyu). Güneyde saçakla
                    kolayca kesilir.
                  </span>
                </div>
                <div className="bg-white border border-stone-200 p-3">
                  <span className="text-stone-500 block">Kış Öğle Güneşi (21 Ara)</span>
                  <strong className="text-base text-[#161615]">
                    {solarSummary.winterNoonAltDeg}° Eğik Açı
                  </strong>
                  <span className="block text-stone-500 mt-1">
                    Gölge uzar ({winterShadowRatio.toFixed(1)} × bina boyu). Binalar birbirinin
                    kış güneşini kapatmamalıdır.
                  </span>
                </div>
              </div>
              <div className="text-xs text-stone-600 pt-1">
                <strong>Cephe Güneş Yükü ({SEASON_LIST.find((x) => x.key === season)?.label}):</strong>{' '}
                Güney {solarSummary.facadeDailyKwhM2.south} kWh/m² · Doğu{' '}
                {solarSummary.facadeDailyKwhM2.east} kWh/m² · Batı{' '}
                {solarSummary.facadeDailyKwhM2.west} kWh/m² · Kuzey{' '}
                {solarSummary.facadeDailyKwhM2.north} kWh/m²
              </div>
            </div>

            <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-2.5">
              <div className="font-bold text-sm text-[#161615] flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#161615]" />
                {city.name} Arazisinde Mimarın Uygulaması Gereken Kurallar
              </div>
              <ul className="space-y-2 text-xs text-stone-700">
                {city.passiveStrategies.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="font-mono font-bold text-[#C85A17]">0{idx + 1}</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* BÖLÜM 02: OPTİMAL KÜTLE, AVLU VE ODA METREKARE ÖNERİSİ                */}
        {/* ===================================================================== */}
        <section className="bg-white border border-stone-200 p-6 space-y-6">
          <div className="border-b border-stone-200 pb-4">
            <span className="font-mono text-xs font-bold text-[#C85A17]">BÖLÜM 02</span>
            <h2 className="text-lg font-bold text-[#161615]">
              {prog.title} ({targetAreaM2.toLocaleString('tr-TR')} m²) İçin Optimal Kütle ve Avlu
              Önerisi
            </h2>
          </div>

          {/* En Uygun Kütle Önerisi Ana Kartı */}
          <div className="bg-[#FAF9F5] border-2 border-[#161615] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#15803D]">
                  BU KONUM VE BİNA FONKSİYONU İÇİN #1 ÖNERİLEN KÜTLE FORMU
                </span>
                <h3 className="text-xl font-bold text-[#161615] mt-0.5">{activeRec.name}</h3>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl font-bold text-[#161615]">%{activeRec.totalScore}</span>
                <span className="block text-xs text-stone-500">İklim & Fonksiyon Uyumu</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-stone-200 p-3.5 text-xs">
              <div>
                <span className="text-stone-500 block">Önerilen Avlu Alanı</span>
                <strong className="text-sm text-[#161615]">{activeRec.courtyardAreaM2} m²</strong>
                <span className="block text-[11px] text-stone-500">{activeRec.courtyardRatioHW}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Bina Bakış Yönü</span>
                <strong className="text-sm text-[#161615]">
                  {activeRec.recommendedOrientationDeg >= 0
                    ? `Güney +${activeRec.recommendedOrientationDeg}° Doğu`
                    : `Güney ${activeRec.recommendedOrientationDeg}° Batı`}
                </strong>
                <span className="block text-[11px] text-stone-500">Güneş ve rüzgara göre</span>
              </div>
              <div>
                <span className="text-stone-500 block">Taban Oturumu</span>
                <strong className="text-sm text-[#161615]">
                  {activeRec.footprintAreaM2.toLocaleString('tr-TR')} m²
                </strong>
                <span className="block text-[11px] text-stone-500">
                  {activeRec.blocks[0]?.floors} Katlı Düzen
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Performans Dengesi</span>
                <strong className="text-sm text-[#161615]">
                  Isı %{activeRec.thermalScore} · Işık %{activeRec.daylightScore}
                </strong>
                <span className="block text-[11px] text-stone-500">
                  Havalandırma %{activeRec.ventilationScore}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-sm text-stone-700">
              {activeRec.rationale.map((r, i) => (
                <p key={i} className="leading-relaxed">
                  • {r}
                </p>
              ))}
            </div>

            {/* Diğer Kütle Alternatifleri */}
            <div className="pt-2 border-t border-stone-200">
              <span className="text-xs font-semibold text-stone-500 block mb-2">
                Diğer Kütle Seçenekleriyle Karşılaştırın (Tıklayarak Değiştirin):
              </span>
              <div className="flex flex-wrap gap-2">
                {recommendations.map((rec, idx) => (
                  <button
                    key={rec.key}
                    onClick={() => handleApplyTypology(rec)}
                    className={`px-3 py-1.5 text-xs font-semibold border transition ${
                      rec.key === activeTypologyKey
                        ? 'bg-[#161615] text-white border-[#161615]'
                        : 'bg-white text-stone-700 border-stone-300 hover:border-[#161615]'
                    }`}
                  >
                    {idx + 1}. {rec.name} (%{rec.totalScore})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fonksiyona Göre Mekan Metrekareleri ve Yönelim Tablosu */}
          <div>
            <h3 className="text-sm font-bold text-[#161615] mb-2.5">
              Bina İçi Mekanların Metrekare Dağılımı ve Hangi Cepheye Bakması Gerektiği
            </h3>
            <div className="overflow-x-auto border border-stone-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF9F6] border-b border-stone-200 text-xs text-stone-600">
                  <tr>
                    <th className="py-2.5 px-3.5">Mekan / Oda Grubu</th>
                    <th className="py-2.5 px-3.5">Önerilen Alan</th>
                    <th className="py-2.5 px-3.5">Bakması Gereken Cephe</th>
                    <th className="py-2.5 px-3.5">Mimari Neden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {prog.spaces.map((sp) => {
                    const m2 = Math.round((targetAreaM2 * sp.ratioPct) / 100);
                    return (
                      <tr key={sp.id} className="hover:bg-stone-50">
                        <td className="py-2.5 px-3.5 font-semibold text-[#161615]">{sp.name}</td>
                        <td className="py-2.5 px-3.5 font-mono font-semibold whitespace-nowrap">
                          {m2.toLocaleString('tr-TR')} m² (%{sp.ratioPct})
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-[#C85A17] whitespace-nowrap">
                          {sp.preferredOrientation}
                        </td>
                        <td className="py-2.5 px-3.5 text-stone-600 text-xs">{sp.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* BÖLÜM 03: LOKASYONA UYGUN YEREL MALZEME, ERİŞİLEBİLİRLİK & SÜRDÜRÜLEBİLİRLİK */}
        {/* ===================================================================== */}
        <section className="bg-white border border-stone-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-4">
            <div>
              <span className="font-mono text-xs font-bold text-[#C85A17]">BÖLÜM 03</span>
              <h2 className="text-lg font-bold text-[#161615]">
                {city.name} Lokasyonuna Uygun Malzeme, Erişilebilirlik ve Sürdürülebilirlik
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs bg-[#F7F6F2] border border-stone-200 px-3.5 py-2">
              <span className="flex items-center gap-1 text-[#15803D] font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Duvar U={assemblySummary.wallUValueWm2K} W/m²K (TS 825 Uygun)
              </span>
              <span>·</span>
              <span>
                Karbon Tasarrufu: <strong>-%{assemblySummary.carbonSavedPct}</strong>
              </span>
              <span>·</span>
              <span>
                Yerel Tedarik (&lt;500km): <strong>%{assemblySummary.regionalRatioPct}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategoryKey[]).map((cat) => {
              const catOptions = evaluatedMaterials.filter((e) => e.material.category === cat);
              const chosen =
                catOptions.find((e) => e.material.id === selectedMaterials[cat]) || catOptions[0];
              if (!chosen) return null;

              return (
                <div
                  key={cat}
                  className="border border-stone-200 bg-[#FAF9F6] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        {MATERIAL_CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-xs font-bold text-[#15803D]">
                        %{chosen.overallScore} İklim & Yerel Uyum
                      </span>
                    </div>

                    {/* İsterse alternatif yerel malzemeyi de seçebilir */}
                    <select
                      value={chosen.material.id}
                      onChange={(e) =>
                        setSelectedMaterials((prev) => ({ ...prev, [cat]: e.target.value }))
                      }
                      className="w-full bg-white border border-stone-300 px-3 py-2 text-sm font-bold text-[#161615]"
                    >
                      {catOptions.map((opt, idx) => (
                        <option key={opt.material.id} value={opt.material.id}>
                          {idx === 0 ? '★ Önerilen: ' : ''}
                          {opt.material.name} ({opt.distanceKm} km)
                        </option>
                      ))}
                    </select>

                    <p className="text-xs text-stone-600 leading-relaxed">
                      {chosen.material.architecturalNote}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-stone-200 text-xs">
                    <div>
                      <span className="text-stone-400 block text-[11px]">Üretim & Mesafe</span>
                      <strong className="text-[#161615] flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-[#C85A17] shrink-0" />
                        {chosen.distanceKm} km
                      </strong>
                      <span className="text-[11px] text-stone-500 block truncate">
                        {chosen.material.originCity}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-400 block text-[11px]">Erişilebilirlik</span>
                      <strong className="text-[#161615] capitalize">
                        {chosen.material.localCraftAvailability}
                      </strong>
                      <span className="text-[11px] text-stone-500 block">
                        Skor: {chosen.accessibilityScore}/100
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-400 block text-[11px]">Sürdürülebilirlik</span>
                      <strong className="text-[#15803D] flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5 shrink-0" />%
                        {chosen.material.recyclabilityPct} Döngüsel
                      </strong>
                      <span className="text-[11px] text-stone-500 block">
                        {chosen.totalCarbonKgM2 <= 0
                          ? `Karbon Negatif (${chosen.totalCarbonKgM2} kg)`
                          : `${chosen.totalCarbonKgM2} kgCO₂e/m²`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===================================================================== */}
        {/* BÖLÜM 04: 3D KÜTLE VE GÜNEŞ AÇISINA GÖRE ÇATI TASARIMI EKLENTİSİ       */}
        {/* ===================================================================== */}
        <section className="bg-white border border-stone-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <span className="font-mono text-xs font-bold text-[#C85A17]">
                BÖLÜM 04 · 3D EKLENTİ
              </span>
              <h2 className="text-lg font-bold text-[#161615]">
                3D Kütle Düzenleyici ve Güneş Açısına Göre Çatı Önerisi
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddBlock}
                className="px-3.5 py-2 bg-[#161615] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Yeni 3D Kütle Ekle
              </button>
              <button
                onClick={() =>
                  handleUpdateActiveBlock({
                    roofType: optRoofAdvice.roofType,
                    roofPitchDeg: optRoofAdvice.roofPitchDeg,
                    secondaryPitchDeg: optRoofAdvice.secondaryPitchDeg,
                    overhangSouthM: optRoofAdvice.overhangSouthM,
                  })
                }
                className="px-3.5 py-2 bg-[#C85A17] hover:bg-[#b04d12] text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" /> Çatı Açısını Güneşe Göre Ayarla
              </button>
            </div>
          </div>

          {/* Net Yazılı Çatı Önerisi Kutusu */}
          <div className="bg-[#FAF9F5] border-l-4 border-[#C85A17] p-4 text-sm text-stone-700 space-y-1">
            <div className="font-bold text-[#161615]">
              {city.name} Güneş Açılarına Göre Önerilen Çatı:{' '}
              <span className="text-[#C85A17]">
                {ROOF_TYPES_META[optRoofAdvice.roofType].name} ({optRoofAdvice.roofPitchDeg}° Eğim,{' '}
                {optRoofAdvice.overhangSouthM} m Saçak)
              </span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed">{optRoofAdvice.reasoning}</p>
          </div>

          {/* Sol: Büyük 3D Sahne | Sağ: Sade Çatı Açısı ve Oda Güneş Kesiti */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* Saat Kaydırıcısı */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F6] border border-stone-200 px-3.5 py-2 text-xs">
                <span className="font-semibold text-stone-700">
                  Gölge Testi ({SEASON_LIST.find((s) => s.key === season)?.label} — Saat{' '}
                  {formatHour(solarHour)}):
                </span>
                <input
                  type="range"
                  min={6}
                  max={19}
                  step={0.25}
                  value={solarHour}
                  onChange={(e) => setSolarHour(Number(e.target.value))}
                  className="w-44 sm:w-56"
                />
              </div>

              <div className="h-[440px]">
                <Viewport3D
                  city={city}
                  season={season}
                  dayOfYear={dayOfYear}
                  solarHour={solarHour}
                  onChangeSolarHour={setSolarHour}
                  site={site}
                  blocks={blocks}
                  neighbors={neighbors}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={(id) => {
                    if (id) setSelectedBlockId(id);
                  }}
                  globalOrientationDeg={globalOrientationDeg}
                  courtyardAreaM2={courtyardAreaM2}
                  activeMaterialWallColor={activeWallColor}
                  activeMaterialRoofColor={activeRoofColor}
                  exportTrigger={exportTrigger}
                />
              </div>
            </div>

            {/* Sağ: Seçili Kütlenin Çatı & Güneş Girişi Ayarı */}
            <div className="lg:col-span-5 space-y-4 text-xs">
              <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-800">Düzenlenen 3D Kütle</label>
                  {blocks.length > 1 && (
                    <button
                      onClick={handleDeleteActiveBlock}
                      className="text-red-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Kütleyi Sil
                    </button>
                  )}
                </div>

                <select
                  value={activeBlock.id}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  className="w-full bg-white border border-stone-300 px-3 py-2 font-semibold text-[#161615]"
                >
                  {blocks.map((b, i) => (
                    <option key={b.id} value={b.id}>
                      Kütle {i + 1}: {b.label} ({b.floors} Kat)
                    </option>
                  ))}
                </select>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Çatı Tipi</label>
                  <select
                    value={activeBlock.roofType}
                    onChange={(e) =>
                      handleUpdateActiveBlock({ roofType: e.target.value as RoofTypeKey })
                    }
                    className="w-full bg-white border border-stone-300 px-3 py-2 font-semibold text-[#161615]"
                  >
                    {ROOF_OPTIONS.map((ro) => (
                      <option key={ro.key} value={ro.key}>
                        {ro.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="flex justify-between text-stone-700 mb-1">
                      <span>Çatı Açısı</span>
                      <strong>{activeBlock.roofPitchDeg}°</strong>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={45}
                      value={activeBlock.roofPitchDeg}
                      onChange={(e) =>
                        handleUpdateActiveBlock({ roofPitchDeg: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between text-stone-700 mb-1">
                      <span>Güney Saçak</span>
                      <strong>{activeBlock.overhangSouthM} m</strong>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.1}
                      value={activeBlock.overhangSouthM}
                      onChange={(e) =>
                        handleUpdateActiveBlock({ overhangSouthM: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="flex justify-between text-stone-700 mb-1">
                      <span>Kat</span>
                      <strong>{activeBlock.floors}</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={activeBlock.floors}
                      onChange={(e) =>
                        handleUpdateActiveBlock({ floors: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between text-stone-700 mb-1">
                      <span>Konum X</span>
                      <strong>{activeBlock.x}m</strong>
                    </label>
                    <input
                      type="range"
                      min={-35}
                      max={35}
                      value={activeBlock.x}
                      onChange={(e) => handleUpdateActiveBlock({ x: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between text-stone-700 mb-1">
                      <span>Konum Z</span>
                      <strong>{activeBlock.z}m</strong>
                    </label>
                    <input
                      type="range"
                      min={-35}
                      max={35}
                      value={activeBlock.z}
                      onChange={(e) => handleUpdateActiveBlock({ z: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Canlı Oda Güneş Girişi Kesiti */}
              <div className="border border-stone-200 bg-white p-3 space-y-2">
                <div className="font-bold text-stone-800">
                  Çatı ve Saçağa Göre Odaya Güneş Girişi Kesiti
                </div>
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-36">
                  <rect x="0" y="0" width={svgW} height={groundY} fill="#F8F7F3" />
                  <rect x="0" y={groundY} width={svgW} height={svgH - groundY} fill="#E5E2D9" />
                  <line
                    x1="10"
                    y1={groundY}
                    x2={svgW - 10}
                    y2={groundY}
                    stroke="#161615"
                    strokeWidth="1.5"
                  />

                  <polygon
                    points={`${bRight},${wallTopY + 10} ${bRight},${groundY} ${
                      bRight - penPx
                    },${groundY} ${bRight},${wallTopY + 6}`}
                    fill="#FDE68A"
                    opacity="0.65"
                  />

                  <rect
                    x={bLeft}
                    y={wallTopY}
                    width={bWidthPx}
                    height={groundY - wallTopY}
                    fill="#FFFFFF"
                    stroke="#161615"
                    strokeWidth="1.5"
                  />

                  <line
                    x1={bRight}
                    y1={wallTopY + 6}
                    x2={bRight}
                    y2={groundY - 6}
                    stroke="#38BDF8"
                    strokeWidth="3.5"
                  />

                  {activeBlock.roofType === 'sawtooth' ? (
                    Array.from({ length: 3 }).map((_, idx) => {
                      const step = bWidthPx / 3;
                      const x0 = bLeft + idx * step;
                      const x1 = x0 + step;
                      return (
                        <g key={idx}>
                          <polygon
                            points={`${x0},${wallTopY} ${x0 + 4},${
                              wallTopY - risePx * 0.72
                            } ${x1},${wallTopY}`}
                            fill="#CBD5E1"
                            stroke="#161615"
                            strokeWidth="1.2"
                          />
                          <line
                            x1={x0}
                            y1={wallTopY}
                            x2={x0 + 4}
                            y2={wallTopY - risePx * 0.72}
                            stroke="#0284C7"
                            strokeWidth="2.6"
                          />
                        </g>
                      );
                    })
                  ) : (
                    <polygon
                      points={`${bLeft - 5},${wallTopY} ${
                        bLeft + bWidthPx * 0.5
                      },${wallTopY - risePx} ${bRight + overPx},${wallTopY}`}
                      fill="#CBD5E1"
                      stroke="#161615"
                      strokeWidth="1.3"
                    />
                  )}

                  <line
                    x1={bRight}
                    y1={wallTopY}
                    x2={bRight + overPx}
                    y2={wallTopY}
                    stroke="#161615"
                    strokeWidth="2.5"
                  />

                  <line
                    x1={bRight + overPx + Math.cos(summerRad) * 52}
                    y1={wallTopY - Math.sin(summerRad) * 52}
                    x2={bRight + overPx}
                    y2={wallTopY}
                    stroke="#D97706"
                    strokeWidth="2"
                  />
                  <text
                    x={svgW - 8}
                    y="18"
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="700"
                    fill="#B45309"
                  >
                    Yaz ({roofPerf.summerNoonAltDeg}° - Saçak Keser: %{roofPerf.summerDirectBlockPct})
                  </text>

                  <line
                    x1={svgW - 6}
                    y1={wallTopY + 12 - Math.tan(winterRad) * (svgW - 6 - bRight)}
                    x2={bRight - penPx}
                    y2={groundY}
                    stroke="#EA580C"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                  <text
                    x={svgW - 8}
                    y={groundY - 8}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="700"
                    fill="#C85A17"
                  >
                    Kış ({roofPerf.winterNoonAltDeg}° - {roofPerf.winterSunPenetrationM}m İçeri Girer)
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
