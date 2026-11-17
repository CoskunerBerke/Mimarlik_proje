import React, { useEffect, useMemo, useState } from 'react';
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
import { BUILDING_FUNCTION_GROUPS, BUILDING_PROGRAMS } from './data/programs';
import {
  calculateSolarPosition,
  getSeasonalSolarSummary,
  SEASON_REPRESENTATIVE_DOY,
} from './engine/solarEngine';
import {
  computeSoilMassRecommendation,
  fetchVerifiedSiteBundle,
  LocationSuggestion,
  resolveLocationInput,
  reverseGeocodeCoordinates,
  searchLocationSuggestions,
  VerifiedSiteBundle,
} from './engine/realSiteAnalyzer';
import { generateTypologyRecommendations } from './engine/massingEngine';
import {
  buildRealisticArchitecturalMassing,
  FUNCTION_DESIGN_PRESETS,
} from './engine/buildingGenerator';
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
import { TerrainSoil3DBlock } from './components/TerrainSoil3DBlock';
import { Viewport3D } from './components/Viewport3D';
import { InteractiveBuildingDesigner } from './components/InteractiveBuildingDesigner';
import {
  createSampleProjectFile,
  importArchitectProjectFile,
  Imported3DModelData,
  PlanUnderlayData,
  renderPdfProjectPage,
} from './engine/projectFileImporter';
import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  PenTool,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  Sun,
  Trash2,
  Truck,
  Wind,
  X,
} from 'lucide-react';

export type StudioDesignMode = 'auto' | 'upload' | 'custom_build';

const DEFAULT_SITE: SiteParameters = {
  parcelWidthM: 68,
  parcelDepthM: 58,
  slopeDeg: 2,
  slopeAspect: 'Güney',
  maxTaks: 0.45,
  maxKaks: 1.8,
  setbackM: 5,
};

const EMPTY_NEIGHBORS: NeighborContextBlock[] = [];

const DEFAULT_AREA_BY_FUNCTION: Record<BuildingFunctionKey, number> = {
  villa: 340,
  kindergarten: 950,
  atelier: 1100,
  religious: 1250,
  agro: 1500,
  library: 2200,
  commercial: 2400,
  custom: 2500,
  residential: 2800,
  sports: 2800,
  hotel: 3000,
  public_gov: 3200,
  cultural: 3400,
  dormitory: 3600,
  education: 3800,
  office: 4200,
  transport: 4200,
  mixed: 4500,
  industrial: 4800,
  healthcare: 5200,
};

const PROMPT_PLACEHOLDER_BY_FUNCTION: Partial<Record<BuildingFunctionKey, string>> = {
  education:
    'Örn: 4 katlı, L şeklinde, yanında kapalı spor salonu ve havuzu olan, tuğla cepheli lise...',
  religious:
    'Örn: Merkezi kubbeli, çift minareli, revaklı şadırvan avlusu olan doğal taş cami...',
  villa:
    'Örn: 2 katlı, L planlı, güney terasında yüzme havuzu olan, taş ve ahşap cepheli müstakil ev...',
  residential:
    'Örn: 5 katlı, geniş güney balkonlu, ortasında ortak bahçe avlusu olan tuğla cepheli konut...',
  healthcare:
    'Örn: 2 katlı poliklinik bazası üzerinde 5 katlı yatak bloğu ve şifa avlusu olan hastane...',
  sports:
    'Örn: Geniş açıklıklı tonoz kemer çatılı kapalı spor salonu ve yüzme havuzu kompleksi...',
};

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
  { key: 'dome', label: 'Merkezi Kubbe + Kasnak Pencereleri (Cami / Anıtsal)' },
  { key: 'barrel_vault', label: 'Geniş Açıklıklı Tonoz / Kemer Çatı (Spor / Salon)' },
  { key: 'sawtooth', label: 'Testere Dişi Kuzey Işıklığı (Sawtooth)' },
  { key: 'mono_pitch', label: 'Tek Eğimli Güneş Çatısı' },
  { key: 'asymmetric_gable', label: 'Asimetrik İklim Çatısı' },
  { key: 'gable', label: 'Simetrik Beşik Çatı' },
  { key: 'flat_green', label: 'Yeşil Teras Çatı + Işık Feneri' },
  { key: 'butterfly', label: 'Kelebek (V-Kesit) Çatı' },
  { key: 'louver_canopy', label: 'Güneş Kırıcı Pergola Çatı' },
];

