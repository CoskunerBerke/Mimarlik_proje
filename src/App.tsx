import React, { useEffect, useMemo, useState } from 'react';
import {
  BuildingFunctionKey,
  CityClimateProfile,
  MassBlock,
  MassTypologyKey,
  MaterialCategoryKey,
  NeighborContextBlock,
  SeasonKey,
  SiteParameters,
  TypologyRecommendation,
} from './types/architecture';
import { CITIES } from './data/cities';
import { BUILDING_PROGRAMS } from './data/programs';
import { SEASON_REPRESENTATIVE_DOY } from './engine/solarEngine';
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
import { HeaderBar } from './components/HeaderBar';
import { Viewport3D } from './components/Viewport3D';
import { SiteClimatePanel } from './components/SiteClimatePanel';
import { MassingProgramPanel } from './components/MassingProgramPanel';
import { RoofPluginPanel } from './components/RoofPluginPanel';
import { MaterialPanel } from './components/MaterialPanel';
import { ArchitectureDocsModal } from './components/ArchitectureDocsModal';

type TabKey = 'climate' | 'massing' | 'roof_plugin' | 'materials';

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
    label: 'Güney Komşu Yapı (Kış Gölgesi Testi)',
    direction: 'Güney',
    enabled: false,
    heightM: 15,
    distanceM: 12,
    widthM: 42,
    depthM: 16,
  },
  {
    id: 'nb_west',
    label: 'Batı Komşu Yapı (İkindi Gölgesi)',
    direction: 'Batı',
    enabled: true,
    heightM: 12,
    distanceM: 10,
    widthM: 16,
    depthM: 38,
  },
  {
    id: 'nb_north',
    label: 'Kuzey Komşu Yapı (Rüzgar Perdesi)',
    direction: 'Kuzey',
    enabled: false,
    heightM: 16,
    distanceM: 12,
    widthM: 44,
    depthM: 16,
  },
  {
    id: 'nb_east',
    label: 'Doğu Komşu Yapı',
    direction: 'Doğu',
    enabled: false,
    heightM: 11,
    distanceM: 11,
    widthM: 15,
    depthM: 36,
  },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('climate');
  const [docsOpen, setDocsOpen] = useState(false);

  // 1. İklim & Zaman Durumu
  const [city, setCity] = useState<CityClimateProfile>(CITIES[0]); // İstanbul varsayılan
  const [season, setSeason] = useState<SeasonKey>('summer');
  const [dayOfYear, setDayOfYear] = useState<number>(SEASON_REPRESENTATIVE_DOY.summer.doy);
  const [solarHour, setSolarHour] = useState<number>(13.5);

  // 2. Arsa ve Komşu Bağlamı
  const [site, setSite] = useState<SiteParameters>(INITIAL_SITE);
  const [neighbors, setNeighbors] = useState<NeighborContextBlock[]>(INITIAL_NEIGHBORS);

  // 3. Bina Fonksiyonu, Metrekare ve Kütleler
  const [funcKey, setFuncKey] = useState<BuildingFunctionKey>('education');
  const [targetAreaM2, setTargetAreaM2] = useState<number>(4200);
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

  // Şehir, fonksiyon, hedef m² veya parsel değiştiğinde optimal öneriyi sahneye senkronla
  useEffect(() => {
    const topRec = recommendations[0];
    if (!topRec) return;
    setActiveTypologyKey(topRec.key);
    setBlocks(topRec.blocks);
    setSelectedBlockId(topRec.blocks[0]?.id ?? null);
    setCourtyardAreaM2(topRec.courtyardAreaM2);
    setGlobalOrientationDeg(topRec.recommendedOrientationDeg);
  }, [city.id, funcKey, targetAreaM2, site.parcelWidthM, site.parcelDepthM]);

  // 4. Yerel Malzeme ve Sürdürülebilirlik Durumu
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

  // Toplam gerçek inşaat alanı ve toplam çatı BIPV üretimi
  const actualBuiltAreaM2 = useMemo(
    () =>
      Math.round(
        blocks.reduce((acc, b) => acc + b.width * b.depth * b.floors, 0)
      ),
    [blocks]
  );

  const totalRoofMetrics = useMemo(() => {
    let pvKwh = 0;
    let rainM3 = 0;
    let dfSum = 0;
    for (const b of blocks) {
      const m = analyzeBlockRoofPerformance(b, city);
      pvKwh += m.annualPvYieldKwh;
      rainM3 += m.rainwaterHarvestM3Yr;
      dfSum += m.estimatedDaylightFactorPct;
    }
    return {
      pvKwh,
      rainM3,
      avgDf: blocks.length ? Number((dfSum / blocks.length).toFixed(1)) : 0,
    };
  }, [blocks, city]);

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

  const activeWallColor = useMemo(() => {
    const f = evaluatedMaterials.find((e) => e.material.id === selectedMaterials.envelope_wall);
    return f?.material.colorHex ?? '#D6D3C9';
  }, [evaluatedMaterials, selectedMaterials.envelope_wall]);

  const activeRoofColor = useMemo(() => {
    const r = evaluatedMaterials.find((e) => e.material.id === selectedMaterials.roof_finish);
    return r?.material.colorHex ?? '#334155';
  }, [evaluatedMaterials, selectedMaterials.roof_finish]);

  const [exportTrigger, setExportTrigger] = useState(0);

  // Mevsim seçildiğinde yılın temsilci gününü güncelle
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

  // 3D Kütle Eklentisi İşlemleri
  const handleUpdateBlock = (updated: MassBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleAddBlock = () => {
    const fh = BUILDING_PROGRAMS[funcKey].defaultFloorHeightM;
    const newId = `custom_${Date.now().toString().slice(-4)}`;
    const draft: MassBlock = {
      id: newId,
      label: `Ek Kütle Modülü #${blocks.length + 1}`,
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
    setActiveTab('roof_plugin');
  };

  const handleDuplicateBlock = (id: string) => {
    const src = blocks.find((b) => b.id === id);
    if (!src) return;
    const copy: MassBlock = {
      ...src,
      id: `dup_${Date.now().toString().slice(-4)}`,
      label: `${src.label} (Kopya)`,
      x: Math.min(35, src.x + 8),
      z: Math.min(35, src.z + 6),
    };
    setBlocks((prev) => [...prev, copy]);
    setSelectedBlockId(copy.id);
  };

  const handleDeleteBlock = (id: string) => {
    if (blocks.length <= 1) return;
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    if (selectedBlockId === id) {
      setSelectedBlockId(next[0]?.id ?? null);
    }
  };

  const handleOptimizeAllRoofs = () => {
    setBlocks((prev) =>
      prev.map((b) => {
        const opt = recommendOptimalRoofForBlock(b, city, funcKey);
        return {
          ...b,
          roofType: opt.roofType,
          roofPitchDeg: opt.roofPitchDeg,
          secondaryPitchDeg: opt.secondaryPitchDeg,
          overhangSouthM: opt.overhangSouthM,
          sawtoothCount: opt.sawtoothCount,
          skylightRatio: opt.skylightRatio,
          hasPvPanels: opt.hasPvPanels,
        };
      })
    );
  };

  // Kapsamlı Mimari Karar Destek Raporu İndir (.md)
  const handleExportReport = () => {
    const prog = BUILDING_PROGRAMS[funcKey];
    const activeRec =
      recommendations.find((r) => r.key === activeTypologyKey) || recommendations[0];

    const matLines = (Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategoryKey[])
      .map((cat) => {
        const ev = evaluatedMaterials.find((e) => e.material.id === selectedMaterials[cat]);
        if (!ev) return '';
        return `- **${MATERIAL_CATEGORY_LABELS[cat]}:** ${ev.material.name} (${ev.material.originCity} — ${ev.distanceKm} km, Gömülü Karbon: ${ev.totalCarbonKgM2} kgCO₂e/m², Uyum: ${ev.overallScore}/100)`;
      })
      .join('\n');

    const blockLines = blocks
      .map(
        (b, idx) =>
          `${idx + 1}. **${b.label}** — ${b.width}m x ${b.depth}m, ${b.floors} Kat (${Math.round(
            b.width * b.depth * b.floors
          )} m²) | Çatı: ${ROOF_TYPES_META[b.roofType].name} (Eğim: ${b.roofPitchDeg}°, Güney Saçak: ${
            b.overhangSouthM
          }m, Saydamlık: %${Math.round(b.skylightRatio * 100)})`
      )
      .join('\n');

    const md = `# İKLİMFORM — İklim Duyarlı Mimari Kütle, Solar Çatı ve Sürdürülebilir Malzeme Raporu

## 1. Lokasyon ve Mevsimsel İklim Verileri
- **Konum:** ${city.name} (${city.region}) — ${city.lat.toFixed(3)}°K, ${city.lng.toFixed(3)}°D | Rakım: ${city.elevationM} m
- **İklim Sınıfı:** ${city.koppen} (${city.koppenDesc}) | TS 825 Bölge: ${city.ts825Zone}
- **Isıtma / Soğutma Gün Derece:** ${city.heatingDegreeDays} HDD / ${city.coolingDegreeDays} CDD | Kar Yükü: ${city.annualSnowLoadKnM2} kN/m²
- **Yaz Hakim Rüzgarı:** ${city.seasons.summer.windLabel} (${city.seasons.summer.windSpeedMs} m/s) | Ort. Yaz Sıcaklığı: ${city.seasons.summer.avgTempC}°C
- **Kış Hakim Rüzgarı:** ${city.seasons.winter.windLabel} (${city.seasons.winter.windSpeedMs} m/s) | Ort. Kış Sıcaklığı: ${city.seasons.winter.avgTempC}°C

## 2. Mimari Program ve Optimal Kütle / Avlu Kararı
- **Bina Fonksiyonu:** ${prog.title}
- **Hedef / Gerçekleşen İnşaat Alanı:** ${targetAreaM2} m² / ${actualBuiltAreaM2} m²
- **Seçilen Kütle Tipolojisi:** ${activeRec.name} (Uyum Skoru: ${activeRec.totalScore}/100)
- **Avlu Alanı & Oranı:** ${courtyardAreaM2} m² (${activeRec.courtyardRatioHW}) | Kütle Yönelimi: ${globalOrientationDeg}°

### Mekan Dağılımı:
${prog.spaces
  .map(
    (s) =>
      `- **${s.name}:** ${Math.round((targetAreaM2 * s.ratioPct) / 100)} m² (%${s.ratioPct}) — Yönelim: ${s.preferredOrientation}, Hedef Günışığı: %${s.targetDaylightFactor} DF`
  )
  .join('\n')}

## 3. 3D Kütle Modülleri ve Parametrik Solar Çatı Açıları
${blockLines}

- **Toplam Yıllık Çatı BIPV Elektrik Üretimi:** ${totalRoofMetrics.pvKwh.toLocaleString('tr-TR')} kWh/yıl
- **Yıllık Çatı Yağmur Suyu Hasadı Potansiyeli:** ${totalRoofMetrics.rainM3} m³/yıl
- **Ortalama İç Mekan Günışığı Faktörü:** %${totalRoofMetrics.avgDf} DF

## 4. Yerel Malzeme Seçimi, Erişilebilirlik ve Gömülü Karbon (LCA)
- **Dış Duvar Toplam U-Değeri:** ${assemblySummary.wallUValueWm2K} W/m²K (TS 825 Bölge ${city.ts825Zone} Sınırı: ≤ ${assemblySummary.ts825WallLimit} W/m²K — ${assemblySummary.passesTs825 ? 'UYGUN' : 'İLAVE YALITIM GEREKLİ'})
- **Termal Faz Kayması:** ${assemblySummary.thermalLagHours} saat
- **Toplam Gömülü Karbon:** ${assemblySummary.embodiedCarbonPerBuiltM2} kgCO₂e/m² (${assemblySummary.totalProjectCarbonTons} ton CO₂e | Konvansiyonel referansa göre %${assemblySummary.carbonSavedPct} azaltım)
- **Yerel Tedarik Oranı (<500 km):** %${assemblySummary.regionalRatioPct}

${matLines}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iklimform_mimari_rapor_${city.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4F0] text-[#161615]">
      <HeaderBar
        season={season}
        onSelectSeason={handleSelectSeason}
        dayOfYear={dayOfYear}
        solarHour={solarHour}
        onChangeSolarHour={setSolarHour}
        onExportObj={() => setExportTrigger((n) => n + 1)}
        onExportReport={handleExportReport}
        onOpenDocs={() => setDocsOpen(true)}
      />

      {/* Ana Çalışma Alanı: Sol 3D Analiz Sahnesi + Sağ Mühendislik/Tasarım Panelleri */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Sol/Orta: 3D Etkileşimli Sahne + Üst Performans Gösterge Şeridi */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col p-3 gap-3">
          {/* Canlı Mimari Performans Şeridi (Numaralı 01-04 Editoryal Kartlar) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white border border-[#D8D5CA] p-2.5">
            <div className="border-r border-[#ECEAE2] pr-2 last:border-r-0">
              <div className="font-mono text-[10px] text-stone-400">01 KÜTLE & ALAN</div>
              <div className="font-mono text-sm font-bold text-[#161615]">
                {actualBuiltAreaM2.toLocaleString('tr-TR')} m²
              </div>
              <div className="text-[11px] text-stone-600 truncate">
                {BUILDING_PROGRAMS[funcKey].title}
              </div>
            </div>

            <div className="sm:border-r border-[#ECEAE2] pr-2">
              <div className="font-mono text-[10px] text-stone-400">02 AVLU & GÜNIŞIĞI</div>
              <div className="font-mono text-sm font-bold text-[#161615]">
                {courtyardAreaM2} m² · %{totalRoofMetrics.avgDf} DF
              </div>
              <div className="text-[11px] text-stone-600 truncate">
                Yönelim: {globalOrientationDeg >= 0 ? `+${globalOrientationDeg}° GD` : `${globalOrientationDeg}°`}
              </div>
            </div>

            <div className="border-r border-[#ECEAE2] pr-2">
              <div className="font-mono text-[10px] text-stone-400">03 ÇATI SOLAR & SU</div>
              <div className="font-mono text-sm font-bold text-[#C85A17]">
                {(totalRoofMetrics.pvKwh / 1000).toFixed(1)} MWh/yıl
              </div>
              <div className="text-[11px] text-stone-600 truncate">
                Yağmur Hasadı: {totalRoofMetrics.rainM3} m³/yıl
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] text-stone-400">04 KABUK & KARBON</div>
              <div className="font-mono text-sm font-bold text-[#15803D]">
                U={assemblySummary.wallUValueWm2K} · -%{assemblySummary.carbonSavedPct} CO₂
              </div>
              <div className="text-[11px] text-stone-600 truncate">
                %{assemblySummary.regionalRatioPct} Yerel Malzeme (&lt;500km)
              </div>
            </div>
          </div>

          {/* 3D Görünüm */}
          <div className="flex-1 min-h-[500px] lg:min-h-0">
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
                setSelectedBlockId(id);
                if (id) setActiveTab('roof_plugin');
              }}
              globalOrientationDeg={globalOrientationDeg}
              courtyardAreaM2={courtyardAreaM2}
              activeMaterialWallColor={activeWallColor}
              activeMaterialRoofColor={activeRoofColor}
              exportTrigger={exportTrigger}
            />
          </div>
        </div>

        {/* Sağ: 4 Modüllü Mimari Karar Destek Kenar Paneli */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-white border-l border-[#D8D5CA] flex flex-col lg:h-[calc(100vh-57px)]">
          {/* Sekme Başlıkları */}
          <nav className="grid grid-cols-4 border-b border-[#D8D5CA] bg-[#F8F7F3] shrink-0">
            {[
              { key: 'climate' as TabKey, num: '01', label: 'İklim & Arazi' },
              { key: 'massing' as TabKey, num: '02', label: 'Kütle & Avlu' },
              { key: 'roof_plugin' as TabKey, num: '03', label: '3D Çatı Eklentisi' },
              { key: 'materials' as TabKey, num: '04', label: 'Malzeme & LCA' },
            ].map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`py-2.5 px-1.5 text-center border-r last:border-r-0 border-[#E2E0D8] transition ${
                    active
                      ? 'bg-white text-[#161615] border-b-2 border-b-[#161615] font-bold'
                      : 'text-stone-600 hover:bg-white/60 font-medium'
                  }`}
                >
                  <span className="block font-mono text-[10px] text-[#C85A17]">{t.num}</span>
                  <span className="block text-[11px] whitespace-nowrap truncate">{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sekme İçeriği */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'climate' && (
              <SiteClimatePanel
                city={city}
                onSelectCity={setCity}
                season={season}
                onSelectSeason={handleSelectSeason}
                dayOfYear={dayOfYear}
                onChangeDayOfYear={setDayOfYear}
                site={site}
                onChangeSite={setSite}
                neighbors={neighbors}
                onChangeNeighbors={setNeighbors}
              />
            )}

            {activeTab === 'massing' && (
              <MassingProgramPanel
                funcKey={funcKey}
                onChangeFuncKey={setFuncKey}
                targetAreaM2={targetAreaM2}
                onChangeTargetAreaM2={setTargetAreaM2}
                globalOrientationDeg={globalOrientationDeg}
                onChangeGlobalOrientationDeg={setGlobalOrientationDeg}
                recommendations={recommendations}
                activeTypologyKey={activeTypologyKey}
                onApplyTypology={handleApplyTypology}
              />
            )}

            {activeTab === 'roof_plugin' && (
              <RoofPluginPanel
                city={city}
                funcKey={funcKey}
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onUpdateBlock={handleUpdateBlock}
                onAddBlock={handleAddBlock}
                onDuplicateBlock={handleDuplicateBlock}
                onDeleteBlock={handleDeleteBlock}
                onOptimizeAllRoofs={handleOptimizeAllRoofs}
              />
            )}

            {activeTab === 'materials' && (
              <MaterialPanel
                city={city}
                evaluatedMaterials={evaluatedMaterials}
                selectedIds={selectedMaterials}
                onSelectMaterial={(cat, id) =>
                  setSelectedMaterials((prev) => ({ ...prev, [cat]: id }))
                }
                onResetOptimalMaterials={() =>
                  setSelectedMaterials(getRecommendedMaterialSelection(evaluatedMaterials))
                }
                assemblySummary={assemblySummary}
              />
            )}
          </div>
        </aside>
      </main>

      <ArchitectureDocsModal open={docsOpen} onClose={() => setDocsOpen(false)} />
    </div>
  );
};

export default App;
