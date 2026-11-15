import React, { useState } from 'react';
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
} from '../engine/roofEngine';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';

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
  onNextStep: () => void;
}

const SIMPLE_ROOF_CARDS: Array<{
  key: RoofTypeKey;
  title: string;
  desc: string;
}> = [
  {
    key: 'sawtooth',
    title: 'Testere Dişi Kuzey Işıklığı',
    desc: 'Kuzeyden göz yormayan aydınlık alır, güney yüzeyde elektrik üretir.',
  },
  {
    key: 'mono_pitch',
    title: 'Tek Eğimli Güneş Çatısı',
    desc: 'Yüksek güney penceresiyle kış güneşini odanın en arkasına taşır.',
  },
  {
    key: 'gable',
    title: 'Klasik Beşik Çatı',
    desc: 'Yoğun yağmur ve karı iki yöne hızla tahliye eder.',
  },
  {
    key: 'asymmetric_gable',
    title: 'Asimetrik İklim Çatısı',
    desc: 'Güney kanadı güneşe, kuzey kanadı soğuk rüzgara göre eğimlidir.',
  },
  {
    key: 'flat_green',
    title: 'Yeşil Teras Çatı + Işık Feneri',
    desc: 'Toprak katmanıyla yaz sıcağını keser, tepeden doğal ışık alır.',
  },
  {
    key: 'butterfly',
    title: 'Kelebek (V-Kesit) Çatı',
    desc: 'Yağmur suyunu ortaya toplar, dış cephe pencerelerini yükseltir.',
  },
  {
    key: 'louver_canopy',
    title: 'Güneş Kırıcı Pergola Çatı',
    desc: 'Açılı kanatlarla avlu ve teraslarda havadar gölge oluşturur.',
  },
];

