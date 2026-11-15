import React from 'react';
import {
  CityClimateProfile,
  EvaluatedMaterial,
  MaterialCategoryKey,
} from '../types/architecture';
import {
  AssemblySummary,
  MATERIAL_CATEGORY_LABELS,
} from '../engine/materialEngine';
import { CheckCircle2, Leaf, MapPin, ShieldAlert, Sparkles, Truck } from 'lucide-react';

interface MaterialPanelProps {
  city: CityClimateProfile;
  evaluatedMaterials: EvaluatedMaterial[];
  selectedIds: Record<MaterialCategoryKey, string>;
  onSelectMaterial: (cat: MaterialCategoryKey, id: string) => void;
  onResetOptimalMaterials: () => void;
  assemblySummary: AssemblySummary;
}

const CATEGORIES: MaterialCategoryKey[] = [
  'structure',
  'envelope_wall',
  'insulation',
  'facade_shading',
  'roof_finish',
  'courtyard_ground',
];

export const MaterialPanel: React.FC<MaterialPanelProps> = ({
  city,
  evaluatedMaterials,
  selectedIds,
  onSelectMaterial,
  onResetOptimalMaterials,
  assemblySummary,
}) => {
  return (
    <div className="space-y-4 text-xs">
      {/* 04.1 Kabuk Sürdürülebilirlik & TS 825 Isıl Performans Özeti */}
      <section className="space-y-2.5 border-b border-[#E2E0D8] pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            04.1 Kabuk LCA Karbon & TS 825 Analizi
          </span>
          <button
            onClick={onResetOptimalMaterials}
            className="px-2.5 py-1 bg-[#161615] text-white font-medium hover:bg-stone-800 transition flex items-center gap-1 whitespace-nowrap"
          >
            <Sparkles className="w-3 h-3 text-amber-400" /> İklime En Uygun Kombinasyon
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Duvar U-Değeri</span>
              {assemblySummary.passesTs825 ? (
                <span className="text-[10px] font-semibold text-[#15803D] flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> TS 825 Uygun
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-0.5">
                  <ShieldAlert className="w-3 h-3" /> Sınır Üstü
                </span>
              )}
            </div>
            <div className="font-mono text-sm font-bold text-[#161615] mt-0.5">
              {assemblySummary.wallUValueWm2K} W/m²K
            </div>
            <div className="font-mono text-[10px] text-stone-500">
              Bölge {city.ts825Zone} Sınırı: ≤ {assemblySummary.ts825WallLimit} W/m²K
            </div>
          </div>

          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Gömülü Karbon (A1–A4)</span>
              <span className="text-[10px] font-mono font-semibold text-[#15803D]">
                {assemblySummary.carbonSavedPct > 0
                  ? `-%${assemblySummary.carbonSavedPct} Karbon`
                  : 'Standart'}
              </span>
            </div>
            <div className="font-mono text-sm font-bold text-[#161615] mt-0.5">
              {assemblySummary.embodiedCarbonPerBuiltM2} kgCO₂e/m²
            </div>
            <div className="font-mono text-[10px] text-stone-500">
              Toplam: {assemblySummary.totalProjectCarbonTons} ton (Ref: {assemblySummary.baselineConventionalTons}t)
            </div>
          </div>

          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
            <span className="text-[10px] text-stone-500 block">Termal Faz Kayması</span>
            <strong className="font-mono text-xs text-[#161615]">
              {assemblySummary.thermalLagHours} Saat Gecikme
            </strong>
          </div>

          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-2">
            <span className="text-[10px] text-stone-500 block">Yerel Tedarik (&lt;500 km)</span>
            <strong className="font-mono text-xs text-[#15803D]">
              %{assemblySummary.regionalRatioPct} Yerel Kaynak
            </strong>
          </div>
        </div>
      </section>

      {/* 04.2 Katman Bazlı Yerel Malzeme, Erişilebilirlik & Sürdürülebilirlik Matrisi */}
      <section className="space-y-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500 block">
          04.2 {city.name} İçin Katman Bazlı Malzeme Önerileri
        </span>

        {CATEGORIES.map((cat) => {
          const items = evaluatedMaterials.filter((e) => e.material.category === cat);
          const selectedId = selectedIds[cat];

          return (
            <div key={cat} className="space-y-1.5 border-b border-[#ECEAE2] pb-3 last:border-b-0">
              <div className="font-mono text-[11px] font-bold text-[#161615]">
                {MATERIAL_CATEGORY_LABELS[cat]}
              </div>

              <div className="space-y-1.5">
                {items.map((ev, idx) => {
                  const isChosen = ev.material.id === selectedId;
                  return (
                    <div
                      key={ev.material.id}
                      onClick={() => onSelectMaterial(cat, ev.material.id)}
                      className={`border p-2.5 cursor-pointer transition ${
                        isChosen
                          ? 'border-[#161615] bg-white shadow-sm'
                          : 'border-[#E2E0D8] bg-[#FAF9F5] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span
                            className="w-3.5 h-3.5 mt-0.5 shrink-0 border border-stone-400"
                            style={{ backgroundColor: ev.material.colorHex }}
                          />
                          <div>
                            <div className="font-semibold text-[#161615] leading-snug">
                              {ev.material.name}
                              {idx === 0 && (
                                <span className="ml-1.5 font-mono text-[10px] text-[#C85A17] uppercase">
                                  [Önerilen]
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-stone-500 mt-0.5 font-mono">
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" /> {ev.material.originCity}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Truck className="w-3 h-3" /> {ev.distanceKm} km
                                {ev.isRegionalLeed ? ' (Yerel)' : ''}
                              </span>
                              <span>Uygulama: {ev.material.localCraftAvailability}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <div className="text-sm font-bold text-[#161615]">{ev.overallScore}</div>
                          <div className="text-[9px] text-stone-500">Uyum Skoru</div>
                        </div>
                      </div>

                      <p className="text-[11px] text-stone-600 mt-1.5 leading-snug">
                        {ev.material.architecturalNote}
                      </p>

                      {/* Alt Teknik & Sürdürülebilirlik Çubuğu */}
                      <div className="grid grid-cols-4 gap-1.5 mt-2 pt-1.5 border-t border-[#ECEAE2] font-mono text-[10px]">
                        <div>
                          <span className="text-stone-400 block font-sans">İklim</span>
                          <strong>{ev.climateFitScore}/100</strong>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-sans">Erişim</span>
                          <strong>{ev.accessibilityScore}/100</strong>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-sans">Karbon/m²</span>
                          <strong
                            className={
                              ev.totalCarbonKgM2 <= 0 ? 'text-[#15803D]' : 'text-[#161615]'
                            }
                          >
                            {ev.totalCarbonKgM2 > 0 ? `+${ev.totalCarbonKgM2}` : ev.totalCarbonKgM2} kg
                          </strong>
                        </div>
                        <div>
                          <span className="text-stone-400 block font-sans flex items-center gap-0.5">
                            <Leaf className="w-2.5 h-2.5 text-[#15803D]" /> Döngüsel
                          </span>
                          <strong>%{ev.material.recyclabilityPct}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
