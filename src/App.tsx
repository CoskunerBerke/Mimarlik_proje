import React, { useMemo, useState } from 'react';
import {
  BuildingFunctionKey,
  MassBlock,
  MassTypologyKey,
  MaterialCategoryKey,
  NeighborContextBlock,
  RoofTypeKey,
  SeasonKey,
  SiteParameters,
} from './types/architecture';
import { BUILDING_PROGRAMS } from './data/programs';
import {
  calculateSolarPosition,
  getSeasonalSolarSummary,
  SEASON_REPRESENTATIVE_DOY,
} from './engine/solarEngine';
import {
  fetchVerifiedSiteBundle,
  resolveLocationInput,
  reverseGeocodeCoordinates,
  VerifiedSiteBundle,
} from './engine/realSiteAnalyzer';
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
import { SiteMapPicker } from './components/SiteMapPicker';
import { Viewport3D } from './components/Viewport3D';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Compass,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  Truck,
  Wind,
} from 'lucide-react';

const DEFAULT_SITE: SiteParameters = {
  parcelWidthM: 65,
  parcelDepthM: 55,
  slopeDeg: 2,
  slopeAspect: 'Güney',
  maxTaks: 0.45,
  maxKaks: 1.8,
  setbackM: 5,
};

const EMPTY_NEIGHBORS: NeighborContextBlock[] = [];

const FUNCTION_OPTIONS: Array<{ key: BuildingFunctionKey; label: string }> = [
  { key: 'residential', label: 'Konut / Yaşam Binası' },
  { key: 'education', label: 'Okul / Eğitim Binası' },
  { key: 'office', label: 'Ofis / Çalışma Yapısı' },
  { key: 'cultural', label: 'Kültür Merkezi / Müze / Kütüphane' },
  { key: 'healthcare', label: 'Sağlık / Klinik Binası' },
  { key: 'atelier', label: 'Tasarım / Üretim Atölyesi' },
  { key: 'mixed', label: 'Karma Kullanım (Ticaret + Konut)' },
];

const QUICK_EXAMPLES = [
  { label: 'Ankara Yenimahalle', query: 'Yenimahalle, Ankara' },
  { label: 'İstanbul Beşiktaş', query: 'Beşiktaş, İstanbul' },
  { label: 'İzmir Alsancak', query: 'Alsancak, İzmir' },
  { label: 'Diyarbakır Sur', query: 'Sur, Diyarbakır' },
  { label: 'Erzurum Yakutiye', query: 'Yakutiye, Erzurum' },
];

const SEASON_META: Array<{ key: SeasonKey; label: string }> = [
  { key: 'spring', label: 'İlkbahar' },
  { key: 'summer', label: 'Yaz' },
  { key: 'autumn', label: 'Sonbahar' },
  { key: 'winter', label: 'Kış' },
];

const ROOF_OPTIONS: Array<{ key: RoofTypeKey; label: string }> = [
  { key: 'sawtooth', label: 'Testere Dişi Kuzey Işıklığı (Sawtooth)' },
  { key: 'mono_pitch', label: 'Tek Eğimli Güneş Çatısı' },
  { key: 'asymmetric_gable', label: 'Asimetrik İklim Çatısı' },
  { key: 'gable', label: 'Simetrik Beşik Çatı' },
  { key: 'flat_green', label: 'Yeşil Teras Çatı + Işık Feneri' },
  { key: 'butterfly', label: 'Kelebek (V-Kesit) Çatı' },
  { key: 'louver_canopy', label: 'Güneş Kırıcı Pergola Çatı' },
];

