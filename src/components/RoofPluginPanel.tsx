import React from 'react';
import {
  BuildingFunctionKey,
  CityClimateProfile,
  MassBlock,
  RoofTypeKey,
  SpaceZoneRole,
} from '../types/architecture';
import {
  analyzeBlockRoofPerformance,
  recommendOptimalRoofForBlock,
  ROOF_TYPES_META,
} from '../engine/roofEngine';
import { Copy, Plus, Sparkles, Sun, Trash2, Zap } from 'lucide-react';

interface RoofPluginPanelProps {
  city: CityClimateProfile;
  funcKey: BuildingFunctionKey;
  blocks: MassBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onUpdateBlock: (updated: MassBlock) => void;
  onAddBlock: () => void;
  onDuplicateBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onOptimizeAllRoofs: () => void;
}

const ROOF_KEYS: RoofTypeKey[] = [
  'sawtooth',
  'mono_pitch',
  'asymmetric_gable',
  'gable',
  'butterfly',
  'flat_green',
  'louver_canopy',
];

const ROLE_OPTIONS: Array<{ key: SpaceZoneRole; label: string }> = [
  { key: 'primary_living', label: 'Güney Ana Yaşam / Derslik / Pasif Solar' },
  { key: 'north_daylight', label: 'Kuzey Homojen Günışığı / Stüdyo / Sergi' },
  { key: 'social_atrium', label: 'Sosyal Avlu Arayüzü / Kış Bahçesi' },
  { key: 'service_buffer', label: 'Kuzeybatı Servis / Teknik / Tampon' },
  { key: 'circulation_core', label: 'Düşey Sirkülasyon & Çekirdek' },
];