const SIMPLE_ROLES: Array<{ key: SpaceZoneRole; label: string }> = [
  { key: 'primary_living', label: 'Güney: Güneş Alan Ana Odalar' },
  { key: 'north_daylight', label: 'Kuzey: Aydınlık Atölye / Çalışma' },
  { key: 'social_atrium', label: 'Merkez: Ortak Alan / Giriş' },
  { key: 'service_buffer', label: 'Batı/Kuzey: Servis & Koridor' },
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
  onNextStep,
}) => {
  const [showSizeControls, setShowSizeControls] = useState(false);

  const activeBlock = blocks.find((b) => b.id === selectedBlockId) || blocks[0];
  if (!activeBlock) return null;

  const perf = analyzeBlockRoofPerformance(activeBlock, city);
  const optSuggestion = recommendOptimalRoofForBlock(activeBlock, city, funcKey);

  // Basit ve net Oda Kesiti SVG ölçüleri
  const svgW = 320;
  const svgH = 160;
  const groundY = 132;
  const bLeft = 52;
  const bRight = 232;
  const bWidthPx = bRight - bLeft;
  const wallTopY = 78;
  const pxPerMeter = bWidthPx / Math.max(8, activeBlock.depth);
  const overPx = Math.min(36, activeBlock.overhangSouthM * pxPerMeter * 1.4);
  const risePx = Math.min(
    34,
    Math.max(10, Math.tan((activeBlock.roofPitchDeg * Math.PI) / 180) * 46)
  );
  const winterRad = (perf.winterNoonAltDeg * Math.PI) / 180;
  const summerRad = (perf.summerNoonAltDeg * Math.PI) / 180;
  const penPx = Math.min(bWidthPx - 6, perf.winterSunPenetrationM * pxPerMeter);

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-base font-bold text-[#161615]">
          3. 3D Kütle Ekle & Güneşe Göre Çatı Tasarla
        </h2>
        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
          Soldaki 3D modelde istediğiniz binaya tıklayın veya yeni bina ekleyin. Çatı açısını
          değiştirdiğinizde güneşin içeri nasıl girdiğini aşağıdaki şemadan görebilirsiniz.
        </p>
      </div>

      {/* Üst Hızlı İşlem Butonları */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAddBlock}
          className="py-2.5 px-3 bg-[#161615] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Yeni 3D Bina Ekle
        </button>
        <button
          onClick={onOptimizeAllRoofs}
          className="py-2.5 px-3 bg-[#C85A17] hover:bg-[#b04d12] text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" /> Güneşe Göre Otomatik Ayarla
        </button>
      </div>

      {/* Sahnedeki 3D Binalar Seçicisi */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-stone-800">
          Düzenlenen Bina Bloğu ({blocks.length} Adet)
        </label>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {blocks.map((b, i) => {
            const isSel = b.id === activeBlock.id;
            return (
              <div
                key={b.id}
                onClick={() => onSelectBlock(b.id)}
                className={`px-3 py-2 border cursor-pointer flex items-center justify-between gap-2 text-xs transition ${
                  isSel
                    ? 'border-[#161615] bg-[#161615] text-white font-semibold'
                    : 'border-stone-200 bg-[#FAF9F6] text-[#161615] hover:bg-white'
                }`}
              >
                <span className="truncate">
                  Bina {i + 1}: {b.label} ({b.floors} Kat)
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateBlock(b.id);
                    }}
                    className="opacity-75 hover:opacity-100"
                    title="Çoğalt"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {blocks.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBlock(b.id);
                      }}
                      className="opacity-75 hover:text-red-400 hover:opacity-100"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Çatı Şekli Seçimi */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-stone-800">Çatı Şeklini Seçin</label>
          <span className="text-[11px] text-[#C85A17] font-semibold">
            Önerilen: {SIMPLE_ROOF_CARDS.find((c) => c.key === optSuggestion.roofType)?.title}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {SIMPLE_ROOF_CARDS.map((rc) => {
            const active = activeBlock.roofType === rc.key;
            return (
              <button
                key={rc.key}
                onClick={() => onUpdateBlock({ ...activeBlock, roofType: rc.key })}
                className={`p-2.5 text-left border transition ${
                  active
                    ? 'border-[#161615] bg-white shadow-xs'
                    : 'border-stone-200 bg-[#FAF9F6] hover:bg-white'
                }`}
              >
                <div className="text-xs font-bold text-[#161615]">{rc.title}</div>
                <div className="text-[11px] text-stone-600 mt-0.5">{rc.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3 Sade Çatı Açısı ve Saçak Ayarı */}
      <div className="bg-[#F8F7F3] border border-stone-200 p-3.5 space-y-3.5 text-xs">
        <div>
          <label className="flex justify-between mb-1">
            <span className="font-semibold text-stone-700">Çatı Eğim Açısı</span>
            <strong className="text-[#161615]">
              {activeBlock.roofPitchDeg}° (İdeal: {Math.round(Math.abs(city.lat) * 0.78 + 3)}°)
            </strong>
          </label>
          <input
            type="range"
            min={5}
            max={45}
            step={1}
            value={activeBlock.roofPitchDeg}
            onChange={(e) =>
              onUpdateBlock({ ...activeBlock, roofPitchDeg: Number(e.target.value) })
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="flex justify-between mb-1">
            <span className="font-semibold text-stone-700">
              Güney Saçak Uzantısı (Yaz Güneşini Keser)
            </span>
            <strong className="text-[#161615]">
              {activeBlock.overhangSouthM} m (Önerilen: {perf.idealSouthOverhangM} m)
            </strong>
          </label>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.1}
            value={activeBlock.overhangSouthM}
            onChange={(e) =>
              onUpdateBlock({ ...activeBlock, overhangSouthM: Number(e.target.value) })
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="flex justify-between mb-1">
            <span className="font-semibold text-stone-700">Çatı Penceresi / Işıklık Oranı</span>
            <strong className="text-[#161615]">
              %{Math.round(activeBlock.skylightRatio * 100)}
            </strong>
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

        <label className="flex items-center gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={activeBlock.hasPvPanels}
            onChange={(e) => onUpdateBlock({ ...activeBlock, hasPvPanels: e.target.checked })}
            className="accent-[#161615]"
          />
          <span className="font-semibold text-[#161615] flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-600" /> Çatıya Güneş Paneli Ekle (Elektrik Üret)
          </span>
        </label>
      </div>

      {/* Canlı Oda Kesiti: Yaz ve Kış Güneşi Nasıl Giriyor? */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-stone-800">
          Oda Kesiti: Yazın Serinlik, Kışın Güneş Girişi
        </div>

        <div className="bg-white border border-stone-200 p-2">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-38">
            <rect x="0" y="0" width={svgW} height={groundY} fill="#F8F7F3" />
            <rect x="0" y={groundY} width={svgW} height={svgH - groundY} fill="#E5E2D9" />
            <line x1="10" y1={groundY} x2={svgW - 10} y2={groundY} stroke="#161615" strokeWidth="1.5" />

            {/* Kış Güneşi Odaya Giren Işık Halısı */}
            <polygon
              points={`${bRight},${wallTopY + 10} ${bRight},${groundY} ${bRight - penPx},${groundY} ${bRight},${wallTopY + 6}`}
              fill="#FDE68A"
              opacity="0.6"
            />

            {/* Oda Kesiti */}
            <rect
              x={bLeft}
              y={wallTopY}
              width={bWidthPx}
              height={groundY - wallTopY}
              fill="#FFFFFF"
              stroke="#161615"
              strokeWidth="1.5"
            />

            {/* Güney Penceresi */}
            <line
              x1={bRight}
              y1={wallTopY + 6}
              x2={bRight}
              y2={groundY - 6}
              stroke="#38BDF8"
              strokeWidth="3.5"
            />

            {/* Çatı Çizimi */}
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
                });
              })()
            ) : activeBlock.roofType === 'mono_pitch' ? (
              <polygon
                points={`${bLeft - 5},${wallTopY} ${bRight + overPx},${wallTopY - risePx} ${bRight},${wallTopY}`}
                fill="#CBD5E1"
                stroke="#161615"
                strokeWidth="1.3"
              />
            ) : activeBlock.roofType === 'butterfly' ? (
              <polygon
                points={`${bLeft - 5},${wallTopY - risePx * 0.75} ${bLeft + bWidthPx / 2},${wallTopY - 3} ${bRight + overPx},${wallTopY - risePx * 0.8} ${bRight},${wallTopY} ${bLeft},${wallTopY}`}
                fill="#CBD5E1"
                stroke="#161615"
                strokeWidth="1.3"
              />
            ) : (
              <polygon
                points={`${bLeft - 5},${wallTopY} ${
                  bLeft + (activeBlock.roofType === 'asymmetric_gable' ? bWidthPx * 0.35 : bWidthPx * 0.5)
                },${wallTopY - risePx} ${bRight + overPx},${wallTopY}`}
                fill="#CBD5E1"
                stroke="#161615"
                strokeWidth="1.3"
              />
            )}

            {/* Saçak */}
            <line
              x1={bRight}
              y1={wallTopY}
              x2={bRight + overPx}
              y2={wallTopY}
              stroke="#161615"
              strokeWidth="2.5"
            />

            {/* Yaz Güneşi */}
            <line
              x1={bRight + overPx + Math.cos(summerRad) * 52}
              y1={wallTopY - Math.sin(summerRad) * 52}
              x2={bRight + overPx}
              y2={wallTopY}
              stroke="#D97706"
              strokeWidth="2"
            />
            <text x={svgW - 8} y="18" textAnchor="end" fontSize="9.5" fontWeight="700" fill="#B45309">
              Yaz Güneşi ({perf.summerNoonAltDeg}° - Saçak Keser)
            </text>

            {/* Kış Güneşi */}
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
              fontSize="9.5"
              fontWeight="700"
              fill="#C85A17"
            >
              Kış Güneşi ({perf.winterNoonAltDeg}° - İçeri Girer)
            </text>

            <text x="12" y="18" fontSize="9.5" fontWeight="700" fill="#0369A1">
              KUZEY
            </text>
            <text
              x={bRight - penPx / 2}
              y={groundY + 15}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill="#161615"
            >
              Kış Güneşi Odaya {perf.winterSunPenetrationM} m Girer
            </text>
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-[#F8F7F3] border border-stone-200 p-2.5">
            <span className="text-[11px] text-stone-500 block">Yaz Sıcağı Kesme</span>
            <strong className="text-[#161615]">%{perf.summerDirectBlockPct}</strong>
          </div>
          <div className="bg-[#F8F7F3] border border-stone-200 p-2.5">
            <span className="text-[11px] text-stone-500 block">Kış Güneşi Girişi</span>
            <strong className="text-[#161615]">{perf.winterSunPenetrationM} metre</strong>
          </div>
          <div className="bg-[#F8F7F3] border border-stone-200 p-2.5">
            <span className="text-[11px] text-stone-500 block">Çatı Elektriği</span>
            <strong className="text-[#15803D]">
              {(perf.annualPvYieldKwh / 1000).toFixed(1)} MWh/yıl
            </strong>
          </div>
        </div>
      </div>

      {/* İsteğe Bağlı Açılır Bölüm: Binanın Kat Sayısı, Boyutu ve Yeri */}
      <div className="border border-stone-200 bg-[#FAF9F6]">
        <button
          onClick={() => setShowSizeControls((v) => !v)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
        >
          <span>Seçili Binanın Kat Sayısını, Boyutunu ve Yerini Değiştir</span>
          {showSizeControls ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showSizeControls && (
          <div className="p-3.5 border-t border-stone-200 space-y-3 text-xs">
            <div>
              <label className="block text-stone-600 mb-1">Bu Binanın Görevi</label>
              <select
                value={activeBlock.role}
                onChange={(e) =>
                  onUpdateBlock({ ...activeBlock, role: e.target.value as SpaceZoneRole })
                }
                className="w-full border border-stone-300 bg-white px-2.5 py-1.5"
              >
                {SIMPLE_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Kat Sayısı</span>
                  <strong>{activeBlock.floors}</strong>
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
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Genişlik</span>
                  <strong>{activeBlock.width}m</strong>
                </label>
                <input
                  type="range"
                  min={6}
                  max={60}
                  step={1}
                  value={activeBlock.width}
                  onChange={(e) =>
                    onUpdateBlock({ ...activeBlock, width: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Derinlik</span>
                  <strong>{activeBlock.depth}m</strong>
                </label>
                <input
                  type="range"
                  min={6}
                  max={36}
                  step={1}
                  value={activeBlock.depth}
                  onChange={(e) =>
                    onUpdateBlock({ ...activeBlock, depth: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Sağ / Sol</span>
                  <strong>{activeBlock.x}m</strong>
                </label>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={activeBlock.x}
                  onChange={(e) => onUpdateBlock({ ...activeBlock, x: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>İleri / Geri</span>
                  <strong>{activeBlock.z}m</strong>
                </label>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={1}
                  value={activeBlock.z}
                  onChange={(e) => onUpdateBlock({ ...activeBlock, z: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="flex justify-between text-stone-600 mb-1">
                  <span>Döndür</span>
                  <strong>{activeBlock.rotationDeg}°</strong>
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
          </div>
        )}
      </div>

      <button
        onClick={onNextStep}
        className="w-full py-3 bg-[#161615] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
      >
        4. Adıma Geç: Yerel ve Sürdürülebilir Malzeme Seçimi
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
