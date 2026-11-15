import React, { useState } from 'react';
import {
  BuildingFunctionKey,
  MassTypologyKey,
  TypologyRecommendation,
} from '../types/architecture';
import { BUILDING_PROGRAMS } from '../data/programs';
import { ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';

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
  onNextStep: () => void;
}

const FUNCTION_CARDS: Array<{ key: BuildingFunctionKey; shortLabel: string }> = [
  { key: 'education', shortLabel: 'Okul / Eğitim' },
  { key: 'residential', shortLabel: 'Konut / Yaşam' },
  { key: 'office', shortLabel: 'Ofis / Çalışma' },
  { key: 'cultural', shortLabel: 'Kültür / Müze' },
  { key: 'healthcare', shortLabel: 'Sağlık / Klinik' },
  { key: 'atelier', shortLabel: 'Üretim / Atölye' },
  { key: 'mixed', shortLabel: 'Karma Kullanım' },
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
  onNextStep,
}) => {
  const [showRooms, setShowRooms] = useState(true);
  const prog = BUILDING_PROGRAMS[funcKey];

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-base font-bold text-[#161615]">
          2. Bina Türü, Metrekare ve Avlu Düzeni
        </h2>
        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
          Binanın ne amaçla kullanılacağını ve toplam büyüklüğünü seçin; sistem bu iklime en uygun
          kütle ve avlu yerleşimini otomatik oluşturur.
        </p>
      </div>

      {/* Bina Fonksiyon Seçimi (Anlaşılır Kart Butonlar) */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-stone-800">
          Bina Ne Olarak Kullanılacak?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FUNCTION_CARDS.map((fc) => {
            const selected = fc.key === funcKey;
            return (
              <button
                key={fc.key}
                onClick={() => onChangeFuncKey(fc.key)}
                className={`px-3 py-2 text-left text-xs font-semibold border transition ${
                  selected
                    ? 'bg-[#161615] text-white border-[#161615]'
                    : 'bg-[#FAF9F6] text-stone-700 border-stone-300 hover:bg-white'
                }`}
              >
                {fc.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toplam İnşaat Alanı ve Bina Yönü */}
      <div className="bg-[#F8F7F3] border border-stone-200 p-3.5 space-y-3">
        <div>
          <label className="flex justify-between text-xs text-stone-700 mb-1.5">
            <span className="font-semibold">Toplam Bina Alanı (m²)</span>
            <span className="font-bold text-[#161615] text-sm">
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
          <label className="flex justify-between text-xs text-stone-700 mb-1.5">
            <span className="font-semibold">Binayı Güneşe Göre Çevir</span>
            <span className="font-bold text-[#161615]">{globalOrientationDeg}°</span>
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

      {/* Mekan / Oda Dağılımı Özeti */}
      <div className="border border-stone-200 bg-white">
        <button
          onClick={() => setShowRooms((v) => !v)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-stone-800 hover:bg-stone-50"
        >
          <span>Oda ve Mekan Dağılımı ({targetAreaM2.toLocaleString('tr-TR')} m²)</span>
          {showRooms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showRooms && (
          <div className="divide-y divide-stone-100 border-t border-stone-200 text-xs">
            {prog.spaces.map((sp) => {
              const area = Math.round((targetAreaM2 * sp.ratioPct) / 100);
              return (
                <div key={sp.id} className="px-3.5 py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#161615]">{sp.name}</div>
                    <div className="text-[11px] text-stone-500">
                      Önerilen Cephe: {sp.preferredOrientation}
                    </div>
                  </div>
                  <div className="font-bold text-[#161615] whitespace-nowrap">
                    {area.toLocaleString('tr-TR')} m²
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Önerilen Kütle ve Avlu Şekilleri */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-stone-800">
          İklime Göre Önerilen Bina ve Avlu Şekilleri
        </div>

        {recommendations.map((rec, idx) => {
          const isActive = rec.key === activeTypologyKey;
          return (
            <div
              key={rec.key}
              onClick={() => onApplyTypology(rec)}
              className={`border p-3.5 cursor-pointer transition ${
                isActive
                  ? 'border-[#161615] bg-white shadow-xs'
                  : 'border-stone-200 bg-[#FAF9F6] hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#C85A17]">0{idx + 1}</span>
                    <h4 className="font-bold text-[#161615] text-sm">{rec.name}</h4>
                  </div>
                  {idx === 0 && (
                    <div className="text-[11px] font-semibold text-[#15803D] mt-0.5">
                      Bu İklim ve Bina Türü İçin En Uygun Seçim
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-bold text-[#161615]">%{rec.totalScore}</span>
                  <span className="block text-[10px] text-stone-500">Uyum</span>
                </div>
              </div>

              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{rec.rationale[0]}</p>

              {/* Sade 4'lü Skor Göstergesi */}
              <div className="grid grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-stone-200 text-[11px]">
                <div>
                  <span className="text-stone-500 block">Isı Koruma</span>
                  <strong className="text-[#161615]">%{rec.thermalScore}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">Günışığı</span>
                  <strong className="text-[#161615]">%{rec.daylightScore}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">Rüzgar</span>
                  <strong className="text-[#161615]">%{rec.ventilationScore}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">Avlu Alanı</span>
                  <strong className="text-[#161615]">{rec.courtyardAreaM2} m²</strong>
                </div>
              </div>

              {isActive && (
                <div className="mt-2.5 pt-2 border-t border-stone-100 text-xs font-semibold text-[#161615] flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#15803D]" /> 3D Sahnede Gösteriliyor
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onNextStep}
        className="w-full py-3 bg-[#161615] hover:bg-stone-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
      >
        3. Adıma Geç: 3D Çatı Tasarımı ve Güneş Açısı
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
