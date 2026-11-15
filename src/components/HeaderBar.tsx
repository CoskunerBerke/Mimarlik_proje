import React from 'react';
import { SeasonKey } from '../types/architecture';
import { Box, Download, Sun } from 'lucide-react';

interface HeaderBarProps {
  season: SeasonKey;
  onSelectSeason: (s: SeasonKey) => void;
  solarHour: number;
  onChangeSolarHour: (h: number) => void;
  onExportObj: () => void;
  onExportReport: () => void;
}

const SEASON_LABELS: Array<{ key: SeasonKey; label: string }> = [
  { key: 'spring', label: 'İlkbahar' },
  { key: 'summer', label: 'Yaz' },
  { key: 'autumn', label: 'Sonbahar' },
  { key: 'winter', label: 'Kış' },
];

function formatHour(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  season,
  onSelectSeason,
  solarHour,
  onChangeSolarHour,
  onExportObj,
  onExportReport,
}) => {
  return (
    <header className="w-full bg-white border-b border-stone-200 px-4 lg:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 no-print">
      {/* Sol: Net Marka ve Açıklama */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-[#161615] text-white flex items-center justify-center font-bold text-sm tracking-tight">
          İF
        </div>
        <div>
          <div className="text-base font-bold tracking-tight text-[#161615] whitespace-nowrap">
            İKLİMFORM
          </div>
          <div className="text-xs text-stone-500 whitespace-nowrap">
            İklime Uygun Bina Kütlesi, Çatı Açısı ve Yerel Malzeme Asistanı
          </div>
        </div>
      </div>

      {/* Orta: Anlaşılır Mevsim ve Güneş Saati Kontrolü */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-[#F6F5F0] border border-stone-200 px-3 py-1.5">
        <span className="text-xs font-medium text-stone-600 whitespace-nowrap hidden xl:inline">
          Mevsim:
        </span>
        <div className="flex items-center bg-white border border-stone-300">
          {SEASON_LABELS.map((s) => (
            <button
              key={s.key}
              onClick={() => onSelectSeason(s.key)}
              className={`px-3 py-1 text-xs font-semibold transition whitespace-nowrap ${
                season === s.key
                  ? 'bg-[#161615] text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pl-1">
          <Sun className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-xs text-stone-600 whitespace-nowrap">Güneş Saati:</span>
          <input
            type="range"
            min={6}
            max={19}
            step={0.25}
            value={solarHour}
            onChange={(e) => onChangeSolarHour(Number(e.target.value))}
            className="w-24 sm:w-28"
          />
          <span className="font-mono text-xs font-bold text-[#161615] w-11 whitespace-nowrap">
            {formatHour(solarHour)}
          </span>
        </div>
      </div>

      {/* Sağ: Sade Çıktı Butonları */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onExportObj}
          className="px-3 py-2 text-xs font-semibold border border-stone-300 bg-white hover:bg-stone-100 text-[#161615] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="3D modeli bilgisayarınıza indirin (SketchUp, Rhino, Blender uyumlu)"
        >
          <Box className="w-4 h-4 text-[#C85A17]" />
          3D Model İndir (.OBJ)
        </button>
        <button
          onClick={onExportReport}
          className="px-3.5 py-2 text-xs font-semibold bg-[#161615] hover:bg-stone-800 text-white transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Özeti İndir
        </button>
      </div>
    </header>
  );
};
