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
    label: 'Güney Komşu Bina',
    direction: 'Güney',
    enabled: false,
    heightM: 15,
    distanceM: 12,
    widthM: 42,
    depthM: 16,
  },
  {
    id: 'nb_west',
    label: 'Batı Komşu Bina',
    direction: 'Batı',
    enabled: false,
    heightM: 12,
    distanceM: 10,
    widthM: 16,
    depthM: 38,
  },
  {
    id: 'nb_north',
    label: 'Kuzey Komşu Bina',
    direction: 'Kuzey',
    enabled: false,
    heightM: 16,
    distanceM: 12,
    widthM: 44,
    depthM: 16,
  },
  {
    id: 'nb_east',
    label: 'Doğu Komşu Bina',
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

  // 1. İklim & Mevsim Durumu
  const [city, setCity] = useState<CityClimateProfile>(CITIES[0]);
  const [season, setSeason] = useState<SeasonKey>('summer');
  const [dayOfYear, setDayOfYear] = useState<number>(SEASON_REPRESENTATIVE_DOY.summer.doy);
  const [solarHour, setSolarHour] = useState<number>(13.5);

  // 2. Arsa ve Komşular
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

  useEffect(() => {
    const topRec = recommendations[0];
    if (!topRec) return;
    setActiveTypologyKey(topRec.key);
    setBlocks(topRec.blocks);
    setSelectedBlockId(topRec.blocks[0]?.id ?? null);
    setCourtyardAreaM2(topRec.courtyardAreaM2);
    setGlobalOrientationDeg(topRec.recommendedOrientationDeg);
  }, [city.id, funcKey, targetAreaM2, site.parcelWidthM, site.parcelDepthM]);

  // 4. Malzeme ve Sürdürülebilirlik
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

  const totalRoofMetrics = useMemo(() => {
    let pvKwh = 0;
    let rainM3 = 0;
    for (const b of blocks) {
      const m = analyzeBlockRoofPerformance(b, city);
      pvKwh += m.annualPvYieldKwh;
      rainM3 += m.rainwaterHarvestM3Yr;
    }
    return { pvKwh, rainM3 };
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

  const activeWallMaterial = useMemo(
    () => evaluatedMaterials.find((e) => e.material.id === selectedMaterials.envelope_wall),
    [evaluatedMaterials, selectedMaterials.envelope_wall]
  );

  const activeRoofMaterial = useMemo(
    () => evaluatedMaterials.find((e) => e.material.id === selectedMaterials.roof_finish),
    [evaluatedMaterials, selectedMaterials.roof_finish]
  );

  const activeRec =
    recommendations.find((r) => r.key === activeTypologyKey) || recommendations[0];

  const [exportTrigger, setExportTrigger] = useState(0);

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

  const handleUpdateBlock = (updated: MassBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleAddBlock = () => {
    const fh = BUILDING_PROGRAMS[funcKey].defaultFloorHeightM;
    const newId = `custom_${Date.now().toString().slice(-4)}`;
    const draft: MassBlock = {
      id: newId,
      label: `Ek Bina #${blocks.length + 1}`,
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

  const handleExportReport = () => {
    const prog = BUILDING_PROGRAMS[funcKey];
    const matLines = (Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategoryKey[])
      .map((cat) => {
        const ev = evaluatedMaterials.find((e) => e.material.id === selectedMaterials[cat]);
        if (!ev) return '';
        return `- **${MATERIAL_CATEGORY_LABELS[cat]}:** ${ev.material.name} (${ev.material.originCity} — ${ev.distanceKm} km mesafede)`;
      })
      .join('\n');

    const blockLines = blocks
      .map(
        (b, idx) =>
          `${idx + 1}. **${b.label}** — ${b.width}m x ${b.depth}m, ${b.floors} Kat | Çatı: ${ROOF_TYPES_META[b.roofType].name} (${b.roofPitchDeg}° eğim, ${b.overhangSouthM}m saçak)`
      )
      .join('\n');

    const md = `# İKLİMFORM — Mimari Öneri Özeti

- **Şehir ve İklim:** ${city.name} (${city.koppenDesc})
- **Bina Türü ve Büyüklük:** ${prog.title} — ${actualBuiltAreaM2.toLocaleString('tr-TR')} m²
- **Önerilen Kütle ve Avlu Şekli:** ${activeRec.name} (Avlu: ${courtyardAreaM2} m²)
- **Karbon Tasarrufu:** Klasik binaya göre %${assemblySummary.carbonSavedPct} daha düşük karbon salımı

## Bina Kütleleri ve Çatı Açıları
${blockLines}

## Önerilen Yerel Malzemeler
${matLines}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iklimform_ozet_${city.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F0] text-[#161615]">
      <HeaderBar
        season={season}
        onSelectSeason={handleSelectSeason}
        solarHour={solarHour}
        onChangeSolarHour={setSolarHour}
        onExportObj={() => setExportTrigger((n) => n + 1)}
        onExportReport={handleExportReport}
      />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Sol: Sade Özet Bandı + 3D Görsel Sahne */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col p-3 lg:p-4 gap-3">
          {/* Tek Bakışta Anlaşılır Türkçe Öneri Bandı */}
          <div className="bg-white border border-stone-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              <strong className="text-[#161615]">{city.name}</strong> ikliminde{' '}
              <strong className="text-[#161615]">
                {actualBuiltAreaM2.toLocaleString('tr-TR')} m² {BUILDING_PROGRAMS[funcKey].title}
              </strong>{' '}
              için önerilen yerleşim:{' '}
              <strong className="text-[#C85A17]">{activeRec.name}</strong> ve yerel{' '}
              <strong className="text-[#161615]">
                {activeWallMaterial?.material.originCity}
              </strong>{' '}
              kaynaklı dış kabuk.
            </div>

            <div className="flex items-center gap-4 shrink-0 text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
              <div>
                <span className="text-stone-400 block text-[11px]">Avlu</span>
                <strong>{courtyardAreaM2} m²</strong>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Çatı Elektriği</span>
                <strong className="text-[#C85A17]">
                  {(totalRoofMetrics.pvKwh / 1000).toFixed(0)} MWh/yıl
                </strong>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Karbon Kazancı</span>
                <strong className="text-[#15803D]">-%{assemblySummary.carbonSavedPct}</strong>
              </div>
            </div>
          </div>

          {/* 3D Sahne */}
          <div className="flex-1 min-h-[480px] lg:min-h-0">
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
              activeMaterialWallColor={activeWallMaterial?.material.colorHex ?? '#D6D3C9'}
              activeMaterialRoofColor={activeRoofMaterial?.material.colorHex ?? '#334155'}
              exportTrigger={exportTrigger}
            />
          </div>
        </div>

        {/* Sağ: Adım Adım Rehber Panel (1 -> 2 -> 3 -> 4) */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-white border-l border-stone-200 flex flex-col lg:h-[calc(100vh-61px)]">
          {/* 4 Basit Adım Sekmesi */}
          <nav className="grid grid-cols-4 border-b border-stone-200 bg-[#FAF9F6] shrink-0">
            {[
              { key: 'climate' as TabKey, step: '1. Adım', label: 'Şehir & İklim' },
              { key: 'massing' as TabKey, step: '2. Adım', label: 'Bina & Avlu' },
              { key: 'roof_plugin' as TabKey, step: '3. Adım', label: '3D Çatı Açısı' },
              { key: 'materials' as TabKey, step: '4. Adım', label: 'Malzemeler' },
            ].map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`py-3 px-1.5 text-center border-r last:border-r-0 border-stone-200 transition ${
                    active
                      ? 'bg-white text-[#161615] border-b-2 border-b-[#161615] font-bold'
                      : 'text-stone-500 hover:bg-white/70 font-medium'
                  }`}
                >
                  <span className="block text-[10px] text-[#C85A17] font-semibold">{t.step}</span>
                  <span className="block text-xs whitespace-nowrap truncate mt-0.5">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Adım İçeriği */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'climate' && (
              <SiteClimatePanel
                city={city}
                onSelectCity={setCity}
                season={season}
                site={site}
                onChangeSite={setSite}
                neighbors={neighbors}
                onChangeNeighbors={setNeighbors}
                onNextStep={() => setActiveTab('massing')}
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
                onNextStep={() => setActiveTab('roof_plugin')}
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
                onNextStep={() => setActiveTab('materials')}
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
    </div>
  );
};

export default App;
