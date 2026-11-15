import React, { useState } from 'react';
import {
  CityClimateProfile,
  EvaluatedMaterial,
  MaterialCategoryKey,
} from '../types/architecture';
import { AssemblySummary } from '../engine/materialEngine';
import { Check, CheckCircle2, Leaf, MapPin, ShieldAlert, Sparkles, Truck } from 'lucide-react';

interface MaterialPanelProps {
  city: CityClimateProfile;
  evaluatedMaterials: EvaluatedMaterial[];
  selectedIds: Record<MaterialCategoryKey, string>;
  onSelectMaterial: (cat: MaterialCategoryKey, id: string) => void;
  onResetOptimalMaterials: () => void;
  assemblySummary: AssemblySummary;
}

const SIMPLE_CATEGORIES: Array<{ key: MaterialCategoryKey; short: string; full: string }> = [
  { key: 'envelope_wall', short: 'Dış Duvar', full: 'Dış Duvar Malzemesi' },
  { key: 'structure', short: 'Taşıyıcı', full: 'Taşıyıcı Sistem (İskelet)' },
  { key: 'insulation', short: 'Yalıtım', full: 'Isı ve Ses Yalıtımı' },
  { key: 'facade_shading', short: 'Cephe', full: 'Dış Cephe & Güneş Kırıcı' },
  { key: 'roof_finish', short: 'Çatı', full: 'Çatı Kaplama Malzemesi' },
  { key: 'courtyard_ground', short: 'Avlu Zemini', full: 'Avlu ve Bahçe Zemini' },
];

export const MaterialPanel: React.FC<MaterialPanelProps> = ({
  city,
  evaluatedMaterials,
  selectedIds,
  onSelectMaterial,
  onResetOptimalMaterials,
  assemblySummary,
}) => {
  const [activeCat, setActiveCat] = useState<MaterialCategoryKey>('envelope_wall');
  const activeCatMeta = SIMPLE_CATEGORIES.find((c) => c.key === activeCat)!;
  const visibleMaterials = evaluatedMaterials.filter((e) => e.material.category === activeCat);

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#161615]">
            4. Yerel ve Çevre Dostu Malzemeler
          </h2>
          <p className="text-xs text-stone-600 mt-1 leading-relaxed">
            {city.name} bölgesine yakın üretilen, iklime dayanıklı ve doğaya en az karbon salan
            malzeme önerileri.
          </p>
        </div>
        <button
          onClick={onResetOptimalMaterials}
          className="px-3 py-2 bg-[#161615] text-white text-xs font-semibold hover:bg-stone-800 transition flex items-center gap-1.5 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Otomatik Seç
        </button>
      </div>

      {/* Herkesin Anlayacağı 3'lü Sürdürülebilirlik Özeti */}
      <div className="grid grid-cols-3 gap-2.5 text-xs">
        <div className="bg-[#F8F7F3] border border-stone-200 p-3">
          <span className="text-stone-500 block mb-1">Isı Koruma</span>
          {assemblySummary.passesTs825 ? (
            <strong className="text-[#15803D] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> İklime Uygun
            </strong>
          ) : (
            <strong className="text-amber-700 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Yalıtım Artmalı
            </strong>
          )}
          <span className="text-[11px] text-stone-500 block mt-1">
            Isıyı {assemblySummary.thermalLagHours} saat geciktirir
          </span>
        </div>

        <div className="bg-[#F8F7F3] border border-stone-200 p-3">
          <span className="text-stone-500 block mb-1">Karbon Tasarrufu</span>
          <strong className="text-[#15803D] text-sm">
            {assemblySummary.carbonSavedPct > 0
              ? `-%${assemblySummary.carbonSavedPct} Daha Az`
              : 'Standart'}
          </strong>
          <span className="text-[11px] text-stone-500 block mt-1">
            Klasik betona kıyasla
          </span>
        </div>

        <div className="bg-[#F8F7F3] border border-stone-200 p-3">
          <span className="text-stone-500 block mb-1">Yerel Erişim</span>
          <strong className="text-[#161615] text-sm">
            %{assemblySummary.regionalRatioPct} Yakın
          </strong>
          <span className="text-[11px] text-stone-500 block mt-1">500 km içinden tedarik</span>
        </div>
      </div>

      {/* Katman Seçici Sekmeler (Kaydırma Karmaşasını Önler) */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-stone-800">
          Binanın Hangi Katmanını İncelemek İstiyorsunuz?
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {SIMPLE_CATEGORIES.map((cat) => {
            const isSel = cat.key === activeCat;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCat(cat.key)}
                className={`py-2 px-2 text-xs font-semibold border transition whitespace-nowrap truncate ${
                  isSel
                    ? 'bg-[#161615] text-white border-[#161615]'
                    : 'bg-[#FAF9F6] text-stone-700 border-stone-200 hover:bg-white'
                }`}
              >
                {cat.short}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-bold text-stone-800 pt-1">{activeCatMeta.full}</div>

        {/* Seçili Katmanın Malzeme Kartları */}
        <div className="space-y-2.5">
          {visibleMaterials.map((ev, idx) => {
            const isChosen = ev.material.id === selectedIds[activeCat];
            return (
              <div
                key={ev.material.id}
                onClick={() => onSelectMaterial(activeCat, ev.material.id)}
                className={`border p-3.5 cursor-pointer transition ${
                  isChosen
                    ? 'border-[#161615] bg-white shadow-xs'
                    : 'border-stone-200 bg-[#FAF9F6] hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-4 h-4 mt-0.5 shrink-0 border border-stone-400"
                      style={{ backgroundColor: ev.material.colorHex }}
                    />
                    <div>
                      <div className="font-bold text-[#161615] text-xs leading-snug">
                        {ev.material.name}
                      </div>
                      {idx === 0 && (
                        <span className="text-[11px] font-semibold text-[#15803D]">
                          Bu Şehir İçin En Çok Önerilen
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-[#161615]">%{ev.overallScore}</span>
                    <span className="block text-[10px] text-stone-500">Uyum</span>
                  </div>
                </div>

                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  {ev.material.architecturalNote}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2 border-t border-stone-200 text-[11px] text-stone-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#C85A17]" />
                    Kaynak: <strong>{ev.material.originCity}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-stone-500" />
                    Mesafe: <strong>{ev.distanceKm} km</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Leaf className="w-3.5 h-3.5 text-[#15803D]" />
                    Geri Dönüşüm: <strong>%{ev.material.recyclabilityPct}</strong>
                  </span>
                </div>

                <div className="mt-1.5 text-[11px] text-stone-500">
                  Usta ve malzeme erişimi: <strong className="text-stone-700">{ev.material.localCraftAvailability}</strong>
                </div>

                {isChosen && (
                  <div className="mt-2 pt-2 border-t border-stone-100 text-xs font-semibold text-[#161615] flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-[#15803D]" /> Seçili Malzeme
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