export const RoofPluginPanel: React.FC<RoofPluginPanelProps> = ({
  city,
  funcKey,
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onAddBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onOptimizeAllRoofs,
}) => {
  const activeBlock = blocks.find((b) => b.id === selectedBlockId) || blocks[0];
  if (!activeBlock) return null;

  const perf = analyzeBlockRoofPerformance(activeBlock, city);
  const optSuggestion = recommendOptimalRoofForBlock(activeBlock, city, funcKey);

  const handleApplyOptimalSingle = () => {
    onUpdateBlock({
      ...activeBlock,
      roofType: optSuggestion.roofType,
      roofPitchDeg: optSuggestion.roofPitchDeg,
      secondaryPitchDeg: optSuggestion.secondaryPitchDeg,
      overhangSouthM: optSuggestion.overhangSouthM,
      sawtoothCount: optSuggestion.sawtoothCount,
      skylightRatio: optSuggestion.skylightRatio,
      hasPvPanels: optSuggestion.hasPvPanels,
    });
  };

  // 2D Mimari Kesit SVG Hesaplamaları (Sol=Kuzey, Sağ=Güney)
  const svgW = 320;
  const svgH = 165;
  const groundY = 136;
  const bLeft = 56; // Kuzey duvarı
  const bRight = 236; // Güney duvarı
  const bWidthPx = bRight - bLeft;
  const wallTopY = 82;
  const pxPerMeter = bWidthPx / Math.max(8, activeBlock.depth);
  const overPx = Math.min(36, activeBlock.overhangSouthM * pxPerMeter * 1.4);
  const risePx = Math.min(
    36,
    Math.max(10, Math.tan((activeBlock.roofPitchDeg * Math.PI) / 180) * 48)
  );

  // Kış güneş ışını (Güney sağ üstten sola/içeri girer)
  const winterRad = (perf.winterNoonAltDeg * Math.PI) / 180;
  const summerRad = (perf.summerNoonAltDeg * Math.PI) / 180;
  const penPx = Math.min(bWidthPx - 6, perf.winterSunPenetrationM * pxPerMeter);

  return (
    <div className="space-y-4 text-xs">
      {/* 03.1 3D Kütle Listesi ve Yeni Kütle Ekleme */}
      <section className="space-y-2.5 border-b border-[#E2E0D8] pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            03.1 3D Kütle Modülleri ({blocks.length} Blok)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAddBlock}
              className="px-2.5 py-1 bg-[#161615] text-white font-semibold hover:bg-stone-800 transition flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Kütle Ekle
            </button>
            <button
              onClick={onOptimizeAllRoofs}
              className="px-2 py-1 border border-[#161615] bg-white text-[#161615] font-medium hover:bg-stone-100 transition flex items-center gap-1 whitespace-nowrap"
              title="Tüm blokların çatı tipini ve açılarını enleme göre otomatik ayarla"
            >
              <Sparkles className="w-3 h-3 text-[#C85A17]" /> Tümünü Optimize Et
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-0.5">
          {blocks.map((b, i) => {
            const isSel = b.id === activeBlock.id;
            return (
              <div
                key={b.id}
                onClick={() => onSelectBlock(b.id)}
                className={`px-2.5 py-1.5 border cursor-pointer flex items-center justify-between gap-2 transition ${
                  isSel
                    ? 'border-[#161615] bg-[#161615] text-white'
                    : 'border-[#DEDBD0] bg-[#FAF9F5] text-[#161615] hover:bg-white'
                }`}
              >
                <div className="truncate">
                  <span className="font-mono text-[10px] opacity-75 mr-1.5">B0{i + 1}</span>
                  <span className="font-medium">{b.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                  <span>
                    {b.floors}K · {ROOF_TYPES_META[b.roofType].shortName} ({b.roofPitchDeg}°)
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateBlock(b.id);
                    }}
                    className="p-0.5 opacity-75 hover:opacity-100"
                    title="Kütleyi Kopyala"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {blocks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBlock(b.id);
                      }}
                      className="p-0.5 opacity-75 hover:text-red-400 hover:opacity-100"
                      title="Kütleyi Sil"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 03.2 Seçili 3D Kütlenin Boyut, Konum ve Fonksiyon Ayarları */}
      <section className="space-y-2.5 border-b border-[#E2E0D8] pb-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            03.2 Seçili Kütle Geometrisi & Konumu
          </span>
          <span className="font-mono text-[11px] font-semibold text-[#161615]">
            {Math.round(activeBlock.width * activeBlock.depth * activeBlock.floors)} m²
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-stone-500 mb-0.5">Kütle Etiketi</label>
            <input
              type="text"
              value={activeBlock.label}
              onChange={(e) => onUpdateBlock({ ...activeBlock, label: e.target.value })}
              className="w-full border border-[#CFCBC0] bg-white px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-stone-500 mb-0.5">Mekan Fonksiyon Zonu</label>
            <select
              value={activeBlock.role}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, role: e.target.value as SpaceZoneRole })
              }
              className="w-full border border-[#CFCBC0] bg-white px-2 py-1 text-xs"
            >
              {ROLE_OPTIONS.map((ro) => (
                <option key={ro.key} value={ro.key}>
                  {ro.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div>
            <label className="flex justify-between text-[10px] text-stone-600">
              <span>Genişlik</span>
              <span className="font-mono font-semibold">{activeBlock.width}m</span>
            </label>
            <input
              type="range"
              min={6}
              max={65}
              step={1}
              value={activeBlock.width}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, width: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label className="flex justify-between text-[10px] text-stone-600">
              <span>Derinlik</span>
              <span className="font-mono font-semibold">{activeBlock.depth}m</span>
            </label>
            <input
              type="range"
              min={6}
              max={40}
              step={0.5}
              value={activeBlock.depth}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, depth: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label className="flex justify-between text-[10px] text-stone-600">
              <span>Kat Adedi</span>
              <span className="font-mono font-semibold">{activeBlock.floors} Kat</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={activeBlock.floors}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, floors: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="flex justify-between text-[10px] text-stone-600">
              <span>Konum X (D-B)</span>
              <span className="font-mono">{activeBlock.x}m</span>
            </label>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={activeBlock.x}
              onChange={(e) => onUpdateBlock({ ...activeBlock, x: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="flex justify-between text-[10px] text-stone-600">
              <span>Konum Z (K-G)</span>
              <span className="font-mono">{activeBlock.z}m</span>
            </label>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={activeBlock.z}
              onChange={(e) => onUpdateBlock({ ...activeBlock, z: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="flex justify-between text-[10px] text-stone-600">
              <span>Dönüş Açısı</span>
              <span className="font-mono">{activeBlock.rotationDeg}°</span>
            </label>
            <input
              type="range"
              min={-90}
              max={90}
              step={5}
              value={activeBlock.rotationDeg}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, rotationDeg: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* 03.3 Güneş Açısına Duyarlı Parametrik Çatı Tasarım Eklentisi */}
      <section className="space-y-3 border-b border-[#E2E0D8] pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            03.3 Solar Çatı & Günışığı Açı Optimizasyonu
          </span>
          <button
            onClick={handleApplyOptimalSingle}
            className="px-2.5 py-1 bg-[#C85A17] hover:bg-[#b04d12] text-white font-semibold transition flex items-center gap-1 whitespace-nowrap"
          >
            <Sun className="w-3.5 h-3.5" /> İklime Göre Çatı Öner
          </button>
        </div>

        {/* Otomatik Çatı Öneri Notu */}
        <div className="bg-[#F8F7F3] border-l-2 border-[#C85A17] px-2.5 py-2 text-[11px] text-stone-700">
          <strong className="text-[#161615]">Sistemin Çatı Önerisi: </strong>
          {optSuggestion.reasoning}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-stone-700 mb-1">
            3D Çatı Tipolojisi
          </label>
          <select
            value={activeBlock.roofType}
            onChange={(e) =>
              onUpdateBlock({ ...activeBlock, roofType: e.target.value as RoofTypeKey })
            }
            className="w-full border border-[#CFCBC0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#161615]"
          >
            {ROOF_KEYS.map((rk) => (
              <option key={rk} value={rk}>
                {ROOF_TYPES_META[rk].name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-stone-500 mt-1">
            {ROOF_TYPES_META[activeBlock.roofType].description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-0.5">
              <span>Güney / Ana Çatı Eğimi</span>
              <span className="font-mono font-bold text-[#161615]">
                {activeBlock.roofPitchDeg}°
              </span>
            </label>
            <input
              type="range"
              min={4}
              max={48}
              step={1}
              value={activeBlock.roofPitchDeg}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, roofPitchDeg: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-[10px] text-stone-500 font-mono">
              Enlem PV Optimum: {Math.round(Math.abs(city.lat) * 0.78 + 3)}°
            </span>
          </div>

          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-0.5">
              <span>Güney Saçak Çıkması</span>
              <span className="font-mono font-bold text-[#161615]">
                {activeBlock.overhangSouthM} m
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={2.6}
              step={0.1}
              value={activeBlock.overhangSouthM}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, overhangSouthM: Number(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-[10px] text-stone-500 font-mono">
              21 Haz Kesim İdeali: {perf.idealSouthOverhangM} m
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-0.5">
              <span>Işıklık / Clerestory Oranı</span>
              <span className="font-mono font-semibold">
                %{Math.round(activeBlock.skylightRatio * 100)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={0.65}
              step={0.05}
              value={activeBlock.skylightRatio}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, skylightRatio: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>

          {activeBlock.roofType === 'sawtooth' || activeBlock.roofType === 'flat_green' ? (
            <div>
              <label className="flex justify-between text-[11px] text-stone-600 mb-0.5">
                <span>Testere Dişi / Fener Adedi</span>
                <span className="font-mono font-semibold">{activeBlock.sawtoothCount}</span>
              </label>
              <input
                type="range"
                min={2}
                max={6}
                step={1}
                value={activeBlock.sawtoothCount}
                onChange={(e) =>
                  onUpdateBlock({ ...activeBlock, sawtoothCount: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
          ) : (
            <div>
              <label className="flex justify-between text-[11px] text-stone-600 mb-0.5">
                <span>İkincil / Kuzey Açısı</span>
                <span className="font-mono font-semibold">{activeBlock.secondaryPitchDeg}°</span>
              </label>
              <input
                type="range"
                min={15}
                max={90}
                step={1}
                value={activeBlock.secondaryPitchDeg}
                onChange={(e) =>
                  onUpdateBlock({
                    ...activeBlock,
                    secondaryPitchDeg: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeBlock.hasPvPanels}
              onChange={(e) =>
                onUpdateBlock({ ...activeBlock, hasPvPanels: e.target.checked })
              }
              className="accent-[#161615]"
            />
            <span className="font-medium text-[#161615] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" /> Çatı BIPV Güneş Paneli Entegrasyonu
            </span>
          </label>

          <button
            onClick={() =>
              onUpdateBlock({
                ...activeBlock,
                ridgeDirection: activeBlock.ridgeDirection === 'EW' ? 'NS' : 'EW',
              })
            }
            className="px-2 py-1 border border-[#D0CDC2] bg-white text-[11px] font-mono hover:bg-stone-100"
          >
            Sırt: {activeBlock.ridgeDirection === 'EW' ? 'Doğu-Batı' : 'Kuzey-Güney'}
          </button>
        </div>
      </section>

      {/* 03.4 Canlı 2D Mimari Kesit & Güneş Işını Gölgeleme Analizi */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            03.4 Mimari Kesit Güneş Işını Analizi (Kuzey - Güney)
          </span>
          <span className="font-mono text-[10px] text-[#15803D] font-semibold">
            Günışığı: %{perf.estimatedDaylightFactorPct} DF
          </span>
        </div>

        <div className="bg-white border border-[#D8D5CA] p-2">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-40">
            {/* Arka Plan Gökyüzü */}
            <rect x="0" y="0" width={svgW} height={groundY} fill="#F8F7F3" />
            <rect x="0" y={groundY} width={svgW} height={svgH - groundY} fill="#E5E2D9" />
            <line x1="10" y1={groundY} x2={svgW - 10} y2={groundY} stroke="#161615" strokeWidth="1.5" />

            {/* Kış Güneşi İç Mekan Aydınlanma Halısı */}
            <polygon
              points={`${bRight},${wallTopY + 12} ${bRight},${groundY} ${bRight - penPx},${groundY} ${bRight},${wallTopY + 8}`}
              fill="#FDE68A"
              opacity="0.55"
            />

            {/* Bina Kesit Kutusu */}
            <rect
              x={bLeft}
              y={wallTopY}
              width={bWidthPx}
              height={groundY - wallTopY}
              fill="#FFFFFF"
              stroke="#161615"
              strokeWidth="1.5"
            />

            {/* Güney Pencere Açıklığı */}
            <line
              x1={bRight}
              y1={wallTopY + 8}
              x2={bRight}
              y2={groundY - 8}
              stroke="#38BDF8"
              strokeWidth="3.5"
            />

            {/* Parametrik Çatı Kesit Çizimi */}
            {activeBlock.roofType === 'sawtooth' ? (
              (() => {
                const cnt = Math.max(2, Math.min(5, activeBlock.sawtoothCount));
                const step = bWidthPx / cnt;
                return Array.from({ length: cnt }).map((_, idx) => {
                  const x0 = bLeft + idx * step;
                  const x1 = x0 + step;
                  return (
                    <g key={idx}>
                      <polygon
                        points={`${x0},${wallTopY} ${x0 + 4},${wallTopY - risePx * 0.72} ${x1},${wallTopY}`}
                        fill="#CBD5E1"
                        stroke="#161615"
                        strokeWidth="1.2"
                      />
                      {/* Kuzey Işıklık Camı */}
                      <line
                        x1={x0}
                        y1={wallTopY}
                        x2={x0 + 4}
                        y2={wallTopY - risePx * 0.72}
                        stroke="#0284C7"
                        strokeWidth="2.6"
                      />
                      {/* Difüz Kuzey Günışığı Okları */}
                      <line
                        x1={x0 - 8}
                        y1={wallTopY - risePx * 0.72 - 8}
                        x2={x0 + step * 0.45}
                        y2={groundY - 14}
                        stroke="#38BDF8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    </g>
                  );
                });
              })()
            ) : activeBlock.roofType === 'mono_pitch' ? (
              <g>
                <polygon
                  points={`${bLeft - 6},${wallTopY} ${bRight + overPx},${wallTopY - risePx} ${bRight},${wallTopY}`}
                  fill="#CBD5E1"
                  stroke="#161615"
                  strokeWidth="1.3"
                />
                <line
                  x1={bRight}
                  y1={wallTopY - risePx + 3}
                  x2={bRight}
                  y2={wallTopY}
                  stroke="#0284C7"
                  strokeWidth="3"
                />
              </g>
            ) : activeBlock.roofType === 'butterfly' ? (
              <polygon
                points={`${bLeft - 6},${wallTopY - risePx * 0.75} ${bLeft + bWidthPx / 2},${wallTopY - 3} ${bRight + overPx},${wallTopY - risePx * 0.8} ${bRight},${wallTopY} ${bLeft},${wallTopY}`}
                fill="#CBD5E1"
                stroke="#161615"
                strokeWidth="1.3"
              />
            ) : (
              <polygon
                points={`${bLeft - 6},${wallTopY} ${
                  bLeft + (activeBlock.roofType === 'asymmetric_gable' ? bWidthPx * 0.35 : bWidthPx * 0.5)
                },${wallTopY - risePx} ${bRight + overPx},${wallTopY}`}
                fill="#CBD5E1"
                stroke="#161615"
                strokeWidth="1.3"
              />
            )}

            {/* Güney Saçak Çizgisi */}
            <line
              x1={bRight}
              y1={wallTopY}
              x2={bRight + overPx}
              y2={wallTopY}
              stroke="#161615"
              strokeWidth="2.5"
            />

            {/* 21 Haziran Yaz Güneşi Işını (Saçaktan kesilir) */}
            <line
              x1={bRight + overPx + Math.cos(summerRad) * 58}
              y1={wallTopY - Math.sin(summerRad) * 58}
              x2={bRight + overPx}
              y2={wallTopY}
              stroke="#D97706"
              strokeWidth="1.8"
            />
            <text x={svgW - 8} y="18" textAnchor="end" fontSize="9" fontWeight="700" fill="#B45309">
              Yaz 21 Haz ({perf.summerNoonAltDeg}°)
            </text>

            {/* 21 Aralık Kış Güneşi Işını (Saçak altından içeri süzülür) */}
            <line
              x1={svgW - 6}
              y1={wallTopY + 12 - Math.tan(winterRad) * (svgW - 6 - bRight)}
              x2={bRight - penPx}
              y2={groundY}
              stroke="#EA580C"
              strokeWidth="1.8"
              strokeDasharray="4 2"
            />
            <text
              x={svgW - 8}
              y={groundY - 8}
              textAnchor="end"
              fontSize="9"
              fontWeight="700"
              fill="#C85A17"
            >
              Kış 21 Ara ({perf.winterNoonAltDeg}°)
            </text>

            {/* Yön ve Penetrasyon Ölçüsü */}
            <text x="12" y="18" fontSize="9" fontWeight="700" fill="#0369A1">
              KUZEY (Difüz Işık)
            </text>
            <text
              x={bRight - penPx / 2}
              y={groundY + 14}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#161615"
            >
              Kış Güneşi Girişi: {perf.winterSunPenetrationM} m
            </text>
          </svg>
        </div>

        {/* Çatı Performans Özeti Kartları */}
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
            <span className="text-[10px] text-stone-500 block font-sans">Yaz Güneşi Blokajı</span>
            <strong className="text-[#161615]">%{perf.summerDirectBlockPct} Engelleme</strong>
          </div>
          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
            <span className="text-[10px] text-stone-500 block font-sans">Kamaşma Durumu</span>
            <strong className="text-[#161615] font-sans text-[11px]">{perf.glareRiskLabel}</strong>
          </div>
          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
            <span className="text-[10px] text-stone-500 block font-sans">Yıllık BIPV Elektrik</span>
            <strong className="text-[#15803D]">
              {perf.annualPvYieldKwh.toLocaleString('tr-TR')} kWh/yıl
            </strong>
          </div>
          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
            <span className="text-[10px] text-stone-500 block font-sans">Çatı Yağmur Hasadı</span>
            <strong className="text-sky-800">{perf.rainwaterHarvestM3Yr} m³/yıl</strong>
          </div>
        </div>
      </section>
    </div>
  );
};