export const App: React.FC = () => {
  // Giriş Formu ve Tam Konum Kilidi Durumu
  const [locationText, setLocationText] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lockedLocation, setLockedLocation] = useState<{
    lat: number;
    lng: number;
    shortTitle: string;
    displayAddress: string;
  } | null>(null);

  const [showMapSelector, setShowMapSelector] = useState(false);
  const [pickerCoord, setPickerCoord] = useState<{ lat: number; lng: number }>({
    lat: 39.9334,
    lng: 32.8597,
  });

  // Bina Türü, Alanı ve "Nasıl Bir Bina İstiyorsunuz?" Özelleştirme İsteği
  const [funcKey, setFuncKey] = useState<BuildingFunctionKey>('education');
  const [customFuncTitle, setCustomFuncTitle] = useState<string>('');
  const [targetAreaM2, setTargetAreaM2] = useState<number>(3800);
  const [userBuildingPrompt, setUserBuildingPrompt] = useState<string>('');

  // Canlı Analiz Durumu
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bundle, setBundle] = useState<VerifiedSiteBundle | null>(null);

  // 3D Simülasyon, Proje Dosyası Yükleme ve Kendi Binanı Tasarlama Durumu
  const [show3DStudio, setShow3DStudio] = useState(true);
  const [studioMode, setStudioMode] = useState<StudioDesignMode>('auto');
  const [planUnderlay, setPlanUnderlay] = useState<PlanUnderlayData | null>(null);
  const [imported3DModel, setImported3DModel] = useState<Imported3DModelData | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [season, setSeason] = useState<SeasonKey>('summer');
  const [solarHour, setSolarHour] = useState<number>(13.0);
  const [activeTypologyKey, setActiveTypologyKey] = useState<MassTypologyKey>('u_court');
  const [blocks, setBlocks] = useState<MassBlock[]>([]);
  const [generatedCourtyardM2, setGeneratedCourtyardM2] = useState<number>(320);
  const [generatedOrientationDeg, setGeneratedOrientationDeg] = useState<number>(10);
  const [appliedPromptNotes, setAppliedPromptNotes] = useState<string[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [exportTrigger, setExportTrigger] = useState(0);

  // Canlı Konum Otomatik Tamamlama (Yanlış yan mahalleyi alma sorununu önler)
  useEffect(() => {
    const q = locationText.trim();
    if (
      q.length < 2 ||
      /^https?:\/\//i.test(q) ||
      (lockedLocation && lockedLocation.shortTitle === q)
    ) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const list = await searchLocationSuggestions(q);
      setSuggestions(list);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [locationText, lockedLocation]);

  // Otomatik moddayken bina türü, metrekare veya açıklama değiştiğinde 3D binayı ANINDA yenile!
  useEffect(() => {
    if (!bundle || studioMode !== 'auto') return;
    const generated = buildRealisticArchitecturalMassing(
      funcKey,
      bundle.cityProfile,
      targetAreaM2,
      userBuildingPrompt
    );
    setBlocks(generated.blocks);
    setGeneratedCourtyardM2(generated.courtyardAreaM2);
    setGeneratedOrientationDeg(generated.orientationDeg);
    setAppliedPromptNotes(generated.appliedNotes);
    setSelectedBlockId(generated.blocks[0]?.id ?? null);
  }, [bundle, funcKey, targetAreaM2, userBuildingPrompt, studioMode]);

  const handleSelectFunction = (nextKey: BuildingFunctionKey) => {
    setFuncKey(nextKey);
    setTargetAreaM2(DEFAULT_AREA_BY_FUNCTION[nextKey] ?? 3000);
    setUserBuildingPrompt('');
    if (studioMode !== 'upload') {
      setStudioMode('auto');
    }
  };

  const handleProjectFileDrop = async (file: File) => {
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await importArchitectProjectFile(file);
      setShow3DStudio(true);
      if (res.kind === 'underlay') {
        setPlanUnderlay(res.underlay);
        setStudioMode('upload');
        if (res.underlay.suggestedAreaM2) {
          setTargetAreaM2(res.underlay.suggestedAreaM2);
        }
        if (res.underlay.extractedDxfBlocks && res.underlay.extractedDxfBlocks.length > 0) {
          setBlocks(res.underlay.extractedDxfBlocks);
          setSelectedBlockId(res.underlay.extractedDxfBlocks[0]?.id ?? null);
        }
      } else if (res.kind === 'model3d') {
        setImported3DModel(res.model);
        setStudioMode('upload');
      } else if (res.kind === 'blocks_json') {
        setBlocks(res.blocks);
        setSelectedBlockId(res.blocks[0]?.id ?? null);
        setStudioMode('custom_build');
      }
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Proje dosyası okunurken bir hata oluştu.'
      );
    } finally {
      setImportLoading(false);
    }
  };

  const handlePdfPageSwitch = async (nextPage: number) => {
    if (!planUnderlay || planUnderlay.fileKind !== 'pdf' || !planUnderlay.rawFile) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const updated = await renderPdfProjectPage(planUnderlay.rawFile, nextPage);
      setPlanUnderlay({
        ...updated,
        widthM: planUnderlay.widthM,
        offsetX: planUnderlay.offsetX,
        offsetZ: planUnderlay.offsetZ,
        rotationDeg: planUnderlay.rotationDeg,
        opacity: planUnderlay.opacity,
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'PDF sayfası değiştirilemedi.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleMapPinPick = async (lat: number, lng: number) => {
    const exactLat = Number(lat.toFixed(6));
    const exactLng = Number(lng.toFixed(6));
    setPickerCoord({ lat: exactLat, lng: exactLng });
    const rev = await reverseGeocodeCoordinates(exactLat, exactLng);
    setLockedLocation({
      lat: exactLat,
      lng: exactLng,
      shortTitle: rev.shortTitle,
      displayAddress: rev.displayAddress,
    });
    setLocationText(rev.shortTitle);
    setShowSuggestions(false);
  };

  const runFullAnalysis = async (
    customQuery?: string,
    directCoord?: { lat: number; lng: number; shortTitle?: string; displayAddress?: string }
  ) => {
    setLoading(true);
    setErrorMsg(null);
    setShowSuggestions(false);
    try {
      let resolved: {
        lat: number;
        lng: number;
        displayAddress: string;
        shortTitle: string;
      };

      if (directCoord) {
        if (directCoord.shortTitle && directCoord.displayAddress) {
          resolved = {
            lat: Number(directCoord.lat.toFixed(6)),
            lng: Number(directCoord.lng.toFixed(6)),
            shortTitle: directCoord.shortTitle,
            displayAddress: directCoord.displayAddress,
          };
        } else {
          resolved = await reverseGeocodeCoordinates(directCoord.lat, directCoord.lng);
        }
        setLocationText(resolved.shortTitle);
      } else if (!customQuery && lockedLocation) {
        // Kullanıcı açılan listeden veya haritadan tam nokta kilitlediyse ASLA yeniden metin araması yapıp kaydırma!
        resolved = {
          lat: lockedLocation.lat,
          lng: lockedLocation.lng,
          shortTitle: lockedLocation.shortTitle,
          displayAddress: lockedLocation.displayAddress,
        };
      } else {
        const q = (customQuery ?? locationText).trim();
        resolved = await resolveLocationInput(q);
      }

      setPickerCoord({ lat: resolved.lat, lng: resolved.lng });
      setLockedLocation({
        lat: resolved.lat,
        lng: resolved.lng,
        shortTitle: resolved.shortTitle,
        displayAddress: resolved.displayAddress,
      });

      const verified = await fetchVerifiedSiteBundle(
        resolved.lat,
        resolved.lng,
        resolved.shortTitle,
        resolved.displayAddress
      );

      setBundle(verified);

      const recs = generateTypologyRecommendations(
        verified.cityProfile,
        funcKey,
        targetAreaM2,
        DEFAULT_SITE
      );
      if (recs[0]) {
        setActiveTypologyKey(recs[0].key);
      }

      if (studioMode === 'auto' || blocks.length === 0) {
        const generated = buildRealisticArchitecturalMassing(
          funcKey,
          verified.cityProfile,
          targetAreaM2,
          userBuildingPrompt
        );
        if (studioMode !== 'custom_build') {
          setBlocks(generated.blocks);
          setSelectedBlockId(generated.blocks[0]?.id ?? null);
        }
        setGeneratedCourtyardM2(generated.courtyardAreaM2);
        setGeneratedOrientationDeg(generated.orientationDeg);
        setAppliedPromptNotes(generated.appliedNotes);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Analiz sırasında beklenmeyen bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  // İklimsel kütle skorlaması (Bölüm 03 tablosu için)
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
    const refBlock = blocks[0] ?? topRec.blocks[0];
    const optRoof = recommendOptimalRoofForBlock(refBlock, city, funcKey);

    const minTotalTon = Math.round((sm.recommendedUnitMassKgM2.min * targetAreaM2) / 1000);
    const maxTotalTon = Math.round((sm.recommendedUnitMassKgM2.max * targetAreaM2) / 1000);

    const md = `# İKLİMFORM — Veriye Dayalı Mimari Arazi, Kütle ve Malzeme Analiz Raporu

## Konum Bilgisi
- **İncelenen Tam Konum:** ${bundle.displayAddress}
- **Tam Koordinatlar:** ${city.lat.toFixed(6)}°K, ${city.lng.toFixed(6)}°D
- **Bina Fonksiyonu & Alanı:** ${BUILDING_PROGRAMS[funcKey].title} — ${targetAreaM2.toLocaleString('tr-TR')} m²
${userBuildingPrompt.trim() ? `- **Kullanıcı Tasarım İsteği:** ${userBuildingPrompt.trim()}\n` : ''}
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
- **100 km Çevrede Deprem Kaydı (M≥4.5):** ${sm.seismicCount100km} deprem (En büyük: M ${sm.maxHistoricalMag})
- **Önerilen Birim Bina Kütlesi:** ${sm.recommendedUnitMassKgM2.min}–${sm.recommendedUnitMassKgM2.max} kg/m² (${targetAreaM2} m² bina için toplam **${minTotalTon}–${maxTotalTon} ton**)
- **Önerilen Temel ve Taşıyıcı Sistem:** ${sm.recommendedFoundation} / ${sm.recommendedStructure}

## 3. Optimal Kütle, Avlu ve Çatı Önerisi
- **Önerilen Kütle Formu:** ${topRec.name} (%${topRec.totalScore} uyum, Avlu: ${generatedCourtyardM2} m²)
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
    a.download = `iklimform_kanitli_rapor_${city.lat.toFixed(4)}_${city.lng.toFixed(4)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePresets = FUNCTION_DESIGN_PRESETS[funcKey] ?? [];
  const promptPlaceholder =
    PROMPT_PLACEHOLDER_BY_FUNCTION[funcKey] ??
    'Örn: 3 katlı, U veya L şeklinde iç avlulu, taş/ahşap/tuğla cepheli, yeşil çatılı bina...';

  return (
    <div className="min-h-screen bg-[#F8F8F6] text-[#181816]">
      {/* ÜST BAŞLIK */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
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
              className="px-3.5 py-2 bg-[#181816] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Raporu İndir (.MD)
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* =================================================================== */}
        {/* 1. SİTENİN AMACI NEDİR?                                             */}
        {/* =================================================================== */}
        <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#C85A17]">
              Bu Araç Ne İşe Yarar?
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#181816] leading-snug">
              Seçtiğiniz Tam Arsanın Gerçek İklim, Rüzgar, Eğim ve Toprak Verilerine Göre Nasıl Bir
              Bina Yapılması Gerektiğini Söyler ve 3D Modelini Kurar
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Mimarlık öğrencileri ve tasarımcılar arsanın tam konumunu seçtiğinde; rüzgarın nereden
              estiğini, güneş açısını, arazinin düz mü eğimli mi olduğunu ve toprağın ne ağırlıkta
              bir binayı taşıyacağını{' '}
              <strong>gerçek uydu, meteoroloji ve jeoloji verileriyle</strong> kanıtlı olarak
              hesaplar; seçtiğiniz yapı türüne (Cami, Lise, Hastane, Ev vb.) ve yazdığınız
              özelliklere uygun gerçekçi 3D mimari kütleyi arazi üzerine yerleştirir.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100 text-xs sm:text-sm">
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-[#C85A17]">01. TAM ARSA SEÇİN</span>
              <p className="text-stone-600 leading-relaxed">
                Mahalle/sokak yazıp listeden seçin, Google Maps pin linki yapıştırın veya uydu
                haritasında doğrudan arsanıza tıklayın.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-[#C85A17]">
                02. BİNAYI TARİF EDİN
              </span>
              <p className="text-stone-600 leading-relaxed">
                Cami, Lise, Hastane, Ev seçin; nasıl bir bina istediğinizi (kat, avlu, spor salonu,
                kubbe, cephe) seçin veya kendiniz yazın.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-mono text-xs font-bold text-[#C85A17]">
                03. KANITLI REÇETE & 3D
              </span>
              <p className="text-stone-600 leading-relaxed">
                Gerçek rüzgar, 3D arazi/zemin kesiti, bina kütlesi (kg/m²) ve türe özel gerçekçi 3D
                mimari modeli canlı inceleyin.
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 2. HASSAS KONUM VE BİNA TASARIM GİRİŞ KUTUSU                         */}
        {/* =================================================================== */}
        <section className="bg-white border border-stone-200 p-6 sm:p-8 space-y-5">
          <h2 className="text-base sm:text-lg font-bold text-[#181816]">
            Çalışacağınız Tam Arsayı ve İstediğiniz Binayı Belirleyin
          </h2>

          {/* Konum Satırı + Canlı Nokta Tamamlama */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              1. Tam Arsa Konumu (Mahalle/Sokak Yazıp Seçin, Uydu Haritasından Pinleyin veya Harita Linki Yapıştırın)
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
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setLocationText(e.target.value);
                    setLockedLocation(null);
                    setShowSuggestions(true);
                  }}
                  placeholder="Örn: Ragıp Tüzün Yenimahalle, Moda Kadıköy veya Google Maps Pin Linki..."
                  className="w-full pl-10 pr-3.5 py-3 bg-[#FAF9F6] border border-stone-300 text-sm focus:outline-none focus:bg-white focus:border-[#181816]"
                />

                {/* Canlı Tam Konum Önerileri (Yanlış Yeri Seçmeyi Önler) */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#181816] shadow-lg z-30 max-h-64 overflow-y-auto divide-y divide-stone-100">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setLocationText(item.shortTitle);
                          setPickerCoord({ lat: item.lat, lng: item.lng });
                          setLockedLocation({
                            lat: item.lat,
                            lng: item.lng,
                            shortTitle: item.shortTitle,
                            displayAddress: item.displayAddress,
                          });
                          setSuggestions([]);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[#FAF9F5] transition flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#181816] truncate">
                            {item.shortTitle}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">
                            {item.displayAddress}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-stone-100 border border-stone-200 text-stone-700 block">
                            {item.categoryLabel}
                          </span>
                          <span className="font-mono text-[10px] text-stone-500">
                            {item.lat.toFixed(4)}°, {item.lng.toFixed(4)}°
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMapSelector((v) => !v)}
                className="px-4 py-3 border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <MapPin className="w-4 h-4 text-[#C85A17]" />
                {showMapSelector ? 'Uydu Haritasını Kapat' : 'Uydu Haritasından Tam Arsa Seç'}
              </button>
            </form>

            {/* Kilitlenen Tam Koordinat Teyit Satırı */}
            {lockedLocation && (
              <div className="bg-[#F2FBF5] border border-[#BBF7D0] px-3 py-2 text-xs text-[#166534] flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>Tam Konum Kilitlendi:</strong> {lockedLocation.shortTitle} (
                    <span className="font-mono">
                      {lockedLocation.lat.toFixed(5)}°K, {lockedLocation.lng.toFixed(5)}°D
                    </span>
                    )
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowMapSelector(true)}
                  className="underline font-semibold whitespace-nowrap"
                >
                  Uydu Görünümünde İncele / Pini Kaydır
                </button>
              </div>
            )}

            {/* Hızlı Örnek Konumlar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-stone-500 mr-1">Hızlı dene:</span>
              {QUICK_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setLockedLocation(null);
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

          {/* İnteraktif Uydu & Sokak Harita Seçici */}
          {showMapSelector && (
            <div className="space-y-2 pt-1">
              <SiteMapPicker
                lat={pickerCoord.lat}
                lng={pickerCoord.lng}
                defaultLayer="satellite"
                onPickCoordinate={handleMapPinPick}
              />
              <button
                type="button"
                onClick={() => {
                  setShowMapSelector(false);
                  runFullAnalysis(
                    undefined,
                    lockedLocation ?? { lat: pickerCoord.lat, lng: pickerCoord.lng }
                  );
                }}
                className="w-full py-2.5 bg-stone-800 hover:bg-black text-white text-xs font-semibold transition"
              >
                Seçilen Tam Parsel Noktasını ({pickerCoord.lat.toFixed(5)}°K,{' '}
                {pickerCoord.lng.toFixed(5)}°D) Analiz Et
              </button>
            </div>
          )}

          {/* Bina Fonksiyonu ve Metrekare */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                2. Yapılacak Binanın Türü (Her Tür İçin Özel Gerçekçi 3D Mimari)
              </label>
              <select
                value={funcKey}
                onChange={(e) => handleSelectFunction(e.target.value as BuildingFunctionKey)}
                className="w-full bg-[#FAF9F6] border border-stone-300 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#181816]"
              >
                {BUILDING_FUNCTION_GROUPS.map((grp) => (
                  <optgroup key={grp.category} label={grp.category}>
                    {grp.items.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {funcKey === 'custom' && (
                <input
                  type="text"
                  value={customFuncTitle}
                  onChange={(e) => setCustomFuncTitle(e.target.value)}
                  placeholder="Proje konunuzu yazın (Örn: Arkeopark Ziyaretçi Merkezi, İtfaiye Binası)..."
                  className="w-full bg-white border border-stone-400 px-3.5 py-2 text-sm focus:outline-none focus:border-[#181816]"
                />
              )}
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
                  min={180}
                  max={15000}
                  step={50}
                  value={targetAreaM2}
                  onChange={(e) => setTargetAreaM2(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={120}
                  max={50000}
                  step={50}
                  value={targetAreaM2}
                  onChange={(e) =>
                    setTargetAreaM2(Math.max(120, Number(e.target.value) || 1000))
                  }
                  className="w-24 bg-[#FAF9F6] border border-stone-300 px-2.5 py-2 text-sm font-semibold text-right"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Seçilen yapı türüne göre ortalama ölçek otomatik ayarlanır; dilediğiniz gibi
                değiştirebilirsiniz.
              </p>
            </div>
          </div>

          {/* 3. NASIL BİR BİNA İSTİYORSUNUZ? (HAZIR TİPLER + SERBEST YAZIM KUTUSU) */}
          <div className="bg-[#FAF9F6] border border-stone-300 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#181816] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#C85A17]" />
                3. Nasıl Bir {BUILDING_PROGRAMS[funcKey].title} İstiyorsunuz? (Seçin veya Kendi Özelliklerinizi Yazın)
              </label>
              {userBuildingPrompt.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setUserBuildingPrompt('')}
                  className="text-[11px] text-stone-500 hover:text-stone-800 underline"
                >
                  Varsayılan Öneriye Dön
                </button>
              )}
            </div>

            {activePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activePresets.map((preset) => {
                  const isActive = userBuildingPrompt.trim() === preset.promptText.trim();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setUserBuildingPrompt(preset.promptText)}
                      className={`px-2.5 py-1.5 text-xs font-semibold border transition ${
                        isActive
                          ? 'bg-[#181816] text-white border-[#181816]'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-[#181816]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              value={userBuildingPrompt}
              onChange={(e) => setUserBuildingPrompt(e.target.value)}
              placeholder={promptPlaceholder}
              className="w-full bg-white border border-stone-300 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#181816]"
            />

            <p className="text-[11px] text-stone-600 leading-relaxed">
              Kat sayısını (ör. <em>2 katlı, 4 katlı</em>), plan şemasını (<em>U planlı, L şeklinde, iç avlulu, kompakt</em>), ek mekanları (<em>kapalı spor salonu, konferans salonu, havuz, çift minare</em>) ve dış cepheyi (<em>taş, tuğla, ahşap, beyaz, cam, kiremit/yeşil çatı</em>) yazdığınızda 3D bina anında o özelliklere göre kurulur.
            </p>
          </div>

          {/* 4. İSTEĞE BAĞLI: HAZIR PROJE SÜRÜKLE-BIRAK (PDF / CAD / 3D) VEYA SIFIRDAN ÇİZİM SEÇİMİ */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleProjectFileDrop(f);
            }}
            className="border border-dashed border-stone-400 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-0.5">
              <div className="font-bold text-[#181816] flex items-center gap-1.5">
                <FileUp className="w-4 h-4 text-[#C85A17]" />
                Hazır Projeniz mi Var Yoksa Kendi Binanızı Kendiniz mi Yapmak İstiyorsunuz?
              </div>
              <div className="text-stone-600">
                {planUnderlay
                  ? `✓ Yüklü Plan/Pafta: ${planUnderlay.fileName}`
                  : imported3DModel
                  ? `✓ Yüklü 3D Model: ${imported3DModel.fileName}`
                  : 'Mimarın PDF paftasını (.pdf), AutoCAD (.dxf), SketchUp/Revit/Rhino 3D modelini (.obj, .glb, .fbx, .stl) buraya sürükleyebilir veya analizden sonra kendi binanızı sıfırdan çizebilirsiniz.'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-stone-100 border border-stone-300 font-semibold cursor-pointer whitespace-nowrap">
                {importLoading ? 'Okunuyor...' : 'Proje Dosyası Seç (PDF/CAD/3D)'}
                <input
                  type="file"
                  accept=".pdf,.dxf,.glb,.gltf,.obj,.fbx,.dae,.stl,.ply,.png,.jpg,.jpeg,.webp,.svg,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleProjectFileDrop(f);
                    e.target.value = '';
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => setStudioMode('custom_build')}
                className={`px-3 py-1.5 border font-semibold whitespace-nowrap flex items-center gap-1 ${
                  studioMode === 'custom_build'
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-white hover:bg-stone-50 text-[#181816] border-stone-300'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-[#C85A17]" /> Kendi Binamı Çizeceğim
              </button>
            </div>
          </div>

          {(errorMsg || importError) && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-xs sm:text-sm">
              {errorMsg || importError}
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
                Tam Arsa Koordinatı İçin Uydu, ERA5 İklim ve Zemin Verileri Sorgulanıyor...
              </>
            ) : (
              'Gerçek Verilerle Araziyi Analiz Et ve 3D Sahneyi Aç'
            )}
          </button>
        </section>

        {/* =================================================================== */}
        {/* ANALİZ SONUÇLARI                                                    */}
        {/* =================================================================== */}
        {bundle && recommendations.length > 0 && assemblySummary && (
          <ReportSections
            bundle={bundle}
            funcKey={funcKey}
            customFuncTitle={customFuncTitle}
            targetAreaM2={targetAreaM2}
            studioMode={studioMode}
            setStudioMode={setStudioMode}
            planUnderlay={planUnderlay}
            setPlanUnderlay={setPlanUnderlay}
            imported3DModel={imported3DModel}
            setImported3DModel={setImported3DModel}
            importLoading={importLoading}
            importError={importError}
            onDropProjectFile={handleProjectFileDrop}
            onSwitchPdfPage={handlePdfPageSwitch}
            onResetToAutoBuilding={() => {
              setStudioMode('auto');
              const generated = buildRealisticArchitecturalMassing(
                funcKey,
                bundle.cityProfile,
                targetAreaM2,
                userBuildingPrompt
              );
              setBlocks(generated.blocks);
              setSelectedBlockId(generated.blocks[0]?.id ?? null);
            }}
            userBuildingPrompt={userBuildingPrompt}
            setUserBuildingPrompt={(val) => {
              setStudioMode('auto');
              setUserBuildingPrompt(val);
            }}
            appliedPromptNotes={appliedPromptNotes}
            generatedCourtyardM2={generatedCourtyardM2}
            generatedOrientationDeg={generatedOrientationDeg}
            onRelocateExactPin={(lat, lng) => {
              runFullAnalysis(undefined, { lat, lng });
            }}
            recommendations={recommendations}
            activeTypologyKey={activeTypologyKey}
            onSelectTypology={(key) => {
              setStudioMode('auto');
              setActiveTypologyKey(key);
              if (key === 'l_shield') {
                setUserBuildingPrompt('L şeklinde rüzgar korunaklı avlulu yerleşim');
              } else if (key === 'courtyard') {
                setUserBuildingPrompt('Merkezi iç avlulu 4 kanatlı yerleşim');
              } else if (key === 'compact_prism') {
                setUserBuildingPrompt('Kompakt tek blok yerleşim');
              } else {
                setUserBuildingPrompt('');
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
 * ALT BİLEŞEN: DOĞRULANMIŞ MİMARİ ANALİZ RAPORU VE GERÇEKÇİ 3D STÜDYO
 * ========================================================================== */
interface ReportSectionsProps {
  bundle: VerifiedSiteBundle;
  funcKey: BuildingFunctionKey;
  customFuncTitle: string;
  targetAreaM2: number;
  studioMode: StudioDesignMode;
  setStudioMode: (m: StudioDesignMode) => void;
  planUnderlay: PlanUnderlayData | null;
  setPlanUnderlay: React.Dispatch<React.SetStateAction<PlanUnderlayData | null>>;
  imported3DModel: Imported3DModelData | null;
  setImported3DModel: React.Dispatch<React.SetStateAction<Imported3DModelData | null>>;
  importLoading: boolean;
  importError: string | null;
  onDropProjectFile: (file: File) => void;
  onSwitchPdfPage: (page: number) => void;
  onResetToAutoBuilding: () => void;
  userBuildingPrompt: string;
  setUserBuildingPrompt: (v: string) => void;
  appliedPromptNotes: string[];
  generatedCourtyardM2: number;
  generatedOrientationDeg: number;
  onRelocateExactPin: (lat: number, lng: number) => void;
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

const FACADE_SWATCHES: Array<{ label: string; hex: string; glazing?: MassBlock['glazingStyle'] }> = [
  { label: 'Doğal Kalker Taşı', hex: '#EAE3D2', glazing: 'punched' },
  { label: 'Pişmiş Toprak / Tuğla', hex: '#B65E45', glazing: 'punched' },
  { label: 'Doğal Yapısal Ahşap', hex: '#C19363', glazing: 'punched' },
  { label: 'Modern Beyaz Sıva', hex: '#F5F4F0', glazing: 'punched' },
  { label: 'Koyu Bazalt Taşı', hex: '#57534E', glazing: 'punched' },
  { label: 'Giydirme Cam Cephe', hex: '#CBD5E1', glazing: 'curtain_wall' },
  { label: 'Kemerli Anıtsal Taş', hex: '#E8E0CF', glazing: 'arched_classic' },
];

const ReportSections: React.FC<ReportSectionsProps> = ({
  bundle,
  funcKey,
  customFuncTitle,
  targetAreaM2,
  studioMode,
  setStudioMode,
  planUnderlay,
  setPlanUnderlay,
  imported3DModel,
  setImported3DModel,
  importLoading,
  importError,
  onDropProjectFile,
  onSwitchPdfPage,
  onResetToAutoBuilding,
  userBuildingPrompt,
  setUserBuildingPrompt,
  appliedPromptNotes,
  generatedCourtyardM2,
  generatedOrientationDeg,
  onRelocateExactPin,
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
  const displayProgTitle =
    funcKey === 'custom' && customFuncTitle.trim() ? customFuncTitle.trim() : prog.title;

  const [adjustedPin, setAdjustedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [dropHover, setDropHover] = useState(false);

  useEffect(() => {
    setAdjustedPin(null);
  }, [city.lat, city.lng]);

  const [showFieldOverride, setShowFieldOverride] = useState(false);
  const [overrideSoilClass, setOverrideSoilClass] = useState<'AUTO' | 'ZB' | 'ZC' | 'ZD' | 'ZE'>(
    'AUTO'
  );
  const [overrideSlopePct, setOverrideSlopePct] = useState<string>('');

  const effectiveSoilClass =
    overrideSoilClass === 'AUTO' ? sm.estimatedTbdyClass : overrideSoilClass;
  const effectiveSlopePct =
    overrideSlopePct.trim() !== '' && !Number.isNaN(Number(overrideSlopePct))
      ? Math.max(0, Number(overrideSlopePct))
      : tp.slopePct;

  const effectiveMassCalc = useMemo(
    () =>
      computeSoilMassRecommendation(
        effectiveSoilClass,
        sm.seismicHazardLevel,
        sm.seismicCount100km,
        sm.maxHistoricalMag
      ),
    [effectiveSoilClass, sm.seismicHazardLevel, sm.seismicCount100km, sm.maxHistoricalMag]
  );

  const activeRec =
    recommendations.find((r) => r.key === activeTypologyKey) || recommendations[0];
  const currentBlocks = blocks;
  const activeBlock: MassBlock | null =
    currentBlocks.find((b) => b.id === selectedBlockId) || currentBlocks[0] || null;
  const fallbackRoofRefBlock = activeBlock ?? activeRec.blocks[0];

  const solarSum = getSeasonalSolarSummary(
    city.lat,
    season,
    city.seasons[season].directRadiationWm2,
    city.seasons[season].diffuseRadiationWm2
  );
  const summerShadow = calculateSolarPosition(city.lat, 172, 12).shadowMultiplier;
  const winterShadow = calculateSolarPosition(city.lat, 355, 12).shadowMultiplier;

  const optRoof = recommendOptimalRoofForBlock(fallbackRoofRefBlock, city, funcKey);
  const roofPerf = analyzeBlockRoofPerformance(fallbackRoofRefBlock, city);

  const minBuildingTons = Math.round(
    (effectiveMassCalc.recommendedUnitMassKgM2.min * targetAreaM2) / 1000
  );
  const maxBuildingTons = Math.round(
    (effectiveMassCalc.recommendedUnitMassKgM2.max * targetAreaM2) / 1000
  );
  const heavyBuildingTons = Math.round((sm.conventionalConcreteMassKgM2 * targetAreaM2) / 1000);
  const avgUnitMassKgM2 = Math.round(
    (effectiveMassCalc.recommendedUnitMassKgM2.min + effectiveMassCalc.recommendedUnitMassKgM2.max) /
      2
  );

  const activeWallColor =
    evaluatedMaterials.find((e) => e.material.id === recommendedMaterialsMap.envelope_wall)
      ?.material.colorHex ?? '#D6D3C9';
  const activeRoofColor =
    evaluatedMaterials.find((e) => e.material.id === recommendedMaterialsMap.roof_finish)
      ?.material.colorHex ?? '#334155';

  const activePresets = FUNCTION_DESIGN_PRESETS[funcKey] ?? [];

  const updateActiveBlock = (patch: Partial<MassBlock>) => {
    if (!activeBlock) return;
    setBlocks((prev) => prev.map((b) => (b.id === activeBlock.id ? { ...b, ...patch } : b)));
  };

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* YÖNETİCİ ÖZETİ + DOĞRULANMIŞ UYDU PARSEL HARİTASI                      */}
      {/* ===================================================================== */}
      <section className="bg-white border-2 border-[#181816] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#15803D]">
              <ShieldCheck className="w-4 h-4" /> Gerçek Verilerle Doğrulanmış Tam Arsa Özeti
            </div>
            <h2 className="text-xl font-bold text-[#181816] mt-1">{bundle.shortTitle}</h2>
            <p className="text-xs text-stone-500 mt-0.5">{bundle.displayAddress}</p>
          </div>
          <div className="font-mono text-xs bg-[#F8F8F6] border border-stone-200 px-3 py-2 shrink-0">
            <div>Enlem: {city.lat.toFixed(5)}°K</div>
            <div>Boylam: {city.lng.toFixed(5)}°D</div>
            <div>Rakım: {tp.elevationM} m</div>
          </div>
        </div>

        {/* Sade Dil Özeti */}
        <div className="bg-[#FAF9F5] border border-stone-200 p-4 sm:p-5 space-y-2.5 text-sm leading-relaxed text-stone-800">
          <div className="font-bold text-[#181816]">
            Kısaca Bu Arsaya Nasıl Bir {displayProgTitle} Yapılmalı?
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
            yönünden esmektedir. Ana mekanlar güneye/avlu içine, servis hacimleri soğuk rüzgar
            yönüne yerleştirilmelidir.
          </p>
          <p>
            <strong>2. Arazi Düz mü Eğimli mi & Bina Ağırlığı:</strong> Uydu kot analizine göre bu
            nokta <strong>{tp.flatnessVerdict}</strong> karakterindedir ve{' '}
            <strong>{sm.soilTypeTitle}</strong> zemin yapısına sahiptir. Deprem ve zemin güvenliği
            için binanın m² ağırlığı klasik ağır binalardaki ~1.280 kg/m² yerine{' '}
            <strong>
              {effectiveMassCalc.recommendedUnitMassKgM2.min}–
              {effectiveMassCalc.recommendedUnitMassKgM2.max} kg/m²
            </strong>{' '}
            aralığında ({targetAreaM2.toLocaleString('tr-TR')} m² için toplam{' '}
            <strong>
              {minBuildingTons.toLocaleString('tr-TR')}–{maxBuildingTons.toLocaleString('tr-TR')} ton
            </strong>
            ) tutulmalı ve <strong>{effectiveMassCalc.recommendedFoundation}</strong> uygulanmalıdır.
          </p>
          <p>
            <strong>3. Mimari Kütle, Avlu ve Çatı:</strong> <strong>{displayProgTitle}</strong> için
            önerilen yerleşim ({generatedCourtyardM2} m² açık/avlu alanı) ve üst örtüde{' '}
            <strong>
              {ROOF_TYPES_META[fallbackRoofRefBlock.roofType].shortName} (
              {fallbackRoofRefBlock.roofPitchDeg}°)
            </strong>{' '}
            ile iklim ve fonksiyon dengelenmiştir.
          </p>
        </div>

        {/* Doğrulanmış Uydu Haritası */}
        <div className="space-y-2">
          <SiteMapPicker
            lat={adjustedPin ? adjustedPin.lat : city.lat}
            lng={adjustedPin ? adjustedPin.lng : city.lng}
            interactivePick={true}
            defaultLayer="satellite"
            heightClass="h-64"
            onPickCoordinate={(lat, lng) => setAdjustedPin({ lat, lng })}
          />
          {adjustedPin && (
            <div className="bg-amber-50 border border-amber-300 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-amber-950 font-medium">
                Haritada yeni bir tam arsa noktası seçtiniz (
                <strong className="font-mono">
                  {adjustedPin.lat.toFixed(5)}°K, {adjustedPin.lng.toFixed(5)}°D
                </strong>
                ).
              </span>
              <button
                type="button"
                onClick={() => onRelocateExactPin(adjustedPin.lat, adjustedPin.lng)}
                className="px-3 py-1.5 bg-[#181816] hover:bg-stone-800 text-white font-bold transition whitespace-nowrap"
              >
                Bu Tam Noktaya Göre Analizi Yenile
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3 MODLU GERÇEKÇİ 3D STÜDYO: OTOMATİK / PROJE YÜKLE / KENDİ BİNANI YAP */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200">
        <button
          type="button"
          onClick={() => setShow3DStudio(!show3DStudio)}
          className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-stone-50 transition"
        >
          <div>
            <span className="font-mono text-xs font-bold text-[#C85A17]">
              GERÇEKÇİ 3D MİMARİ STÜDYO · PROJE YÜKLE VEYA KENDİ BİNANI TASARLA
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#181816] mt-0.5">
              3D Bina Yerleşimi, PDF / CAD / 3D Proje Sürükleme ve Sıfırdan Kendi Binanı Yapma Alanı
            </h3>
          </div>
          {show3DStudio ? (
            <ChevronUp className="w-5 h-5 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 shrink-0" />
          )}
        </button>

        {show3DStudio && (
          <div className="p-6 pt-3 border-t border-stone-200 space-y-5">
            {/* 3 NET TASARIM MODU SEKMESİ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStudioMode('auto')}
                className={`p-3 text-left border transition ${
                  studioMode === 'auto'
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-[#FAF9F6] text-[#181816] border-stone-300 hover:bg-stone-100'
                }`}
              >
                <div className="font-mono text-[11px] font-bold text-[#C85A17]">MOD 01</div>
                <div className="text-xs font-bold mt-0.5">Otomatik / Yazarak Öner</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    studioMode === 'auto' ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  Hazır tipler veya Türkçe tarif ile kur
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStudioMode('upload')}
                className={`p-3 text-left border transition ${
                  studioMode === 'upload'
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-[#FAF9F6] text-[#181816] border-stone-300 hover:bg-stone-100'
                }`}
              >
                <div className="font-mono text-[11px] font-bold text-[#C85A17]">MOD 02</div>
                <div className="text-xs font-bold mt-0.5">
                  Mimarın Projesini Sürükle (PDF / CAD / 3D)
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    studioMode === 'upload' ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  .PDF, .DXF, .OBJ, .GLB, .FBX, .STL, Görsel
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStudioMode('custom_build')}
                className={`p-3 text-left border transition ${
                  studioMode === 'custom_build'
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-[#FAF9F6] text-[#181816] border-stone-300 hover:bg-stone-100'
                }`}
              >
                <div className="font-mono text-[11px] font-bold text-[#C85A17]">MOD 03</div>
                <div className="text-xs font-bold mt-0.5">
                  Projesi Olmayanlar: Kendi Binanı Yap
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    studioMode === 'custom_build' ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  Kareli arsada çiz, kat/çatı/balkon ekle
                </div>
              </button>
            </div>

            {/* MOD 01 PANELİ: OTOMATİK / YAZARAK BİNA OLUŞTURMA */}
            {studioMode === 'auto' && (
              <div className="bg-[#FAF9F6] border border-stone-300 p-3.5 space-y-2.5 text-xs">
                <div className="font-bold text-[#181816] flex items-center justify-between gap-2">
                  <span>
                    Nasıl Bir {displayProgTitle} İstiyorsunuz? (Seçin veya Yazın — 3D Model Anında
                    Değişir)
                  </span>
                  {userBuildingPrompt.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setUserBuildingPrompt('')}
                      className="text-stone-500 underline font-normal"
                    >
                      Sıfırla
                    </button>
                  )}
                </div>

                {activePresets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activePresets.map((preset) => {
                      const isActive = userBuildingPrompt.trim() === preset.promptText.trim();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setUserBuildingPrompt(preset.promptText)}
                          className={`px-2.5 py-1 font-semibold border transition ${
                            isActive
                              ? 'bg-[#181816] text-white border-[#181816]'
                              : 'bg-white text-stone-700 border-stone-300 hover:border-[#181816]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={userBuildingPrompt}
                  onChange={(e) => setUserBuildingPrompt(e.target.value)}
                  placeholder={
                    PROMPT_PLACEHOLDER_BY_FUNCTION[funcKey] ??
                    'Örn: 4 katlı, L şeklinde, spor salonlu, taş veya tuğla cepheli bina...'
                  }
                  className="w-full bg-white border border-stone-300 px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#181816]"
                />

                {appliedPromptNotes.length > 0 && (
                  <div className="text-[11px] text-[#15803D] font-medium flex flex-wrap gap-x-3 gap-y-1">
                    {appliedPromptNotes.map((note, idx) => (
                      <span key={idx}>✓ {note}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MOD 02 PANELİ: MİMARIN PROJESİNİ SÜRÜKLE-BIRAK (PDF / DXF / 3D / GÖRSEL) */}
            {studioMode === 'upload' && (
              <div className="bg-[#FAF9F6] border border-stone-300 p-4 space-y-4 text-xs">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropHover(true);
                  }}
                  onDragLeave={() => setDropHover(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropHover(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) onDropProjectFile(f);
                  }}
                  className={`border-2 border-dashed p-5 text-center transition ${
                    dropHover
                      ? 'border-[#C85A17] bg-amber-50/60'
                      : 'border-stone-400 bg-white hover:border-[#181816]'
                  }`}
                >
                  <FileUp className="w-7 h-7 text-[#C85A17] mx-auto mb-2" />
                  <div className="text-sm font-bold text-[#181816]">
                    {importLoading
                      ? 'Proje Dosyası Çözümleniyor ve 3D Araziye Oturtuluyor...'
                      : 'Mimarın Proje Dosyasını Buraya Sürükleyip Bırakın'}
                  </div>
                  <p className="text-stone-600 mt-1 max-w-xl mx-auto leading-relaxed">
                    <strong>Desteklenen Tüm Mimari Formatlar:</strong> Vaziyet / Kat Planı Paftası (
                    <strong>.PDF</strong>), AutoCAD Çizimi (<strong>.DXF</strong>), SketchUp / Revit
                    / Rhino / ArchiCAD / Blender 3D Modeli (
                    <strong>.OBJ, .GLB, .GLTF, .FBX, .DAE, .STL, .PLY</strong>), Plan Görseli (
                    <strong>.PNG, .JPG, .SVG</strong>) veya Kayıtlı Proje (<strong>.JSON</strong>)
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#181816] hover:bg-stone-800 text-white font-bold cursor-pointer">
                      <FileUp className="w-3.5 h-3.5" /> Bilgisayardan Proje Dosyası Seç
                      <input
                        type="file"
                        accept=".pdf,.dxf,.glb,.gltf,.obj,.fbx,.dae,.stl,.ply,.png,.jpg,.jpeg,.webp,.svg,.json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onDropProjectFile(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stone-200 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                    <span className="text-stone-500">Dosyanız yanınızda değilse örneklerle deneyin:</span>
                    <button
                      type="button"
                      onClick={() => onDropProjectFile(createSampleProjectFile('pdf'))}
                      className="px-2 py-1 bg-[#FAF9F6] hover:bg-stone-200 border border-stone-300 font-semibold"
                    >
                      Örnek PDF Pafta Yükle
                    </button>
                    <button
                      type="button"
                      onClick={() => onDropProjectFile(createSampleProjectFile('dxf'))}
                      className="px-2 py-1 bg-[#FAF9F6] hover:bg-stone-200 border border-stone-300 font-semibold"
                    >
                      Örnek AutoCAD (.DXF) Yükle
                    </button>
                    <button
                      type="button"
                      onClick={() => onDropProjectFile(createSampleProjectFile('obj'))}
                      className="px-2 py-1 bg-[#FAF9F6] hover:bg-stone-200 border border-stone-300 font-semibold"
                    >
                      Örnek 3D Maket (.OBJ) Yükle
                    </button>
                  </div>
                </div>

                {importError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2">
                    {importError}
                  </div>
                )}

                {/* Yüklenen 2D Plan Altlığı (PDF / DXF / Görsel) Ayarları */}
                {planUnderlay && (
                  <div className="bg-white border border-stone-300 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-[#15803D]">
                          ✓ 3D Arazi Zeminine Serilen Plan / Pafta
                        </span>
                        <div className="font-bold text-sm text-[#181816]">
                          {planUnderlay.fileName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {planUnderlay.fileKind === 'pdf' &&
                          (planUnderlay.pdfPageCount ?? 1) > 1 && (
                            <div className="flex items-center gap-1">
                              <span>Sayfa:</span>
                              <select
                                value={planUnderlay.pdfCurrentPage ?? 1}
                                onChange={(e) => onSwitchPdfPage(Number(e.target.value))}
                                className="bg-[#FAF9F6] border border-stone-300 px-2 py-1 font-bold"
                              >
                                {Array.from(
                                  { length: planUnderlay.pdfPageCount ?? 1 },
                                  (_, idx) => idx + 1
                                ).map((pg) => (
                                  <option key={pg} value={pg}>
                                    {pg} / {planUnderlay.pdfPageCount}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                        <button
                          type="button"
                          onClick={() => setPlanUnderlay(null)}
                          className="px-2 py-1 text-red-700 border border-stone-300 hover:bg-red-50 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Planı Kaldır
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-stone-700">
                      {planUnderlay.extractedSummary.map((line, i) => (
                        <div key={i}>• {line}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Planın Arsadaki Genişliği</span>
                          <strong>{planUnderlay.widthM} m</strong>
                        </label>
                        <input
                          type="range"
                          min={18}
                          max={100}
                          value={planUnderlay.widthM}
                          onChange={(e) =>
                            setPlanUnderlay((u) =>
                              u ? { ...u, widthM: Number(e.target.value) } : u
                            )
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Plan Yön Açısı</span>
                          <strong>{planUnderlay.rotationDeg}°</strong>
                        </label>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={5}
                          value={planUnderlay.rotationDeg}
                          onChange={(e) =>
                            setPlanUnderlay((u) =>
                              u ? { ...u, rotationDeg: Number(e.target.value) } : u
                            )
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Plan Görünürlüğü</span>
                          <strong>%{Math.round(planUnderlay.opacity * 100)}</strong>
                        </label>
                        <input
                          type="range"
                          min={0.3}
                          max={1}
                          step={0.05}
                          value={planUnderlay.opacity}
                          onChange={(e) =>
                            setPlanUnderlay((u) =>
                              u ? { ...u, opacity: Number(e.target.value) } : u
                            )
                          }
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setStudioMode('custom_build')}
                        className="px-3 py-2 bg-[#C85A17] hover:bg-amber-800 text-white font-bold flex items-center gap-1.5"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Bu Planın Üzerinden 3D Kütleleri Çiz /
                        Düzenle
                      </button>

                      {planUnderlay.suggestedFloors && (
                        <button
                          type="button"
                          onClick={() => {
                            setBlocks((prev) =>
                              prev.map((b) => ({
                                ...b,
                                floors: planUnderlay.suggestedFloors ?? b.floors,
                              }))
                            );
                          }}
                          className="px-3 py-2 bg-white border border-stone-300 hover:border-[#181816] font-semibold"
                        >
                          Algılanan Kat Sayısını ({planUnderlay.suggestedFloors} Kat) 3D Binaya
                          Uygula
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Yüklenen 3D Mimari Model (.OBJ, .GLB, .FBX, .DAE, .STL) Ayarları */}
                {imported3DModel && (
                  <div className="bg-white border border-stone-300 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase text-[#15803D]">
                          ✓ 3D Araziye Yerleştirilen Mimar Modeli ({imported3DModel.formatLabel})
                        </span>
                        <div className="font-bold text-sm text-[#181816]">
                          {imported3DModel.fileName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImported3DModel(null)}
                        className="px-2 py-1 text-red-700 border border-stone-300 hover:bg-red-50 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> 3D Modeli Kaldır
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block mb-1 font-semibold">Çizim Birimi</label>
                        <select
                          value={String(imported3DModel.unitScale)}
                          onChange={(e) =>
                            setImported3DModel((m) =>
                              m ? { ...m, unitScale: Number(e.target.value) } : m
                            )
                          }
                          className="w-full bg-[#FAF9F6] border border-stone-300 px-2.5 py-1.5 font-semibold"
                        >
                          <option value="1">Metre (1 birim = 1m)</option>
                          <option value="0.01">Santimetre (cm → m)</option>
                          <option value="0.001">Milimetre (mm → m)</option>
                        </select>
                      </div>

                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Ek Ölçek Çarpanı</span>
                          <strong>×{imported3DModel.customMultiplier.toFixed(2)}</strong>
                        </label>
                        <input
                          type="range"
                          min={0.2}
                          max={4}
                          step={0.05}
                          value={imported3DModel.customMultiplier}
                          onChange={(e) =>
                            setImported3DModel((m) =>
                              m ? { ...m, customMultiplier: Number(e.target.value) } : m
                            )
                          }
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Yönelim Açısı</span>
                          <strong>{imported3DModel.rotationDeg}°</strong>
                        </label>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={5}
                          value={imported3DModel.rotationDeg}
                          onChange={(e) =>
                            setImported3DModel((m) =>
                              m ? { ...m, rotationDeg: Number(e.target.value) } : m
                            )
                          }
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={imported3DModel.flipYZ}
                          onChange={(e) =>
                            setImported3DModel((m) =>
                              m ? { ...m, flipYZ: e.target.checked } : m
                            )
                          }
                        />
                        Z-Yukarı Ekseni Çevir (AutoCAD / Rhino / Revit dikey düzeltme)
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={imported3DModel.hideGeneratedBlocks}
                          onChange={(e) =>
                            setImported3DModel((m) =>
                              m ? { ...m, hideGeneratedBlocks: e.target.checked } : m
                            )
                          }
                        />
                        Yalnızca Kendi 3D Modelimi Göster (Öneri kütleleri gizle)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MOD 03 PANELİ: PROJESİ OLMAYANLAR İÇİN KENDİ BİNANI KENDİN YAP */}
            {studioMode === 'custom_build' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#181816]">
                    Kuşbakışı Arsa Üzerinde Kendi Binanızı Çizin veya Taşıyın (Aşağıdaki 3D Modelde
                    Canlı Yükselir)
                  </span>
                  <button
                    type="button"
                    onClick={onResetToAutoBuilding}
                    className="text-stone-600 hover:text-[#181816] underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Otomatik {displayProgTitle} Önerisine Geri Dön
                  </button>
                </div>

                <InteractiveBuildingDesigner
                  site={DEFAULT_SITE}
                  blocks={currentBlocks}
                  setBlocks={setBlocks}
                  selectedBlockId={activeBlock?.id ?? null}
                  onSelectBlock={setSelectedBlockId}
                  planUnderlay={planUnderlay}
                  prevailingWindLabel={ce.annualWindRose[0]?.name ?? 'KD (Poyraz)'}
                  recommendedUnitMassAvgKgM2={avgUnitMassKgM2}
                />
              </div>
            )}

            {/* Mevsim, Saat ve Dışa Aktarma Kontrolleri */}
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
                    const baseTemplate: MassBlock = activeBlock ?? {
                      id: 'init',
                      label: 'Yeni Bina Bloğu',
                      role: 'primary_living',
                      x: 0,
                      z: 0,
                      width: 16,
                      depth: 11,
                      floors: 3,
                      floorHeight: 3.3,
                      rotationDeg: 0,
                      roofType: 'gable',
                      roofPitchDeg: 22,
                      secondaryPitchDeg: 85,
                      overhangSouthM: 1.0,
                      sawtoothCount: 3,
                      skylightRatio: 0.25,
                      ridgeDirection: 'EW',
                      hasPvPanels: false,
                      glazingStyle: 'punched',
                      customWallHex: '#EAE3D2',
                      customRoofHex: '#475569',
                    };
                    const nextBlk: MassBlock = {
                      ...baseTemplate,
                      id: `ek_${Date.now().toString().slice(-4)}`,
                      label: `Bina Bloğu #${currentBlocks.length + 1}`,
                      x: (currentBlocks.length % 3) * 4 - 4,
                      z: (currentBlocks.length % 2) * 5,
                      specialFeature: undefined,
                    };
                    setBlocks([...currentBlocks, nextBlk]);
                    setSelectedBlockId(nextBlk.id);
                  }}
                  className="px-3 py-1.5 bg-[#181816] text-white font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Yeni Kütle Ekle
                </button>
                <button
                  onClick={() => setExportTrigger((n) => n + 1)}
                  className="px-3 py-1.5 bg-white border border-stone-300 font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <Box className="w-3.5 h-3.5 text-[#C85A17]" /> 3D .OBJ İndir
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8">
                <Viewport3D
                  city={city}
                  season={season}
                  dayOfYear={SEASON_REPRESENTATIVE_DOY[season].doy}
                  solarHour={solarHour}
                  onChangeSolarHour={setSolarHour}
                  site={DEFAULT_SITE}
                  blocks={currentBlocks}
                  neighbors={EMPTY_NEIGHBORS}
                  selectedBlockId={activeBlock?.id ?? null}
                  onSelectBlock={(id) => {
                    if (id) setSelectedBlockId(id);
                  }}
                  globalOrientationDeg={generatedOrientationDeg}
                  courtyardAreaM2={generatedCourtyardM2}
                  activeMaterialWallColor={activeWallColor}
                  activeMaterialRoofColor={activeRoofColor}
                  exportTrigger={exportTrigger}
                  terrainGrid3x3M={tp.grid3x3M}
                  nativeSlopePct={tp.slopePct}
                  effectiveSlopePct={effectiveSlopePct}
                  soilClass={effectiveSoilClass}
                  planUnderlay={planUnderlay}
                  imported3DModel={imported3DModel}
                  onDropProjectFile={onDropProjectFile}
                />
              </div>

              {/* SAĞ PANEL: TAM KÜTLE, BOYUT, CEPHE, BALKON VE ÇATI DÜZENLEYİCİ */}
              <div className="lg:col-span-4 bg-[#FAF9F6] border border-stone-200 p-4 space-y-3 text-xs">
                {activeBlock ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-[#181816]">Seçili Bölüm & Bina Ayarı</strong>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const dup: MassBlock = {
                              ...activeBlock,
                              id: `dup_${Date.now().toString().slice(-4)}`,
                              label: `${activeBlock.label} (Kopya)`,
                              x: Math.min(28, activeBlock.x + 6),
                              z: Math.min(24, activeBlock.z + 4),
                            };
                            setBlocks([...currentBlocks, dup]);
                            setSelectedBlockId(dup.id);
                          }}
                          className="text-stone-700 hover:text-[#181816] flex items-center gap-1"
                          title="Seçili bloğu çoğalt"
                        >
                          <Copy className="w-3.5 h-3.5" /> Çoğalt
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rem = currentBlocks.filter((b) => b.id !== activeBlock.id);
                            setBlocks(rem);
                            setSelectedBlockId(rem[0]?.id ?? null);
                          }}
                          className="text-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Sil
                        </button>
                      </div>
                    </div>

                    <select
                      value={activeBlock.id}
                      onChange={(e) => setSelectedBlockId(e.target.value)}
                      className="w-full bg-white border border-stone-300 px-2.5 py-2 font-semibold"
                    >
                      {currentBlocks.map((b, i) => (
                        <option key={b.id} value={b.id}>
                          {i + 1}. {b.label} ({b.width}×{b.depth}m · {b.floors} Kat)
                        </option>
                      ))}
                    </select>

                    <div>
                      <label className="block text-stone-600 mb-1">Bölüm / Blok Adı</label>
                      <input
                        type="text"
                        value={activeBlock.label}
                        onChange={(e) => updateActiveBlock({ label: e.target.value })}
                        className="w-full bg-white border border-stone-300 px-2.5 py-1.5 font-medium"
                      />
                    </div>

                    {/* Genişlik & Derinlik */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Genişlik</span>
                          <strong>{activeBlock.width}m</strong>
                        </label>
                        <input
                          type="range"
                          min={3}
                          max={48}
                          step={0.5}
                          value={activeBlock.width}
                          onChange={(e) => {
                            const w = Number(e.target.value);
                            updateActiveBlock({
                              width: w,
                              ridgeDirection: w >= activeBlock.depth ? 'EW' : 'NS',
                            });
                          }}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Derinlik</span>
                          <strong>{activeBlock.depth}m</strong>
                        </label>
                        <input
                          type="range"
                          min={3}
                          max={42}
                          step={0.5}
                          value={activeBlock.depth}
                          onChange={(e) => {
                            const d = Number(e.target.value);
                            updateActiveBlock({
                              depth: d,
                              ridgeDirection: activeBlock.width >= d ? 'EW' : 'NS',
                            });
                          }}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Kat Adedi & Kat Yüksekliği */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Kat Adedi</span>
                          <strong>{activeBlock.floors}</strong>
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={12}
                          value={activeBlock.floors}
                          onChange={(e) => updateActiveBlock({ floors: Number(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Kat Yüksekliği</span>
                          <strong>{activeBlock.floorHeight.toFixed(1)}m</strong>
                        </label>
                        <input
                          type="range"
                          min={2.8}
                          max={14}
                          step={0.2}
                          value={activeBlock.floorHeight}
                          onChange={(e) =>
                            updateActiveBlock({ floorHeight: Number(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Konum X, Z ve Dönüş Açısı */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>X</span>
                          <strong>{activeBlock.x}m</strong>
                        </label>
                        <input
                          type="range"
                          min={-30}
                          max={30}
                          step={0.5}
                          value={activeBlock.x}
                          onChange={(e) => updateActiveBlock({ x: Number(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Z</span>
                          <strong>{activeBlock.z}m</strong>
                        </label>
                        <input
                          type="range"
                          min={-26}
                          max={26}
                          step={0.5}
                          value={activeBlock.z}
                          onChange={(e) => updateActiveBlock({ z: Number(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="flex justify-between mb-1">
                          <span>Açı</span>
                          <strong>{activeBlock.rotationDeg}°</strong>
                        </label>
                        <input
                          type="range"
                          min={-90}
                          max={90}
                          step={5}
                          value={activeBlock.rotationDeg}
                          onChange={(e) =>
                            updateActiveBlock({ rotationDeg: Number(e.target.value) })
                          }
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Dış Cephe Malzemesi & Özel Eleman */}
                    <div className="grid grid-cols-1 gap-2 pt-1 border-t border-stone-200">
                      <div>
                        <label className="block text-stone-600 mb-1">Dış Cephe Görünümü</label>
                        <select
                          value={activeBlock.customWallHex ?? '#EAE3D2'}
                          onChange={(e) => {
                            const sw = FACADE_SWATCHES.find((s) => s.hex === e.target.value);
                            updateActiveBlock({
                              customWallHex: e.target.value,
                              glazingStyle: sw?.glazing ?? activeBlock.glazingStyle,
                            });
                          }}
                          className="w-full bg-white border border-stone-300 px-2.5 py-1.5 font-semibold"
                        >
                          {FACADE_SWATCHES.map((sw) => (
                            <option key={sw.hex} value={sw.hex}>
                              {sw.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-stone-600 mb-1">Özel Mimari Eleman</label>
                        <select
                          value={activeBlock.specialFeature ?? 'none'}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveBlock({
                              specialFeature:
                                val === 'none'
                                  ? undefined
                                  : (val as MassBlock['specialFeature']),
                            });
                          }}
                          className="w-full bg-white border border-stone-300 px-2.5 py-1.5 font-semibold"
                        >
                          <option value="none">Standart Cephe</option>
                          <option value="balconies">Çıkma Balkonlar (Konut / Otel)</option>
                          <option value="entrance_canopy">Zemin Giriş Saçağı</option>
                          <option value="arcade">Kemerli Revak / Kolonad</option>
                          <option value="outdoor_pool">Açık Yüzme Havuzu</option>
                          <option value="sadirvan">Şadırvan (Avlu Pavyonu)</option>
                          <option value="minaret">Minare</option>
                        </select>
                      </div>
                    </div>

                    {/* Çatı / Üst Örtü Ayarları */}
                    <div className="pt-1 border-t border-stone-200 space-y-2">
                      <div>
                        <label className="block text-stone-600 mb-1">Çatı / Üst Örtü Tipi</label>
                        <select
                          value={activeBlock.roofType}
                          onChange={(e) =>
                            updateActiveBlock({ roofType: e.target.value as RoofTypeKey })
                          }
                          className="w-full bg-white border border-stone-300 px-2.5 py-1.5 font-semibold"
                        >
                          {ROOF_OPTIONS.map((ro) => (
                            <option key={ro.key} value={ro.key}>
                              {ro.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="flex justify-between mb-1">
                            <span>Çatı Açısı</span>
                            <strong>{activeBlock.roofPitchDeg}°</strong>
                          </label>
                          <input
                            type="range"
                            min={5}
                            max={45}
                            value={activeBlock.roofPitchDeg}
                            onChange={(e) =>
                              updateActiveBlock({ roofPitchDeg: Number(e.target.value) })
                            }
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="flex justify-between mb-1">
                            <span>Güney Saçak</span>
                            <strong>{activeBlock.overhangSouthM}m</strong>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={2.5}
                            step={0.1}
                            value={activeBlock.overhangSouthM}
                            onChange={(e) =>
                              updateActiveBlock({ overhangSouthM: Number(e.target.value) })
                            }
                            className="w-full"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 pt-1 cursor-pointer font-medium text-stone-700">
                        <input
                          type="checkbox"
                          checked={activeBlock.hasPvPanels}
                          onChange={(e) => updateActiveBlock({ hasPvPanels: e.target.checked })}
                        />
                        Çatıya Güneş Enerjisi Paneli (PV) Yerleştir
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center space-y-3 text-stone-600">
                    <div className="font-bold text-sm text-[#181816]">
                      Arsada Seçili Kütle Bulunmuyor
                    </div>
                    <p className="leading-relaxed">
                      Üstteki kareli arsa üzerinde fareyle sürükleyerek kendi binanızı çizebilir,
                      proje dosyası sürükleyebilir veya aşağıdaki butonla ilk bloğunuzu
                      ekleyebilirsiniz.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const first: MassBlock = {
                          id: `blk_${Date.now().toString().slice(-4)}`,
                          label: 'Ana Bina Bloğu',
                          role: 'primary_living',
                          x: 0,
                          z: 0,
                          width: 18,
                          depth: 11,
                          floors: 3,
                          floorHeight: 3.3,
                          rotationDeg: 0,
                          roofType: 'gable',
                          roofPitchDeg: 22,
                          secondaryPitchDeg: 85,
                          overhangSouthM: 1.0,
                          sawtoothCount: 3,
                          skylightRatio: 0.25,
                          ridgeDirection: 'EW',
                          hasPvPanels: false,
                          glazingStyle: 'punched',
                          customWallHex: '#EAE3D2',
                          customRoofHex: '#475569',
                        };
                        setBlocks([first]);
                        setSelectedBlockId(first.id);
                      }}
                      className="px-4 py-2 bg-[#181816] text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> İlk Bina Bloğunu Ekle
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
            Kaynak: {ce.sourceName} — {ce.periodLabel} ({ce.daysAnalyzed} günlük güncel ölçüm)
          </p>
        </div>

        {ce.liveNow && (
          <div className="bg-[#FAF9F5] border border-stone-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-[#15803D] uppercase tracking-wider mr-2">
                ● Canlı Saha Gözlemi ({ce.liveNow.observedAt}):
              </span>
              <span>
                Şu an Rüzgar: <strong>{ce.liveNow.windDirectionName}</strong> (
                {ce.liveNow.windSpeedMs} m/s) · Hava: <strong>{ce.liveNow.tempC}°C</strong> (Nem %
                {ce.liveNow.humidityPct})
              </span>
            </div>
            {ce.liveNow.soilMoistureSurfaceM3M3 != null && (
              <div className="text-stone-600 font-mono">
                Canlı Toprak Nemi: <strong>{ce.liveNow.soilMoistureSurfaceM3M3.toFixed(3)} m³/m³</strong>
                {ce.liveNow.soilTempSurfaceC != null
                  ? ` · Toprak Sıcaklığı: ${ce.liveNow.soilTempSurfaceC}°C`
                  : ''}
              </div>
            )}
          </div>
        )}

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
            <span className="text-stone-500 block">Uç Değerler, Güneş & Çatı Rüzgar Yükü</span>
            <strong className="text-sm text-[#181816] block mt-0.5">
              {ce.recordMinTempC}°C / +{ce.recordMaxTempC}°C
            </strong>
            <span className="text-stone-600 block mt-1">
              Güneş: <strong>{ce.annualSolarKwhM2} kWh/m²</strong>
              {ce.nasaSolarKwhM2 ? ` (NASA Teyit: ${ce.nasaSolarKwhM2})` : ''}
              {ce.roofWindPressureKnM2 != null
                ? ` · Çatı Rüzgar Basıncı: ${ce.roofWindPressureKnM2} kN/m²`
                : ''}
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
            Arazi Düz mü, Eğimli mi? Toprak Yapısına Göre Nasıl Bina Yapılmalı?
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Kaynaklar: {tp.sourceName} · {sm.sources.slice(0, 3).join(' · ')}
          </p>
        </div>

        <TerrainSoil3DBlock
          topography={tp}
          effectiveSlopePct={effectiveSlopePct}
          soilClass={effectiveSoilClass}
          soilTitle={sm.soilTypeTitle}
          minFrostDepthCm={sm.minFrostDepthCm}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-2.5">
            <div className="font-bold text-[#181816] flex items-center gap-2">
              <Mountain className="w-4 h-4 text-[#C85A17]" />
              13 Noktalı Uydu Topoğrafya, Eğim ve Drenaj Konumu
            </div>
            <div className="text-xs space-y-1 text-stone-700">
              <div>
                <strong>Merkez Rakım:</strong> {tp.elevationM} m (90m çevrede K:{' '}
                {tp.neighbors100m.northM}m, G: {tp.neighbors100m.southM}m, D:{' '}
                {tp.neighbors100m.eastM}m, B: {tp.neighbors100m.westM}m)
              </div>
              <div>
                <strong>Hesaplanan Eğim (Horn 3x3 CBS):</strong> %{effectiveSlopePct} (Uydu: %
                {tp.slopePct}, {tp.slopeDeg}°) — <strong>{tp.landformType}</strong>
              </div>
              <div>
                <strong>Yamaç Yönü (Bakı):</strong> {tp.aspectLabel}
              </div>
              <div>
                <strong>Su Drenaj Konumu (TPI {tp.tpiM > 0 ? `+${tp.tpiM}` : tp.tpiM}m):</strong>{' '}
                {tp.drainagePositionLabel}
              </div>
            </div>
            <p className="text-xs text-stone-600 pt-1 border-t border-stone-200 leading-relaxed">
              {tp.architecturalGuidance.join(' ')}
            </p>
          </div>

          <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-2.5">
            <div className="font-bold text-[#181816] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#181816]" />
              Toprak / Derin Temel Nemi, Don Derinliği ve Sismik Kayıt
            </div>
            <div className="text-xs space-y-1 text-stone-700">
              <div>
                <strong>Jeolojik Birim:</strong> {sm.geologicAgeTr} ({sm.geologicUnitRaw})
              </div>
              <div>
                <strong>Zemin Karakteri:</strong> {sm.soilTypeTitle} (Aktif Sınıf:{' '}
                <strong>TBDY 2018 {effectiveSoilClass}</strong>)
              </div>
              <div>
                <strong>120 km Çevrede Gerçek Deprem & Yer İvmesi:</strong> M≥4.5 olan{' '}
                <strong>{sm.seismicCount100km} deprem</strong> (En büyük:{' '}
                <strong>M {sm.maxHistoricalMag || '<4.5'}</strong>
                {sm.nearestQuakeKm != null ? `, En yakın: ${sm.nearestQuakeKm} km` : ''} · Tahmini
                Kaya İvmesi: <strong>~{sm.estimatedPgaG}g</strong>)
              </div>
              <div>
                <strong>Temel Kotu (1.0–2.5m) Zemin & Don Verisi:</strong> Min. Don Derinliği{' '}
                <strong>{sm.minFrostDepthCm} cm</strong>
                {sm.annualFrostDays != null ? ` (${sm.annualFrostDays} donlu gün/yıl)` : ''}
                {sm.deepFoundationMoistureM3M3 != null
                  ? ` · Temel Nemi: ${sm.deepFoundationMoistureM3M3} m³/m³`
                  : ''}
                {sm.nasaRootWetnessPct != null
                  ? ` · NASA Zemin Doygunluğu: %${sm.nasaRootWetnessPct}`
                  : ''}
              </div>
            </div>
            <p className="text-xs text-stone-600 pt-1 border-t border-stone-200 leading-relaxed">
              {sm.soilDescription}
            </p>
          </div>
        </div>

        <div className="border border-stone-200 bg-white">
          <button
            type="button"
            onClick={() => setShowFieldOverride(!showFieldOverride)}
            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center justify-between"
          >
            <span>
              Elinizde parselin güncel Zemin Etüdü Raporu veya Belediye Plankote Eğimi var mı?
              (Saha Verisiyle Güncelle)
            </span>
            {showFieldOverride ? (
              <ChevronUp className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" />
            )}
          </button>

          {showFieldOverride && (
            <div className="p-4 border-t border-stone-200 bg-[#FAF9F6] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Sondajlı Zemin Etüdü Sınıfı (TBDY 2018)
                </label>
                <select
                  value={overrideSoilClass}
                  onChange={(e) =>
                    setOverrideSoilClass(e.target.value as 'AUTO' | 'ZB' | 'ZC' | 'ZD' | 'ZE')
                  }
                  className="w-full bg-white border border-stone-300 px-3 py-2 font-semibold"
                >
                  <option value="AUTO">
                    Otomatik Uydu/Jeoloji Tahmini ({sm.estimatedTbdyClass})
                  </option>
                  <option value="ZB">ZB — Az Ayrışmış Sağlam Kaya</option>
                  <option value="ZC">ZC — Çok Sıkı Kum/Çakıl veya Yumuşak Kaya</option>
                  <option value="ZD">ZD — Orta Sıkı Kum/Kil Tabakası</option>
                  <option value="ZE">ZE — Gevşek Kum / Yumuşak Alüvyon Kil</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Plankote Arazi Eğimi (% Olarak — Boşsa Uydu Verisi: %{tp.slopePct})
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={overrideSlopePct}
                  onChange={(e) => setOverrideSlopePct(e.target.value)}
                  placeholder={`Uydu ölçümü: %${tp.slopePct}`}
                  className="w-full bg-white border border-stone-300 px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#FAF9F5] border-l-4 border-[#181816] p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
          <div className="font-bold text-[#181816]">
            Toprak ve Deprem Verisine Göre Önerilen Bina Kütlesi (Ağırlığı) ve Temel Sistemi
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-stone-200 p-3.5 text-xs">
            <div>
              <span className="text-stone-500 block">Önerilen Birim Bina Kütlesi</span>
              <strong className="text-base text-[#15803D]">
                {effectiveMassCalc.recommendedUnitMassKgM2.min} –{' '}
                {effectiveMassCalc.recommendedUnitMassKgM2.max} kg/m²
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
                {effectiveMassCalc.recommendedFoundation}
              </strong>
            </div>
          </div>

          <div className="text-xs text-stone-700 space-y-1.5 leading-relaxed">
            <div>
              <strong>Önerilen Taşıyıcı Sistem:</strong> {effectiveMassCalc.recommendedStructure}
            </div>
            {effectiveMassCalc.buildingSoilRules.map((rule, idx) => (
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
            {displayProgTitle} ({targetAreaM2.toLocaleString('tr-TR')} m²) İçin İklimsel Avlu ve
            Mekan Programı
          </h3>
        </div>

        <div className="bg-[#FAF9F6] border border-stone-300 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#15803D]">İKLİMSEL YERLEŞİM PRENSİBİ</span>
              <h4 className="text-lg font-bold text-[#181816]">{activeRec.name}</h4>
            </div>
            <div className="text-sm font-bold text-[#181816]">
              İklim Uyum Skoru: %{activeRec.totalScore} · Avlu/Açık Alan: {generatedCourtyardM2} m²
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
            Üst Örtü / Çatı Tasarımı ve Lokasyona Yakın Sürdürülebilir Malzemeler
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Kaynak: TS 825 Binalarda Isı Yalıtım Kuralları (Bölge {city.ts825Zone} Sınır U ≤{' '}
            {assemblySummary.ts825WallLimit} W/m²K) & Bölgesel Üretim Mesafeleri
          </p>
        </div>

        <div className="bg-[#FAF9F6] border border-stone-200 p-4 space-y-1.5 text-xs sm:text-sm">
          <div className="font-bold text-[#181816] flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#C85A17]" />
            Önerilen Üst Örtü / Çatı Tasarımı: {ROOF_TYPES_META[optRoof.roofType].name}
          </div>
          <p className="text-stone-700 leading-relaxed">{optRoof.reasoning}</p>
          <div className="flex flex-wrap gap-4 pt-1 font-mono text-xs text-stone-700">
            <span>
              Önerilen Çatı Açısı: <strong>{optRoof.roofPitchDeg}°</strong>
            </span>
            <span>
              Güney Saçak Uzantısı: <strong>{optRoof.overhangSouthM} m</strong>
            </span>
            <span>
              Kış Güneşi Odaya Giriş Derinliği: <strong>{roofPerf.winterSunPenetrationM} m</strong>
            </span>
          </div>
        </div>

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
      {/* BÖLÜM 5: AÇIK VE DOĞRULANABİLİR BİLİMSEL VERİ KAYNAKLARI              */}
      {/* ===================================================================== */}
      <section className="bg-white border border-stone-200 p-6 space-y-3 text-xs text-stone-600">
        <div className="font-bold text-sm text-[#181816]">
          Veri Doğrulama ve Bilimsel Kaynakça (Bu Tam Konum İçin Teyit Linkleri)
        </div>
        <p>
          Bu rapordaki hiçbir iklim, rüzgar, rakım, eğim veya deprem verisi rastgele üretilmemiştir;
          aşağıdaki uluslararası ve ulusal mühendislik kaynaklarından{' '}
          <strong>
            ({city.lat.toFixed(5)}°K, {city.lng.toFixed(5)}°D)
          </strong>{' '}
          koordinatı için canlı hesaplanmıştır:
        </p>
        <ul className="space-y-1.5">
          <li>
            1. <strong>Meteoroloji ve Rüzgar Yönü Serisi:</strong> ECMWF ERA5 Sürekli Güncellenen
            Yeniden Analiz Veri Seti ({ce.periodLabel}, {ce.daysAnalyzed} gün) —{' '}
            <a
              href={`https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat.toFixed(
                5
              )}&longitude=${city.lng.toFixed(5)}&start_date=${ce.startDateIso}&end_date=${
                ce.endDateIso
              }&daily=temperature_2m_mean,wind_direction_10m_dominant,wind_speed_10m_mean`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham ERA5 Güncel Verisini Görüntüle <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            2. <strong>Topoğrafya, Rakım ve Eğim:</strong> Copernicus DEM GLO-90 Uydu Sayısal
            Yükselti Modeli —{' '}
            <a
              href={`https://www.openstreetmap.org/?mlat=${city.lat.toFixed(
                6
              )}&mlon=${city.lng.toFixed(6)}#map=17/${city.lat.toFixed(6)}/${city.lng.toFixed(6)}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              OpenStreetMap Tam Parsel Konumunu Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            3. <strong>Jeolojik Birim ve Zemin Karakteri:</strong> Macrostrat Jeolojik Harita API
            (MTA 1/500.000 Türkiye Jeoloji Haritası Birimleriyle Uyumlu) —{' '}
            <a
              href={`https://macrostrat.org/api/v2/geologic_units/map?lat=${city.lat.toFixed(
                5
              )}&lng=${city.lng.toFixed(5)}&response=long`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham Jeoloji Verisini Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            4. <strong>Bölgesel Deprem Kayıtları ve Yer İvmesi (PGA):</strong> USGS Earthquake
            Hazards Program Güncel Kataloğu (120 km yarıçap) & AFAD TBDY 2018 Kütle İlkeleri —{' '}
            <a
              href={`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${city.lat.toFixed(
                5
              )}&longitude=${city.lng.toFixed(5)}&maxradiuskm=120&minmagnitude=4.5&starttime=1970-01-01`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham USGS Sismik Kayıtlarını Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            5. <strong>NASA Uydu Bina Klimatolojisi, Zemin Doygunluğu ve Don Günü:</strong> NASA
            Langley Research Center POWER Sustainable Buildings (community=SB) —{' '}
            <a
              href={`https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,WS50M,GWETPROF,FROST_DAYS&community=SB&longitude=${city.lng.toFixed(
                5
              )}&latitude=${city.lat.toFixed(5)}&format=JSON`}
              target="_blank"
              rel="noreferrer"
              className="text-[#C85A17] underline inline-flex items-center gap-0.5"
            >
              Ham NASA POWER Verisini Aç <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            6. <strong>Isı Yalıtımı ve Malzeme Karbon Standartları:</strong> TS 825 Binalarda Isı
            Yalıtım Kuralları Standardı, NOAA Güneş Denklemleri ve ICE v3 Yapı Malzemeleri LCA
            Veritabanı.
          </li>
        </ul>
      </section>
    </div>
  );
};

export default App;
