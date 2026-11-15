import React from 'react';
import {
  BuildingFunctionKey,
  MassTypologyKey,
  TypologyRecommendation,
} from '../types/architecture';
import { BUILDING_PROGRAMS } from '../data/programs';
import { Check, Compass, LayoutGrid } from 'lucide-react';

interface MassingProgramPanelProps {
  funcKey: BuildingFunctionKey;
  onChangeFuncKey: (k: BuildingFunctionKey) => void;
  targetAreaM2: number;
  onChangeTargetAreaM2: (m2: number) => void;
  globalOrientationDeg: number;
  onChangeGlobalOrientationDeg: (deg: number) => void;
  recommendations: TypologyRecommendation[];
  activeTypologyKey: MassTypologyKey;
  onApplyTypology: (rec: TypologyRecommendation) => void;
}

const FUNCTION_KEYS: BuildingFunctionKey[] = [
  'education',
  'residential',
  'office',
  'cultural',
  'healthcare',
  'mixed',
  'atelier',
];

export const MassingProgramPanel: React.FC<MassingProgramPanelProps> = ({
  funcKey,
  onChangeFuncKey,
  targetAreaM2,
  onChangeTargetAreaM2,
  globalOrientationDeg,
  onChangeGlobalOrientationDeg,
  recommendations,
  activeTypologyKey,
  onApplyTypology,
}) => {
  const prog = BUILDING_PROGRAMS[funcKey];

  return (
    <div className="space-y-5 text-xs">
      {/* 02.1 Bina Fonksiyonu & Toplam Metrekare */}
      <section className="space-y-3 border-b border-[#E2E0D8] pb-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500 block">
          02.1 Bina Fonksiyonu & Program Ölçeği
        </span>

        <div>
          <label className="block text-[11px] font-medium text-stone-700 mb-1">
            Ana Mimari Fonksiyon
          </label>
          <select
            value={funcKey}
            onChange={(e) => onChangeFuncKey(e.target.value as BuildingFunctionKey)}
            className="w-full bg-white border border-[#CFCBC0] px-2.5 py-2 text-xs font-semibold text-[#161615] focus:outline-none focus:border-[#161615]"
          >
            {FUNCTION_KEYS.map((k) => (
              <option key={k} value={k}>
                {BUILDING_PROGRAMS[k].title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-stone-500 mt-1">{prog.subtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-1">
              <span>Hedef İnşaat Alanı</span>
              <span className="font-mono font-bold text-[#161615]">
                {targetAreaM2.toLocaleString('tr-TR')} m²
              </span>
            </label>
            <input
              type="range"
              min={800}
              max={16000}
              step={200}
              value={targetAreaM2}
              onChange={(e) => onChangeTargetAreaM2(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="flex justify-between text-[11px] text-stone-600 mb-1">
              <span className="flex items-center gap-1">
                <Compass className="w-3 h-3" /> Kütle Yönelimi
              </span>
              <span className="font-mono font-bold text-[#161615]">
                {globalOrientationDeg > 0 ? `+${globalOrientationDeg}° GD` : `${globalOrientationDeg}°`}
              </span>
            </label>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={globalOrientationDeg}
              onChange={(e) => onChangeGlobalOrientationDeg(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* 02.2 Mekan Metrekareleri & İklimsel Yönelim Dağılımı */}
      <section className="space-y-2 border-b border-[#E2E0D8] pb-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            02.2 Mekan Dağılımı & Yönelim Matrisi
          </span>
          <span className="font-mono text-[10px] text-stone-500">
            İdeal Derinlik ≤ {prog.idealMaxDepthM}m
          </span>
        </div>

        <div className="border border-[#DEDBD0] bg-white divide-y divide-[#ECEAE2]">
          {prog.spaces.map((sp) => {
            const area = Math.round((targetAreaM2 * sp.ratioPct) / 100);
            return (
              <div key={sp.id} className="p-2 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#161615]">{sp.name}</span>
                  <span className="font-mono font-semibold text-[#161615] whitespace-nowrap">
                    {area.toLocaleString('tr-TR')} m² (%{sp.ratioPct})
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                  <span>Yönelim: {sp.preferredOrientation}</span>
                  <span>Hedef Günışığı: %{sp.targetDaylightFactor} DF</span>
                </div>
                <p className="text-[11px] text-stone-600">{sp.notes}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 02.3 Sıralı Optimal Kütle & Avlu Önerileri */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            02.3 Optimal Kütle & Avlu Önerileri
          </span>
          <span className="text-[10px] text-stone-500 flex items-center gap-1">
            <LayoutGrid className="w-3 h-3" /> İklim + Fonksiyon Skorlaması
          </span>
        </div>

        <div className="space-y-2.5">
          {recommendations.map((rec, idx) => {
            const isActive = rec.key === activeTypologyKey;
            return (
              <div
                key={rec.key}
                className={`border p-3 transition ${
                  isActive
                    ? 'border-[#161615] bg-white shadow-sm'
                    : 'border-[#DCD9CE] bg-[#FAF9F5] hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#C85A17]">
                        0{idx + 1}
                      </span>
                      <h4 className="font-bold text-[#161615] text-xs">{rec.name}</h4>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">{rec.tagline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-base font-bold text-[#161615]">
                      {rec.totalScore}
                      <span className="text-[10px] font-normal text-stone-500">/100</span>
                    </div>
                    {idx === 0 && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#15803D] font-semibold">
                        En Uygun
                      </span>
                    )}
                  </div>
                </div>

                {/* Alt Performans Kriterleri */}
                <div className="grid grid-cols-4 gap-1.5 my-2.5 bg-[#F5F4F0] p-2 font-mono text-[10px]">
                  <div>
                    <span className="text-stone-500 block">Isıl Denge</span>
                    <strong className="text-[#161615]">{rec.thermalScore}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Günışığı</span>
                    <strong className="text-[#161615]">{rec.daylightScore}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Rüzgar</span>
                    <strong className="text-[#161615]">{rec.ventilationScore}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Avlu</span>
                    <strong className="text-[#161615]">{rec.courtyardComfortScore}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-stone-600 border-t border-[#E8E6DE] pt-2">
                  <span>A/V: {rec.surfaceToVolumeRatio}</span>
                  <span>Avlu: {rec.courtyardAreaM2} m² ({rec.courtyardRatioHW})</span>
                  <span>TAKS: {rec.taksRatio} | KAKS: {rec.kaksRatio}</span>
                </div>

                <ul className="mt-2 space-y-1 text-[11px] text-stone-600">
                  {rec.rationale.map((r, rIdx) => (
                    <li key={rIdx} className="leading-snug">
                      • {r}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onApplyTypology(rec)}
                  className={`mt-2.5 w-full py-1.5 text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-[#161615] text-white border-[#161615]'
                      : 'bg-white text-[#161615] border-[#161615] hover:bg-[#161615] hover:text-white'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Aktif 3D Kütle Düzeni
                    </>
                  ) : (
                    'Bu Kütle ve Avlu Önerisini 3D Sahneye Uygula'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