export const App: React.FC = () => {
  // Giriş Formu Durumu
  const [locationText, setLocationText] = useState('');
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [pickerCoord, setPickerCoord] = useState<{ lat: number; lng: number }>({
    lat: 39.9334,
    lng: 32.8597,
  });
  const [funcKey, setFuncKey] = useState<BuildingFunctionKey>('education');
  const [targetAreaM2, setTargetAreaM2] = useState<number>(3200);

  // Canlı Analiz Durumu
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bundle, setBundle] = useState<VerifiedSiteBundle | null>(null);

  // İsteğe Bağlı 3D Simülasyon Durumu
  const [show3DStudio, setShow3DStudio] = useState(false);
  const [season, setSeason] = useState<SeasonKey>('summer');
  const [solarHour, setSolarHour] = useState<number>(13.0);
  const [activeTypologyKey, setActiveTypologyKey] = useState<MassTypologyKey>('u_court');
  const [blocks, setBlocks] = useState<MassBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [exportTrigger, setExportTrigger] = useState(0);

  const runFullAnalysis = async (customQuery?: string, directCoord?: { lat: number; lng: number }) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let resolved: {
        lat: number;
        lng: number;
        displayAddress: string;
        shortTitle: string;
      };

      if (directCoord) {
        resolved = await reverseGeocodeCoordinates(directCoord.lat, directCoord.lng);
        setLocationText(resolved.shortTitle);
      } else {
        const q = (customQuery ?? locationText).trim();
        resolved = await resolveLocationInput(q);
      }

      setPickerCoord({ lat: resolved.lat, lng: resolved.lng });

      const verified = await fetchVerifiedSiteBundle(
        resolved.lat,
        resolved.lng,
        resolved.shortTitle,
        resolved.displayAddress
      );

      setBundle(verified);

      // İlk optimal kütle ve çatı önerisini hazırla
      const recs = generateTypologyRecommendations(
        verified.cityProfile,
        funcKey,
        targetAreaM2,
        DEFAULT_SITE
      );
      if (recs[0]) {
        setActiveTypologyKey(recs[0].key);
        setBlocks(recs[0].blocks);
        setSelectedBlockId(recs[0].blocks[0]?.id ?? null);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Analiz sırasında beklenmeyen bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Bina fonksiyonu veya m² değiştiğinde mevcut konuma göre kütle önerisini yenile
  const recommendations = useMemo(() => {
    if (!bundle) return [];
    return generateTypologyRecommendations(
      bundle.cityProfile,
      funcKey,
      targetAreaM2,
      DEFAULT_SITE
    );
  }, [bundle, funcKey, targetAreaM2]);

  const preferLightweight = useMemo(() => {
    if (!bundle) return false;
    return bundle.soilAndMass.recommendedUnitMassKgM2.max <= 850;
  }, [bundle]);

  const evaluatedMaterials = useMemo(() => {
    if (!bundle) return [];
    return evaluateMaterialsForProject(bundle.cityProfile, funcKey, preferLightweight);
  }, [bundle, funcKey, preferLightweight]);

  const recommendedMaterialsMap = useMemo(
    () => getRecommendedMaterialSelection(evaluatedMaterials),
    [evaluatedMaterials]
  );

  const assemblySummary = useMemo(() => {
    if (!bundle || evaluatedMaterials.length === 0) return null;
    return calculateAssemblySummary(
      recommendedMaterialsMap,
      evaluatedMaterials,
      bundle.cityProfile,
      targetAreaM2
    );
  }, [bundle, evaluatedMaterials, recommendedMaterialsMap, targetAreaM2]);

  const handleDownloadMarkdown = () => {
    if (!bundle || recommendations.length === 0) return;
    const topRec = recommendations[0];
    const city = bundle.cityProfile;
    const sm = bundle.soilAndMass;
    const tp = bundle.topography;
    const ce = bundle.climateEvidence;
    const optRoof = recommendOptimalRoofForBlock(topRec.blocks[0], city, funcKey);

    const minTotalTon = Math.round((sm.recommendedUnitMassKgM2.min * targetAreaM2) / 1000);
    const maxTotalTon = Math.round((sm.recommendedUnitMassKgM2.max * targetAreaM2) / 1000);

    const md = `# İKLİMFORM — Veriye Dayalı Mimari Arazi, Kütle ve Malzeme Analiz Raporu

## Konum Bilgisi
- **İncelenen Konum:** ${bundle.displayAddress}
- **Koordinatlar:** ${city.lat.toFixed(5)}°K, ${city.lng.toFixed(5)}°D
- **Bina Fonksiyonu & Alanı:** ${BUILDING_PROGRAMS[funcKey].title} — ${targetAreaM2.toLocaleString('tr-TR')} m²

## 1. Gerçek Rüzgar ve İklim Verileri (${ce.periodLabel}, ${ce.daysAnalyzed} Günlük Ölçüm)
- **İklim Sınıfı:** ${city.koppenDesc} (Köppen: ${city.koppen}, TS 825 Isı Yalıtım Bölgesi: ${city.ts825Zone})
- **Yıllık Hakim Rüzgar Yönleri:** ${ce.annualWindRose
      .slice(0, 3)
      .map((w) => `${w.name} (%${w.frequencyPct})`)
      .join(', ')}
- **Yaz Hakim Rüzgarı:** ${ce.seasonalWindTop.summer[0]?.name} (%${ce.seasonalWindTop.summer[0]?.frequencyPct}) — Ort. ${city.seasons.summer.windSpeedMs} m/s
- **Kış Hakim Rüzgarı:** ${ce.seasonalWindTop.winter[0]?.name} (%${ce.seasonalWindTop.winter[0]?.frequencyPct}) — Ort. ${city.seasons.winter.windSpeedMs} m/s
- **Maksimum Kaydedilen Rüzgar Hamlesi:** ${ce.maxWindGustKmh} km/sa
- **Sıcaklık Uç Değerleri (5 Yıl):** En düşük ${ce.recordMinTempC}°C / En yüksek ${ce.recordMaxTempC}°C
- **Yıllık Yağış & Kar:** ${ce.annualPrecipMm} mm/yıl yağış · ${ce.annualSnowCm} cm/yıl kar
- **Yıllık Güneş Enerjisi:** ${ce.annualSolarKwhM2} kWh/m²·yıl

## 2. Topoğrafya, Zemin Yapısı ve Önerilen Bina Ağırlığı
- **Denizden Yükseklik (Rakım):** ${tp.elevationM} m (100m çevrede K:${tp.neighbors100m.northM}m, G:${tp.neighbors100m.southM}m, D:${tp.neighbors100m.eastM}m, B:${tp.neighbors100m.westM}m)
- **Arazi Eğimi ve Bakısı:** %${tp.slopePct} (${tp.slopeDeg}°) — ${tp.aspectLabel}
- **Jeolojik Formasyon & Zemin:** ${sm.geologicAgeTr} — ${sm.soilTypeTitle} (Tahmini Ön Sınıf: TBDY 2018 ${sm.estimatedTbdyClass})
- **100 km Çevrede Deprem Kaydı (1970–2025, M≥4.5):** ${sm.seismicCount100km} deprem (En büyük: M ${sm.maxHistoricalMag})
- **Önerilen Birim Bina Kütlesi:** ${sm.recommendedUnitMassKgM2.min}–${sm.recommendedUnitMassKgM2.max} kg/m² (${targetAreaM2} m² bina için toplam **${minTotalTon}–${maxTotalTon} ton**)
- **Önerilen Temel ve Taşıyıcı Sistem:** ${sm.recommendedFoundation} / ${sm.recommendedStructure}

## 3. Optimal Kütle, Avlu ve Çatı Önerisi
- **Önerilen Kütle Formu:** ${topRec.name} (%${topRec.totalScore} uyum, Avlu: ${topRec.courtyardAreaM2} m²)
- **Önerilen Çatı Tipi ve Açısı:** ${ROOF_TYPES_META[optRoof.roofType].name} — ${optRoof.roofPitchDeg}° eğim, ${optRoof.overhangSouthM} m güney saçak

## Veri Kaynakları
1. ${ce.sourceName}
2. ${tp.sourceName}
3. ${sm.sources.join(' | ')}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iklimform_kanitli_rapor_${city.lat.toFixed(2)}_${city.lng.toFixed(2)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F6] text-[#181816]">
      {/* ÜST BAŞLIK */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#181816] text-white flex items-center justify-center font-bold text-sm">
              İF
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">İKLİMFORM</div>
              <div className="text-xs text-stone-500">
                Veriye Dayalı Mimari Arazi, İklim, Kütle ve Malzeme Analiz Aracı
              </div>
            </div>
          </div>

          {bundle && (
            <button
              onClick={handleDownloadMarkdown}
              className="px-3.5 py-2 bg-[#181816] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Raporu İndir (.MD)
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* =================================================================== */}
        {/* 1. SİTENİN AMACI NEDİR? (HİÇ BİLMEYEN BİRİ İÇİN SADE ANLATIM)        */}
        {/* =================================================================== */}
        <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#C85A17]">
              Bu Araç Ne İşe Yarar?
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#181816] leading-snug">
              Seçtiğiniz Arsanın Gerçek İklim, Rüzgar, Eğim ve Toprak Verilerine Göre Nasıl Bir
              Bina Yapılması Gerektiğini Söyler
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Mimarlık öğrencileri ve tasarımcılar bir projeye başlarken arsanın rüzgarının nereden
              estiğini, güneşin hangi açıyla vurduğunu, arazinin eğimini ve toprağın ne ağırlıkta
              bir binayı taşıyacağını araştırmak zorundadır. Bu site, girdiğiniz konumun{' '}
              <strong>gerçek uydu, meteoroloji ve jeoloji verilerini</strong> canlı çekerek
              tahmine değil <strong>kanıta dayalı</strong> mimari öneriler üretir.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100 text-xs sm:text-sm">
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-[#C85A17]">01. KONUM GİRİN</span>
              <p className="text-stone-600 leading-relaxed">
                İl/ilçe adı yazın (ör. <em>Ankara Yenimahalle</em>), Google Maps linki yapıştırın
                veya haritadan arsanıza tıklayın.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-[#C85A17]">
                02. GERÇEK VERİ ÇEKİLİR
              </span>
              <p className="text-stone-600 leading-relaxed">
                Son 5 yılın gerçek rüzgar/iklim ölçümü (ERA5), uydu arazi eğimi (Copernicus) ve
                zemin/deprem kayıtları sorgulanır.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-[#C85A17]">
                03. MİMARİ REÇETE ÜRETİLİR
              </span>
              <p className="text-stone-600 leading-relaxed">
                Kaç kilo kütleli bina olmalı, avlu/kütle nasıl yerleşmeli, çatı kaç derece eğimli
                olmalı ve hangi malzeme seçilmeli açıklanır.
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 2. SADE KONUM VE BİNA GİRİŞ KUTUSU                                  */}
        {/* =================================================================== */}
        <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-5">
          <h2 className="text-base sm:text-lg font-bold text-[#181816]">
            Çalışacağınız Arsayı ve Bina Türünü Girin
          </h2>

          {/* Konum Satırı */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              Arsa Konumu (Şehir/İlçe Adı, Koordinat veya Google Maps Linki)
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runFullAnalysis();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Örn: Ankara Yenimahalle  veya  https://www.google.com/maps/@39.96,32.81..."
                  className="w-full pl-10 pr-3.5 py-3 bg-[#FAF9F6] border border-stone-300 text-sm focus:outline-none focus:bg-white focus:border-[#181816]"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowMapSelector((v) => !v)}
                className="px-4 py-3 border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <MapPin className="w-4 h-4 text-[#C85A17]" />
                {showMapSelector ? 'Haritayı Kapat' : 'Haritadan Seç'}
              </button>
            </form>

            {/* Hızlı Örnek Konumlar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-stone-500 mr-1">Hızlı dene:</span>
              {QUICK_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setLocationText(ex.query);
                    runFullAnalysis(ex.query);
                  }}
                  className="px-2.5 py-1 text-xs bg-[#F5F4F0] hover:bg-stone-200 text-stone-700 border border-stone-200 transition"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* İnteraktif Harita Seçici (Açıldığında) */}
          {showMapSelector && (
            <div className="space-y-2 pt-1">
              <SiteMapPicker
                lat={pickerCoord.lat}
                lng={pickerCoord.lng}
                onPickCoordinate={(lat, lng) => {
                  setPickerCoord({ lat, lng });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowMapSelector(false);
                  runFullAnalysis(undefined, pickerCoord);
                }}
                className="w-full py-2.5 bg-stone-800 hover:bg-black text-white text-xs font-semibold transition"
              >
                Haritada Seçilen Noktayı ({pickerCoord.lat.toFixed(4)}°K,{' '}
                {pickerCoord.lng.toFixed(4)}°D) Analiz Et
              </button>
            </div>
          )}

          {/* Bina Fonksiyonu ve Metrekare */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                Yapılacak Binanın Fonksiyonu
              </label>
              <select
                value={funcKey}
                onChange={(e) => setFuncKey(e.target.value as BuildingFunctionKey)}
                className="w-full bg-[#FAF9F6] border border-stone-300 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#181816]"
              >
                {FUNCTION_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                <span>Toplam İnşaat Alanı (m²)</span>
                <span className="font-mono text-[#181816]">
                  {targetAreaM2.toLocaleString('tr-TR')} m²
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={600}
                  max={15000}
                  step={200}
                  value={targetAreaM2}
                  onChange={(e) => setTargetAreaM2(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={200}
                  max={50000}
                  step={100}
                  value={targetAreaM2}
                  onChange={(e) =>
                    setTargetAreaM2(Math.max(200, Number(e.target.value) || 1000))
                  }
                  className="w-24 bg-[#FAF9F6] border border-stone-300 px-2.5 py-2 text-sm font-semibold text-right"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-xs sm:text-sm">
              {errorMsg}
            </div>
          )}

          {/* Ana Analiz Butonu */}
          <button
            type="button"
            disabled={loading}
            onClick={() => runFullAnalysis()}
            className="w-full py-3.5 bg-[#181816] hover:bg-stone-800 disabled:opacity-60 text-white text-sm font-bold transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uydu, Meteoroloji (ERA5) ve Zemin Verileri Sorgulanıyor...
              </>
            ) : (
              'Gerçek Verilerle Araziyi Analiz Et ve Mimari Önerileri Göster'
            )}
          </button>
        </section>

        {/* =================================================================== */}
        {/* ANALİZ SONUÇLARI: YALNIZCA KONUM SEÇİLDİĞİNDE SADE VE KANITLI AÇILIR */}
        {/* =================================================================== */}
        {bundle && recommendations.length > 0 && assemblySummary && (
          <ReportSections
            bundle={bundle}
            funcKey={funcKey}
            targetAreaM2={targetAreaM2}
            recommendations={recommendations}
            activeTypologyKey={activeTypologyKey}
            onSelectTypology={(key) => {
              const found = recommendations.find((r) => r.key === key);
              if (found) {
                setActiveTypologyKey(found.key);
                setBlocks(found.blocks.map((b) => ({ ...b })));
                setSelectedBlockId(found.blocks[0]?.id ?? null);
              }
            }}
            blocks={blocks}
            setBlocks={setBlocks}
            selectedBlockId={selectedBlockId}
            setSelectedBlockId={setSelectedBlockId}
            evaluatedMaterials={evaluatedMaterials}
            recommendedMaterialsMap={recommendedMaterialsMap}
            assemblySummary={assemblySummary}
            show3DStudio={show3DStudio}
            setShow3DStudio={setShow3DStudio}
            season={season}
            setSeason={setSeason}
            solarHour={solarHour}
            setSolarHour={setSolarHour}
            exportTrigger={exportTrigger}
            setExportTrigger={setExportTrigger}
          />
        )}
      </main>
    </div>
  );
};

/* ============================================================================
 * ALT BİLEŞEN: DOĞRULANMIŞ MİMARİ ANALİZ RAPORU (SADE, AKICI VE KANITLI)
 * ========================================================================== */
interface ReportSectionsProps {
  bundle: VerifiedSiteBundle;
  funcKey: BuildingFunctionKey;
  targetAreaM2: number;
  recommendations: ReturnType<typeof generateTypologyRecommendations>;
  activeTypologyKey: MassTypologyKey;
  onSelectTypology: (k: MassTypologyKey) => void;
  blocks: MassBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<MassBlock[]>>;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  evaluatedMaterials: ReturnType<typeof evaluateMaterialsForProject>;
  recommendedMaterialsMap: Record<MaterialCategoryKey, string>;
  assemblySummary: NonNullable<ReturnType<typeof calculateAssemblySummary>>;
  show3DStudio: boolean;
  setShow3DStudio: (v: boolean) => void;
  season: SeasonKey;
  setSeason: (s: SeasonKey) => void;
  solarHour: number;
  setSolarHour: (h: number) => void;
  exportTrigger: number;
  setExportTrigger: React.Dispatch<React.SetStateAction<number>>;
}

const ReportSections: React.FC<ReportSectionsProps> = ({
  bundle,
  funcKey,
  targetAreaM2,
  recommendations,
  activeTypologyKey,
  onSelectTypology,
  blocks,
  setBlocks,
  selectedBlockId,
  setSelectedBlockId,
  evaluatedMaterials,
  recommendedMaterialsMap,
  assemblySummary,
  show3DStudio,
  setShow3DStudio,
  season,
  setSeason,
  solarHour,
  setSolarHour,
  exportTrigger,
  setExportTrigger,
}) => {
  const city = bundle.cityProfile;
  const tp = bundle.topography;
  const sm = bundle.soilAndMass;
  const ce = bundle.climateEvidence;
  const prog = BUILDING_PROGRAMS[funcKey];

  const activeRec =
    recommendations.find((r) => r.key === activeTypologyKey) || recommendations[0];
  const currentBlocks = blocks.length > 0 ? blocks : activeRec.blocks;
  const activeBlock =
    currentBlocks.find((b) => b.id === selectedBlockId) || currentBlocks[0];

  const solarSum = getSeasonalSolarSummary(
    city.lat,
    season,
    city.seasons[season].directRadiationWm2,
    city.seasons[season].diffuseRadiationWm2
  );
  const summerShadow = calculateSolarPosition(city.lat, 172, 12).shadowMultiplier;
  const winterShadow = calculateSolarPosition(city.lat, 355, 12).shadowMultiplier;

  const optRoof = recommendOptimalRoofForBlock(activeBlock, city, funcKey);
  const roofPerf = analyzeBlockRoofPerformance(activeBlock, city);

  const minBuildingTons = Math.round((sm.recommendedUnitMassKgM2.min * targetAreaM2) / 1000);
  const maxBuildingTons = Math.round((sm.recommendedUnitMassKgM2.max * targetAreaM2) / 1000);
  const heavyBuildingTons = Math.round((sm.conventionalConcreteMassKgM2 * targetAreaM2) / 1000);

  const activeWallColor =
    evaluatedMaterials.find((e) => e.material.id === recommendedMaterialsMap.envelope_wall)
      ?.material.colorHex ?? '#D6D3C9';
  const activeRoofColor =
    evaluatedMaterials.find((e) => e.material.id === recommendedMaterialsMap.roof_finish)
      ?.material.colorHex ?? '#334155';

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* YÖNETİCİ ÖZETİ + DOĞRULANMIŞ HARİTA NOKTASI                            */}
      {/* ===================================================================== */}
      <section className="bg-white border-2 border-[#181816] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#15803D]">
              <ShieldCheck className="w-4 h-4" /> Gerçek Verilerle Doğrulanmış Arazi Özeti
            </div>
            <h2 className="text-xl font-bold text-[#181816] mt-1">{bundle.shortTitle}</h2>
            <p className="text-xs text-stone-500 mt-0.5">{bundle.displayAddress}</p>
          </div>
          <div className="font-mono text-xs bg-[#F8F8F6] border border-stone-200 px-3 py-2 shrink-0">
            <div>Enlem: {city.lat.toFixed(4)}°K</div>
            <div>Boylam: {city.lng.toFixed(4)}°D</div>
            <div>Rakım: {tp.elevationM} m</div>
          </div>
        </div>

        {/* Sade Dil Özeti: Bu Arsada Ne Yapılmalı? */}
        <div className="bg-[#FAF9F5] border border-stone-200 p-4 sm:p-5 space-y-2.5 text-sm leading-relaxed text-stone-800">
          <div className="font-bold text-[#181816]">
            Kısaca Bu Arsaya Nasıl Bir Bina Yapılmalı?
          </div>
          <p>
            <strong>1. Rüzgar ve Yönelim:</strong> Son 5 yılın gerçek ölçümlerine göre bu noktada
            yazın hakim rüzgar{' '}
            <strong>
              {ce.seasonalWindTop.summer[0]?.name} (%{ce.seasonalWindTop.summer[0]?.frequencyPct})
            </strong>
            , kışın ise{' '}
            <strong>
              {ce.seasonalWindTop.winter[0]?.name} (%{ce.seasonalWindTop.winter[0]?.frequencyPct})
            </strong>{' '}
            yönünden esmektedir. Yaşam odaları güneye, servis alanları soğuk rüzgar yönüne
            yerleştirilmelidir.
          </p>
          <p>
            <strong>2. Arazi Eğimi ve Bina Ağırlığı (Kütle):</strong> Arsa{' '}
            <strong>%{tp.slopePct} eğime</strong> ({tp.landformType}) ve{' '}
            <strong>{sm.soilTypeTitle}</strong> zemin yapısına sahiptir. Deprem ve zemin güvenliği
            için binanın m² ağırlığı klasik ağır binalardaki ~1.280 kg/m² yerine{' '}
            <strong>
              {sm.recommendedUnitMassKgM2.min}–{sm.recommendedUnitMassKgM2.max} kg/m²
            </strong>{' '}
            aralığında ({targetAreaM2.toLocaleString('tr-TR')} m² için toplam{' '}
            <strong>
              {minBuildingTons.toLocaleString('tr-TR')}–{maxBuildingTons.toLocaleString('tr-TR')} ton
            </strong>
            ) tutulmalı ve <strong>{sm.recommendedFoundation}</strong> uygulanmalıdır.
          </p>
          <p>
            <strong>3. Kütle, Avlu ve Çatı:</strong> {prog.title} için en uygun yerleşim{' '}
            <strong>{activeRec.name}</strong> ({activeRec.courtyardAreaM2} m² avlu) ve çatıda{' '}
            <strong>
              {optRoof.roofPitchDeg}° eğimli {ROOF_TYPES_META[optRoof.roofType].shortName}
            </strong>{' '}
            ile <strong>{optRoof.overhangSouthM} m</strong> güney saçağıdır.
          </p>
        </div>

        <SiteMapPicker lat={city.lat} lng={city.lng} interactivePick={false} heightClass="h-52" />
      </section>

      {/* ===================================================================== */}
      {/* BÖLÜM 1: GERÇEK RÜZGAR, GÜNEŞ VE 4 MEVSİM İKLİM KANITLARI              */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="border-b border-stone-200 pb-3">
          <span className="font-mono text-xs font-bold text-[#C85A17]">BÖLÜM 01 · İKLİM VE RÜZGAR</span>
          <h3 className="text-lg font-bold text-[#181816] mt-0.5">
            Rüzgar Nereden Esiyor? Güneş ve Mevsimler Nasıl?
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Kaynak: {ce.sourceName} — {ce.periodLabel} ({ce.daysAnalyzed} günlük gerçek ölçüm)
          </p>
        </div>

        {/* Gerçek 8 Yönlü Yıllık Rüzgar Dağılımı */}
        <div className="space-y-3">
          <div className="text-sm font-bold text-[#181816] flex items-center gap-2">
            <Wind className="w-4 h-4 text-sky-700" />
            Yıllık Gerçek Rüzgar Esme Yönleri ve Yüzdeleri (Maks. Fırtına Hamlesi:{' '}
            {ce.maxWindGustKmh} km/sa)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ce.annualWindRose.slice(0, 6).map((w) => (
              <div
                key={w.code}
                className="bg-[#FAF9F6] border border-stone-200 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <span className="font-semibold text-[#181816] w-40 shrink-0">{w.name}</span>
                <div className="flex-1 h-2 bg-stone-200 overflow-hidden">
                  <div
                    className="h-full bg-sky-700"
                    style={{ width: `${Math.min(100, w.frequencyPct * 1.6)}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-[#181816] w-10 text-right">
                  %{w.frequencyPct}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4 Mevsim Tablosu */}
        <div className="overflow-x-auto border border-stone-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF9F6] border-b border-stone-200 text-xs text-stone-600">
              <tr>
                <th className="py-2.5 px-3.5">Mevsim</th>
                <th className="py-2.5 px-3.5">Ort. Sıcaklık (Gece/Gündüz)</th>
                <th className="py-2.5 px-3.5">Hakim Rüzgar Yönü & Hızı</th>
                <th className="py-2.5 px-3.5">Nem & Yağış</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {SEASON_META.map((smItem) => {
                const st = city.seasons[smItem.key];
                const topW = ce.seasonalWindTop[smItem.key];
                return (
                  <tr key={smItem.key}>
                    <td className="py-2.5 px-3.5 font-bold text-[#181816]">{smItem.label}</td>
                    <td className="py-2.5 px-3.5">
                      <strong>{st.avgTempC}°C</strong>{' '}
                      <span className="text-stone-500 text-xs">
                        ({st.minTempC}° / {st.maxTempC}°C)
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <strong>
                        {topW[0]?.name} (%{topW[0]?.frequencyPct})
                      </strong>{' '}
                      <span className="text-stone-500 text-xs">· {st.windSpeedMs} m/s</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-xs">
                      %{st.humidityPct} nem · {st.precipitationMm} mm yağış
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Güneş Açısı ve Gölge Özeti */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FAF9F6] border border-stone-200 p-4 text-xs">
          <div>
            <span className="text-stone-500 block">Yaz Öğle Güneşi (21 Haziran)</span>
            <strong className="text-sm text-[#181816] flex items-center gap-1 mt-0.5">
              <Sun className="w-4 h-4 text-amber-600" /> {solarSum.summerNoonAltDeg}° Dik Açı
            </strong>
            <span className="text-stone-600 block mt-1">
              Gölge boyu bina yüksekliğinin <strong>{summerShadow.toFixed(2)} katıdır</strong>.
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Kış Öğle Güneşi (21 Aralık)</span>
            <strong className="text-sm text-[#181816] flex items-center gap-1 mt-0.5">
              <Sun className="w-4 h-4 text-[#C85A17]" /> {solarSum.winterNoonAltDeg}° Eğik Açı
            </strong>
            <span className="text-stone-600 block mt-1">
              Kışın gölge bina boyunun <strong>{winterShadow.toFixed(1)} katına</strong> uzar.
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">5 Yıllık Uç Değerler & Güneş</span>
            <strong className="text-sm text-[#181816] block mt-0.5">
              {ce.recordMinTempC}°C / +{ce.recordMaxTempC}°C
            </strong>
            <span className="text-stone-600 block mt-1">
              Yıllık Güneş: <strong>{ce.annualSolarKwhM2} kWh/m²</strong> · Kar: {ce.annualSnowCm} cm
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* BÖLÜM 2: TOPOĞRAFYA, TOPRAK/ZEMİN VE KAÇ KİLO KÜTLELİ BİNA OLMALI?    */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="border-b border-stone-200 pb-3">
          <span className="font-mono text-xs font-bold text-[#C85A17]">
            BÖLÜM 02 · TOPOĞRAFYA, TOPRAK YAPISI VE BİNA AĞIRLIĞI
          </span>
          <h3 className="text-lg font-bold text-[#181816] mt-0.5">
            Arazi Eğimi ve Toprak Yapısına Göre Nasıl ve Kaç Kilo Kütleli Bina Yapılmalı?
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Kaynaklar: {tp.sourceName} · {sm.sources[0]} · {sm.sources[1]}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
          {/* Topoğrafya Kutusu */}
          <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-2.5">
            <div className="font-bold text-[#181816] flex items-center gap-2">
              <Mountain className="w-4 h-4 text-[#C85A17]" />
              Uydu Topoğrafya ve Eğim Ölçümü
            </div>
            <div className="text-xs space-y-1 text-stone-700">
              <div>
                <strong>Merkez Rakım:</strong> {tp.elevationM} m (100m çevrede Kuzey:{' '}
                {tp.neighbors100m.northM}m, Güney: {tp.neighbors100m.southM}m, Doğu:{' '}
                {tp.neighbors100m.eastM}m, Batı: {tp.neighbors100m.westM}m)
              </div>
              <div>
                <strong>Hesaplanan Eğim:</strong> %{tp.slopePct} ({tp.slopeDeg}°) —{' '}
                <strong>{tp.landformType}</strong>
              </div>
              <div>
                <strong>Yamaç Yönü (Bakı):</strong> {tp.aspectLabel}
              </div>
            </div>
            <p className="text-xs text-stone-600 pt-1 border-t border-stone-200 leading-relaxed">
              {tp.architecturalGuidance.join(' ')}
            </p>
          </div>

          {/* Zemin & Deprem Kutusu */}
          <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-2.5">
            <div className="font-bold text-[#181816] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#181816]" />
              Bölgesel Toprak / Jeoloji ve Deprem Kaydı
            </div>
            <div className="text-xs space-y-1 text-stone-700">
              <div>
                <strong>Jeolojik Birim:</strong> {sm.geologicAgeTr} ({sm.geologicUnitRaw})
              </div>
              <div>
                <strong>Zemin Karakteri:</strong> {sm.soilTypeTitle} (Tahmini TBDY 2018:{' '}
                <strong>{sm.estimatedTbdyClass}</strong>)
              </div>
              <div>
                <strong>100 km Çevrede Gerçek Deprem (1970–2025):</strong> M≥4.5 büyüklüğünde{' '}
                <strong>{sm.seismicCount100km} deprem</strong> (En büyük:{' '}
                <strong>M {sm.maxHistoricalMag || '<4.5'}</strong> — {sm.seismicHazardLevel})
              </div>
            </div>
            <p className="text-xs text-stone-600 pt-1 border-t border-stone-200 leading-relaxed">
              {sm.soilDescription}
            </p>
          </div>
        </div>

        {/* Bina Kütlesi (kg/m² ve Toplam Ton) ve Temel Önerisi */}
        <div className="bg-[#FAF9F5] border-l-4 border-[#181816] p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
          <div className="font-bold text-[#181816]">
            Toprak ve Deprem Verisine Göre Önerilen Bina Kütlesi (Ağırlığı) ve Temel Sistemi
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-stone-200 p-3.5 text-xs">
            <div>
              <span className="text-stone-500 block">Önerilen Birim Bina Kütlesi</span>
              <strong className="text-base text-[#15803D]">
                {sm.recommendedUnitMassKgM2.min} – {sm.recommendedUnitMassKgM2.max} kg/m²
              </strong>
              <span className="text-stone-500 block mt-0.5">
                (Klasik ağır betonarme: ~{sm.conventionalConcreteMassKgM2} kg/m²)
              </span>
            </div>
            <div>
              <span className="text-stone-500 block">
                {targetAreaM2.toLocaleString('tr-TR')} m² Bina Toplam Kütlesi
              </span>
              <strong className="text-base text-[#181816]">
                {minBuildingTons.toLocaleString('tr-TR')} – {maxBuildingTons.toLocaleString('tr-TR')}{' '}
                ton
              </strong>
              <span className="text-stone-500 block mt-0.5">
                (Klasik ağır sistemde: ~{heavyBuildingTons.toLocaleString('tr-TR')} ton)
              </span>
            </div>
            <div>
              <span className="text-stone-500 block">Önerilen Temel Tipi</span>
              <strong className="text-xs text-[#181816] block mt-0.5 leading-snug">
                {sm.recommendedFoundation}
              </strong>
            </div>
          </div>

          <div className="text-xs text-stone-700 space-y-1.5 leading-relaxed">
            <div>
              <strong>Önerilen Taşıyıcı Sistem:</strong> {sm.recommendedStructure}
            </div>
            {sm.buildingSoilRules.map((rule, idx) => (
              <div key={idx}>• {rule}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* BÖLÜM 3: OPTİMAL BİNA KÜTLESİ, AVLU VE ODA METREKARE YERLEŞİMİ        */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="border-b border-stone-200 pb-3">
          <span className="font-mono text-xs font-bold text-[#C85A17]">
            BÖLÜM 03 · KÜTLE, AVLU VE MEKAN DAĞILIMI
          </span>
          <h3 className="text-lg font-bold text-[#181816] mt-0.5">
            {prog.title} ({targetAreaM2.toLocaleString('tr-TR')} m²) İçin En Uygun Kütle ve Avlu
            Yerleşimi
          </h3>
        </div>

        <div className="bg-[#FAF9F6] border border-stone-300 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#15803D]">EN YÜKSEK UYUMLU KÜTLE ŞEKLİ</span>
              <h4 className="text-lg font-bold text-[#181816]">{activeRec.name}</h4>
            </div>
            <div className="text-sm font-bold text-[#181816]">
              Uyum Skoru: %{activeRec.totalScore} · Avlu: {activeRec.courtyardAreaM2} m² (
              {activeRec.courtyardRatioHW})
            </div>
          </div>

          <div className="space-y-1 text-xs sm:text-sm text-stone-700 leading-relaxed">
            {activeRec.rationale.map((r, i) => (
              <p key={i}>• {r}</p>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap gap-1.5">
            {recommendations.slice(0, 4).map((r, idx) => (
              <button
                key={r.key}
                onClick={() => onSelectTypology(r.key)}
                className={`px-3 py-1.5 text-xs font-semibold border transition ${
                  r.key === activeTypologyKey
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-[#181816]'
                }`}
              >
                {idx + 1}. {r.name} (%{r.totalScore})
              </button>
            ))}
          </div>
        </div>

        {/* Mekanların Metrekare ve Cephe Yönelimi */}
        <div className="overflow-x-auto border border-stone-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF9F6] border-b border-stone-200 text-xs text-stone-600">
              <tr>
                <th className="py-2.5 px-3.5">Mekan / Oda Grubu</th>
                <th className="py-2.5 px-3.5">Alan (m²)</th>
                <th className="py-2.5 px-3.5">Bakması Gereken Yön</th>
                <th className="py-2.5 px-3.5">Gerekçe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {prog.spaces.map((sp) => (
                <tr key={sp.id}>
                  <td className="py-2.5 px-3.5 font-semibold text-[#181816]">{sp.name}</td>
                  <td className="py-2.5 px-3.5 font-mono font-semibold whitespace-nowrap">
                    {Math.round((targetAreaM2 * sp.ratioPct) / 100).toLocaleString('tr-TR')} m²
                  </td>
                  <td className="py-2.5 px-3.5 font-semibold text-[#C85A17] whitespace-nowrap">
                    {sp.preferredOrientation}
                  </td>
                  <td className="py-2.5 px-3.5 text-xs text-stone-600">{sp.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* BÖLÜM 4: ÇATI EĞİM AÇISI VE YEREL SÜRDÜRÜLEBİLİR MALZEMELER            */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="border-b border-stone-200 pb-3">
          <span className="font-mono text-xs font-bold text-[#C85A17]">
            BÖLÜM 04 · ÇATI AÇISI VE YEREL MALZEME SEÇİMİ
          </span>
          <h3 className="text-lg font-bold text-[#181816] mt-0.5">
            Güneş Açısına Göre Çatı Eğimi ve Lokasyona Yakın Sürdürülebilir Malzemeler
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Kaynak: TS 825 Binalarda Isı Yalıtım Kuralları (Bölge {city.ts825Zone} Sınır U ≤{' '}
            {assemblySummary.ts825WallLimit} W/m²K) & Bölgesel Üretim Mesafeleri
          </p>
        </div>

        {/* Çatı Önerisi Özeti */}
        <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-1.5 text-xs sm:text-sm">
          <div className="font-bold text-[#181816] flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#C85A17]" />
            Önerilen Çatı Tasarımı: {ROOF_TYPES_META[optRoof.roofType].name}
          </div>
          <p className="text-stone-700 leading-relaxed">{optRoof.reasoning}</p>
          <div className="flex flex-wrap gap-4 pt-1 font-mono text-xs text-stone-700">
            <span>
              Önerilen Çatı Eğimi: <strong>{optRoof.roofPitchDeg}°</strong>
            </span>
            <span>
              Güney Saçak Uzantısı: <strong>{optRoof.overhangSouthM} m</strong>
            </span>
            <span>
              Kış Güneşi Odaya Giriş Derinliği: <strong>{roofPerf.winterSunPenetrationM} m</strong>
            </span>
          </div>
        </div>

        {/* Yerel Malzeme Tablosu */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {(Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategoryKey[]).map((cat) => {
            const ev = evaluatedMaterials.find(
              (m) => m.material.id === recommendedMaterialsMap[cat]
            );
            if (!ev) return null;
            return (
              <div key={cat} className="border border-stone-200 p-4 space-y-2 bg-white">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  {MATERIAL_CATEGORY_LABELS[cat]}
                </div>
                <div className="text-sm font-bold text-[#181816]">{ev.material.name}</div>
                <p className="text-stone-600 leading-relaxed">{ev.material.architecturalNote}</p>
                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-stone-600">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#C85A17]" />
                    <strong>{ev.material.originCity}</strong> (~{ev.distanceKm} km)
                  </span>
                  <span>Uygulama: {ev.material.localCraftAvailability}</span>
                  <span className="text-[#15803D] font-semibold">
                    %{ev.material.recyclabilityPct} geri dönüşüm
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* BÖLÜM 5: İSTEĞE BAĞLI 3D KÜTLE VE ÇATI SİMÜLASYONU EKLENTİSİ           */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200">
        <button
          type="button"
          onClick={() => setShow3DStudio(!show3DStudio)}
          className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-stone-50 transition"
        >
          <div>
            <span className="font-mono text-xs font-bold text-[#C85A17]">
              EKLENTİ · ETKİLEŞİMLİ 3D GÖRÜNÜM
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#181816] mt-0.5">
              3D Bina Kütlesi Ekle, Çatı Açısını ve Güneş Gölgelerini Canlı Test Et
            </h3>
          </div>
          {show3DStudio ? (
            <ChevronUp className="w-5 h-5 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 shrink-0" />
          )}
        </button>

        {show3DStudio && (
          <div className="p-6 pt-2 border-t border-stone-200 space-y-5">
            {/* Üst 3D Kontrolleri */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F6] border border-stone-200 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {SEASON_META.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSeason(s.key)}
                    className={`px-3 py-1.5 font-semibold border ${
                      season === s.key
                        ? 'bg-[#181816] text-white border-[#181816]'
                        : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <div className="flex items-center gap-2 pl-2">
                  <span>Saat:</span>
                  <input
                    type="range"
                    min={6}
                    max={19}
                    step={0.25}
                    value={solarHour}
                    onChange={(e) => setSolarHour(Number(e.target.value))}
                    className="w-28"
                  />
                  <strong className="font-mono">{Math.floor(solarHour)}:00</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextBlk: MassBlock = {
                      ...activeBlock,
                      id: `ek_${Date.now().toString().slice(-4)}`,
                      label: `Ek Kütle #${currentBlocks.length + 1}`,
                      x: 0,
                      z: 0,
                    };
                    setBlocks([...currentBlocks, nextBlk]);
                    setSelectedBlockId(nextBlk.id);
                  }}
                  className="px-3 py-1.5 bg-[#181816] text-white font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 3D Kütle Ekle
                </button>
                <button
                  onClick={() => setExportTrigger((n) => n + 1)}
                  className="px-3 py-1.5 bg-white border border-stone-300 font-semibold flex items-center gap-1"
                >
                  <Box className="w-3.5 h-3.5 text-[#C85A17]" /> 3D .OBJ İndir
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 h-[430px]">
                <Viewport3D
                  city={city}
                  season={season}
                  dayOfYear={SEASON_REPRESENTATIVE_DOY[season].doy}
                  solarHour={solarHour}
                  onChangeSolarHour={setSolarHour}
                  site={DEFAULT_SITE}
                  blocks={currentBlocks}
                  neighbors={EMPTY_NEIGHBORS}
                  selectedBlockId={activeBlock.id}
                  onSelectBlock={(id) => {
                    if (id) setSelectedBlockId(id);
                  }}
                  globalOrientationDeg={activeRec.recommendedOrientationDeg}
                  courtyardAreaM2={activeRec.courtyardAreaM2}
                  activeMaterialWallColor={activeWallColor}
                  activeMaterialRoofColor={activeRoofColor}
                  exportTrigger={exportTrigger}
                />
              </div>

              <div className="lg:col-span-4 bg-[#FAF9F6] border border-stone-200 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-[#181816]">Seçili Kütle ve Çatı Ayarı</strong>
                  {currentBlocks.length > 1 && (
                    <button
                      onClick={() => {
                        const rem = currentBlocks.filter((b) => b.id !== activeBlock.id);
                        setBlocks(rem);
                        setSelectedBlockId(rem[0]?.id ?? null);
                      }}
                      className="text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Sil
                    </button>
                  )}
                </div>

                <select
                  value={activeBlock.id}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  className="w-full bg-white border border-stone-300 px-2.5 py-2 font-semibold"
                >
                  {currentBlocks.map((b, i) => (
                    <option key={b.id} value={b.id}>
                      {i + 1}. {b.label} ({b.floors} Kat)
                    </option>
                  ))}
                </select>

                <div>
                  <label className="block text-stone-600 mb-1">Çatı Tipi</label>
                  <select
                    value={activeBlock.roofType}
                    onChange={(e) => {
                      const rt = e.target.value as RoofTypeKey;
                      setBlocks(
                        currentBlocks.map((b) =>
                          b.id === activeBlock.id ? { ...b, roofType: rt } : b
                        )
                      );
                    }}
                    className="w-full bg-white border border-stone-300 px-2.5 py-2 font-semibold"
                  >
                    {ROOF_OPTIONS.map((ro) => (
                      <option key={ro.key} value={ro.key}>
                        {ro.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex justify-between mb-1">
                    <span>Çatı Eğim Açısı</span>
                    <strong>{activeBlock.roofPitchDeg}°</strong>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={45}
                    value={activeBlock.roofPitchDeg}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setBlocks(
                        currentBlocks.map((b) =>
                          b.id === activeBlock.id ? { ...b, roofPitchDeg: v } : b
                        )
                      );
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="flex justify-between mb-1">
                    <span>Güney Saçak Uzantısı</span>
                    <strong>{activeBlock.overhangSouthM} m</strong>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={activeBlock.overhangSouthM}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setBlocks(
                        currentBlocks.map((b) =>
                          b.id === activeBlock.id ? { ...b, overhangSouthM: v } : b
                        )
                      );
                    }}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="flex justify-between mb-1">
                      <span>Kat Sayısı</span>
                      <strong>{activeBlock.floors}</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={activeBlock.floors}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setBlocks(
                          currentBlocks.map((b) =>
                            b.id === activeBlock.id ? { ...b, floors: v } : b
                          )
                        );
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="flex justify-between mb-1">
                      <span>Konum X</span>
                      <strong>{activeBlock.x}m</strong>
                    </label>
                    <input
                      type="range"
                      min={-35}
                      max={35}
                      value={activeBlock.x}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setBlocks(
                          currentBlocks.map((b) =>
                            b.id === activeBlock.id ? { ...b, x: v } : b
                          )
                        );
                      }}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* BÖLÜM 6: AÇIK VE DOĞRULANABİLİR BİLİMSEL VERİ KAYNAKLARI              */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200 p-6 space-y-3 text-xs text-stone-600">
        <div className="font-bold text-sm text-[#181816]">
          Veri Doğrulama ve Bilimsel Kaynakça (Bu Konum İçin Teyit Linkleri)
        </div>
        <p>
          Bu rapordaki hiçbir iklim, rüzgar, rakım, eğim veya deprem verisi rastgele üretilmemiştir;
          aşağıdaki uluslararası ve ulusal mühendislik kaynaklarından{' '}
          <strong>
            ({city.lat.toFixed(4)}°K, {city.lng.toFixed(4)}°D)
          </strong>{' '}
          koordinatı için canlı hesaplanmıştır:
        </p>
        <ul className="space-y-1.5">
          <li>
            1. <strong>Meteoroloji ve Rüzgar Yönü Serisi:</strong> ECMWF ERA5 Küresel Yeniden Analiz
            Veri Seti (2020–2024, 1.827 gün) —{' '}
            <a
              href={`https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat.toFixed(
                4
              )}&longitude=${city.lng.toFixed(
                4
              )}&start_date=2024-01-01&end_date=2024-12-31&daily=temperature_2m_mean,wind_direction_10m_dominant,wind_speed_10m_mean`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham ERA5 Verisini Görüntüle <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            2. <strong>Topoğrafya, Rakım ve Eğim:</strong> Copernicus DEM GLO-90 Uydu Sayısal
            Yükselti Modeli —{' '}
            <a
              href={`https://www.openstreetmap.org/?mlat=${city.lat.toFixed(
                5
              )}&mlon=${city.lng.toFixed(5)}#map=15/${city.lat.toFixed(5)}/${city.lng.toFixed(5)}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              OpenStreetMap Konumunu Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            3. <strong>Jeolojik Birim ve Zemin Karakteri:</strong> Macrostrat Jeolojik Harita API
            (MTA 1/500.000 Türkiye Jeoloji Haritası Birimleriyle Uyumlu) —{' '}
            <a
              href={`https://macrostrat.org/api/v2/geologic_units/map?lat=${city.lat.toFixed(
                4
              )}&lng=${city.lng.toFixed(4)}&response=long`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham Jeoloji Verisini Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            4. <strong>Bölgesel Deprem Kayıtları ve Bina Kütlesi İlkeleri:</strong> USGS Earthquake
            Hazards Program Kataloğu (1970–2025, 100 km yarıçap) & AFAD TBDY 2018 (Türkiye Bina
            Deprem Yönetmeliği) —{' '}
            <a
              href={`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${city.lat.toFixed(
                4
              )}&longitude=${city.lng.toFixed(4)}&maxradiuskm=100&minmagnitude=4.5&starttime=1970-01-01`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham USGS Sismik Kayıtlarını Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            5. <strong>Isı Yalıtımı, Güneş Açı ve Malzeme Standartları:</strong> TS 825 Binalarda Isı
            Yalıtım Kuralları Standardı, NOAA Güneş Konumu Denklemleri ve ICE v3 Yapı Malzemeleri
            Yaşam Döngüsü Karbon Veritabanı.
          </li>
        </ul>
      </section>
    </div>
  );
};

export default App;
