import React from 'react';
import { SeasonKey } from '../types/architecture';
import { doyToTurkishDate, SEASON_REPRESENTATIVE_DOY } from '../engine/solarEngine';
import { BookOpen, Box, Clock, Download, FileText } from 'lucide-react';

interface HeaderBarProps {
  season: SeasonKey;
  onSelectSeason: (s: SeasonKey) => void;
  dayOfYear: number;
  solarHour: number;
  onChangeSolarHour: (h: number) => void;
  onExportObj: () => void;
  onExportReport: () => void;
  onOpenDocs: () => void;
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
  dayOfYear,
  solarHour,
  onChangeSolarHour,
  onExportObj,
  onExportReport,
  onOpenDocs,
}) => {
  return (
    <header className="w-full bg-white border-b border-[#D8D5CA] px-4 py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 no-print">
      {/* Sol: Marka ve Başlık */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-[#161615] text-white flex items-center justify-center font-mono text-xs font-semibold tracking-tighter">
          İF
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-[#161615] whitespace-nowrap">
            İKLİMFORM
          </div>
          <div className="text-[11px] text-stone-500 whitespace-nowrap">
            İklimsel Arazi, Optimal Kütle, 3D Solar Çatı & Yerel Malzeme Stüdyosu
          </div>
        </div>
      </div>

      {/* Orta: Mevsim Seçici ve Anlık Güneş Saati Kaydırıcısı */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-[#F5F4F0] border border-[#E2E0D8] px-3 py-1.5">
        <div className="flex items-center border border-[#D4D1C7] bg-white divide-x divide-[#E2E0D8]">
          {SEASON_LABELS.map((s) => (
            <button
              key={s.key}
              onClick={() => onSelectSeason(s.key)}
              className={`px-2.5 py-1 text-xs font-medium transition whitespace-nowrap ${
                season === s.key
                  ? 'bg-[#161615] text-white'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
              title={SEASON_REPRESENTATIVE_DOY[s.key].label}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono text-stone-600 whitespace-nowrap">
            {doyToTurkishDate(dayOfYear)}
          </span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#C85A17] shrink-0" />
            <input
              type="range"
              min={5}
              max={19.5}
              step={0.25}
              value={solarHour}
              onChange={(e) => onChangeSolarHour(Number(e.target.value))}
              className="w-24 sm:w-32"
            />
            <span className="font-mono text-xs font-semibold text-[#161615] w-11 whitespace-nowrap">
              {formatHour(solarHour)}
            </span>
          </div>
        </div>
      </div>

      {/* Sağ: Sistem Mimarisi, 3D OBJ Export ve Rapor */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenDocs}
          className="px-3 py-1.5 text-xs font-medium border border-[#D0CDC2] bg-[#F8F7F3] hover:bg-stone-200/70 text-[#161615] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Nasıl Yapıldı?
        </button>
        <button
          onClick={onExportObj}
          className="px-3 py-1.5 text-xs font-medium border border-[#D0CDC2] bg-white hover:bg-stone-100 text-[#161615] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Rhino, SketchUp, Blender ve Revit ile uyumlu 3D .OBJ modeli indir"
        >
          <Box className="w-3.5 h-3.5 text-[#C85A17]" />
          3D .OBJ İndir
        </button>
        <button
          onClick={onExportReport}
          className="px-3 py-1.5 text-xs font-semibold bg-[#161615] hover:bg-stone-800 text-white transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <FileText className="w-3.5 h-3.5" />
          Rapor İndir
          <Download className="w-3 h-3 opacity-75" />
        </button>
      </div>
    </header>
  );
};
