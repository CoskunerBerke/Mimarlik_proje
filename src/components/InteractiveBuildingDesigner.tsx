import React, { useRef, useState } from 'react';
import { MassBlock, SiteParameters } from '../types/architecture';
import { PlanUnderlayData } from '../engine/projectFileImporter';
import {
  Download,
  Eraser,
  Maximize2,
  MousePointer,
  PenTool,
  Plus,
} from 'lucide-react';

interface InteractiveBuildingDesignerProps {
  site: SiteParameters;
  blocks: MassBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<MassBlock[]>>;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  planUnderlay: PlanUnderlayData | null;
  prevailingWindLabel: string;
  recommendedUnitMassAvgKgM2: number;
}

type DesignerTool = 'draw' | 'select';

type DragInteraction =
  | {
      mode: 'draw_new';
      startX: number;
      startZ: number;
      curX: number;
      curZ: number;
    }
  | {
      mode: 'move_block';
      blockId: string;
      startMouseX: number;
      startMouseZ: number;
      origX: number;
      origZ: number;
    }
  | {
      mode: 'resize_block';
      blockId: string;
      anchorWest: number;
      anchorNorth: number;
    };

function snapHalfMeter(v: number): number {
  return Math.round(v * 2) / 2;
}

export const InteractiveBuildingDesigner: React.FC<InteractiveBuildingDesignerProps> = ({
  site,
  blocks,
  setBlocks,
  selectedBlockId,
  onSelectBlock,
  planUnderlay,
  prevailingWindLabel,
  recommendedUnitMassAvgKgM2,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<DesignerTool>('draw');
  const [defaultDrawFloors, setDefaultDrawFloors] = useState<number>(3);
  const [dragState, setDragState] = useState<DragInteraction | null>(null);

  const halfW = site.parcelWidthM / 2;
  const halfD = site.parcelDepthM / 2;
  const padM = 6; // Çevre yön etiketleri için pay
  const viewMinX = -halfW - padM;
  const viewMinZ = -halfD - padM;
  const viewW = site.parcelWidthM + padM * 2;
  const viewD = site.parcelDepthM + padM * 2;

  const clientToParcelXZ = (clientX: number, clientY: number): { x: number; z: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const rect = svg.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const nz = (clientY - rect.top) / Math.max(1, rect.height);
    const rawX = viewMinX + nx * viewW;
    const rawZ = viewMinZ + nz * viewD;
    return {
      x: snapHalfMeter(Math.max(-halfW + 1, Math.min(halfW - 1, rawX))),
      z: snapHalfMeter(Math.max(-halfD + 1, Math.min(halfD - 1, rawZ))),
    };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = clientToParcelXZ(e.clientX, e.clientY);
    setDragState({
      mode: 'draw_new',
      startX: pt.x,
      startZ: pt.z,
      curX: pt.x,
      curZ: pt.z,
    });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return;
    const pt = clientToParcelXZ(e.clientX, e.clientY);

    if (dragState.mode === 'draw_new') {
      setDragState({
        ...dragState,
        curX: pt.x,
        curZ: pt.z,
      });
    } else if (dragState.mode === 'move_block') {
      const dx = snapHalfMeter(pt.x - dragState.startMouseX);
      const dz = snapHalfMeter(pt.z - dragState.startMouseZ);
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === dragState.blockId
            ? {
                ...b,
                x: Math.max(-halfW + b.width / 2, Math.min(halfW - b.width / 2, dragState.origX + dx)),
                z: Math.max(-halfD + b.depth / 2, Math.min(halfD - b.depth / 2, dragState.origZ + dz)),
              }
            : b
        )
      );
    } else if (dragState.mode === 'resize_block') {
      const newW = Math.max(3, snapHalfMeter(pt.x - dragState.anchorWest));
      const newD = Math.max(3, snapHalfMeter(pt.z - dragState.anchorNorth));
      const newCenterX = Number((dragState.anchorWest + newW / 2).toFixed(2));
      const newCenterZ = Number((dragState.anchorNorth + newD / 2).toFixed(2));
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === dragState.blockId
            ? {
                ...b,
                width: newW,
                depth: newD,
                x: newCenterX,
                z: newCenterZ,
                ridgeDirection: newW >= newD ? 'EW' : 'NS',
              }
            : b
        )
      );
    }
  };

  const handleSvgPointerUp = () => {
    if (!dragState) return;
    if (dragState.mode === 'draw_new') {
      const w = Math.abs(dragState.curX - dragState.startX);
      const d = Math.abs(dragState.curZ - dragState.startZ);
      if (w >= 2.5 && d >= 2.5) {
        const cx = Number(((dragState.startX + dragState.curX) / 2).toFixed(2));
        const cz = Number(((dragState.startZ + dragState.curZ) / 2).toFixed(2));
        const newBlk: MassBlock = {
          id: `custom_${Date.now().toString().slice(-4)}`,
          label: `Bina Bloğu #${blocks.length + 1}`,
          role: 'primary_living',
          x: cx,
          z: cz,
          width: Number(w.toFixed(1)),
          depth: Number(d.toFixed(1)),
          floors: defaultDrawFloors,
          floorHeight: 3.3,
          rotationDeg: 0,
          roofType: 'gable',
          roofPitchDeg: 22,
          secondaryPitchDeg: 85,
          overhangSouthM: 1.0,
          sawtoothCount: 3,
          skylightRatio: 0.25,
          ridgeDirection: w >= d ? 'EW' : 'NS',
          hasPvPanels: false,
          glazingStyle: 'punched',
          customWallHex: '#EAE5DA',
          customRoofHex: '#475569',
        };
        setBlocks((prev) => [...prev, newBlk]);
        onSelectBlock(newBlk.id);
      }
    }
    setDragState(null);
  };

  const addQuickPiece = (preset: Partial<MassBlock> & { label: string; width: number; depth: number }) => {
    const offsetStep = (blocks.length % 4) * 3 - 4;
    const nextBlk: MassBlock = {
      id: `piece_${Date.now().toString().slice(-4)}`,
      label: preset.label,
      role: preset.role ?? 'primary_living',
      x: preset.x ?? offsetStep,
      z: preset.z ?? offsetStep * 0.5,
      width: preset.width,
      depth: preset.depth,
      floors: preset.floors ?? defaultDrawFloors,
      floorHeight: preset.floorHeight ?? 3.3,
      rotationDeg: 0,
      roofType: preset.roofType ?? 'gable',
      roofPitchDeg: preset.roofPitchDeg ?? 24,
      secondaryPitchDeg: 85,
      overhangSouthM: preset.overhangSouthM ?? 1.0,
      sawtoothCount: 3,
      skylightRatio: 0.25,
      ridgeDirection: preset.width >= preset.depth ? 'EW' : 'NS',
      hasPvPanels: false,
      specialFeature: preset.specialFeature,
      glazingStyle: preset.glazingStyle ?? 'punched',
      customWallHex: preset.customWallHex ?? '#EAE5DA',
      customRoofHex: preset.customRoofHex ?? '#475569',
    };
    setBlocks((prev) => [...prev, nextBlk]);
    onSelectBlock(nextBlk.id);
    setTool('select');
  };

  const handleSaveCustomJson = () => {
    const payload = JSON.stringify({ version: 1, blocks }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iklimform_kendi_binam.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Canlı İmar ve Ağırlık Hesapları
  const parcelAreaM2 = site.parcelWidthM * site.parcelDepthM;
  const footprintAreaM2 = Math.round(
    blocks
      .filter((b) => b.specialFeature !== 'outdoor_pool')
      .reduce((acc, b) => acc + b.width * b.depth, 0)
  );
  const totalBuiltAreaM2 = Math.round(
    blocks
      .filter((b) => b.specialFeature !== 'outdoor_pool' && b.specialFeature !== 'minaret')
      .reduce((acc, b) => acc + b.width * b.depth * b.floors, 0)
  );
  const currentTaks = footprintAreaM2 / Math.max(1, parcelAreaM2);
  const isTaksValid = currentTaks <= site.maxTaks;
  const estWeightTons = Math.round((totalBuiltAreaM2 * recommendedUnitMassAvgKgM2) / 1000);

  // Çizim esnasındaki önizleme dikdörtgeni
  const previewRect =
    dragState?.mode === 'draw_new'
      ? {
          x: Math.min(dragState.startX, dragState.curX),
          z: Math.min(dragState.startZ, dragState.curZ),
          w: Math.abs(dragState.curX - dragState.startX),
          d: Math.abs(dragState.curZ - dragState.startZ),
        }
      : null;

  // 5m kılavuz çizgileri
  const gridVerticals: number[] = [];
  for (let gx = -Math.floor(halfW / 5) * 5; gx <= halfW; gx += 5) gridVerticals.push(gx);
  const gridHorizontals: number[] = [];
  for (let gz = -Math.floor(halfD / 5) * 5; gz <= halfD; gz += 5) gridHorizontals.push(gz);

  return (
    <div className="bg-[#FAF9F6] border border-stone-300 p-4 space-y-3 text-xs">
      {/* Üst Araç Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('draw')}
            className={`px-3 py-1.5 font-bold border transition flex items-center gap-1.5 ${
              tool === 'draw'
                ? 'bg-[#C85A17] text-white border-[#C85A17]'
                : 'bg-white text-[#181816] border-stone-300 hover:bg-stone-50'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" /> 1. Arsa Üzerinde Fareyle Bina Çiz
          </button>

          <button
            type="button"
            onClick={() => setTool('select')}
            className={`px-3 py-1.5 font-bold border transition flex items-center gap-1.5 ${
              tool === 'select'
                ? 'bg-[#181816] text-white border-[#181816]'
                : 'bg-white text-[#181816] border-stone-300 hover:bg-stone-50'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" /> 2. Blok Taşı & Boyutlandır
          </button>

          {tool === 'draw' && (
            <div className="flex items-center gap-1.5 pl-2 text-stone-700">
              <span>Çizilecek Kat:</span>
              <select
                value={defaultDrawFloors}
                onChange={(e) => setDefaultDrawFloors(Number(e.target.value))}
                className="bg-white border border-stone-300 px-2 py-1 font-bold"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((f) => (
                  <option key={f} value={f}>
                    {f} Kat
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setBlocks([]);
              onSelectBlock(null);
              setTool('draw');
            }}
            className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-stone-300 font-semibold flex items-center gap-1"
          >
            <Eraser className="w-3.5 h-3.5" /> Arsayı Boşalt (Sıfırdan Başla)
          </button>

          {blocks.length > 0 && (
            <button
              type="button"
              onClick={handleSaveCustomJson}
              className="px-2.5 py-1.5 bg-white hover:bg-stone-100 text-[#181816] border border-stone-300 font-semibold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Tasarımı Kaydet (.JSON)
            </button>
          )}
        </div>
      </div>

      {/* Tek Tıkla Hazır Mimari Parça Kütüphanesi */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-stone-600 mr-1">Hazır Parça Ekle:</span>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Ana Yaşam / Derslik Bloğu',
              width: 20,
              depth: 11,
              floors: 3,
              roofType: 'gable',
              customWallHex: '#EFECE4',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-[#C85A17]" /> Ana Blok
        </button>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Yan Kanat (L/U Kolu)',
              width: 11,
              depth: 16,
              floors: 3,
              roofType: 'mono_pitch',
              customWallHex: '#E5DFD3',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-[#C85A17]" /> Yan Kanat
        </button>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Camlı Giriş Fuayesi',
              width: 12,
              depth: 9,
              floors: 2,
              roofType: 'flat_green',
              glazingStyle: 'curtain_wall',
              specialFeature: 'entrance_canopy',
              customWallHex: '#CBD5E1',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-[#C85A17]" /> Cam Fuaye
        </button>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Spor / Konferans Salonu',
              width: 16,
              depth: 22,
              floors: 1,
              floorHeight: 8.0,
              roofType: 'barrel_vault',
              glazingStyle: 'minimal_hall',
              customWallHex: '#DFDBD0',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-[#C85A17]" /> Tonoz Salon
        </button>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Kubbeli Ana Salon',
              width: 16,
              depth: 16,
              floors: 1,
              floorHeight: 10.5,
              roofType: 'dome',
              roofPitchDeg: 35,
              glazingStyle: 'arched_classic',
              customWallHex: '#EAE3D2',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-[#C85A17]" /> Kubbeli Hacim
        </button>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Minare',
              width: 3.2,
              depth: 3.2,
              floors: 1,
              floorHeight: 26,
              x: -12,
              z: -6,
              specialFeature: 'minaret',
              customWallHex: '#EAE3D2',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-[#C85A17]" /> Minare
        </button>
        <button
          type="button"
          onClick={() =>
            addQuickPiece({
              label: 'Açık Yüzme Havuzu',
              width: 13,
              depth: 7.5,
              floors: 1,
              floorHeight: 0.5,
              z: 12,
              roofType: 'flat_green',
              specialFeature: 'outdoor_pool',
            })
          }
          className="px-2 py-1 bg-white border border-stone-300 hover:border-[#181816] font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-sky-600" /> Havuz
        </button>
      </div>

      {/* İnteraktif 2D Kuşbakışı Kareli Arsa Çizim Tuvali */}
      <div className="bg-white border border-stone-300 p-2 relative">
        <svg
          ref={svgRef}
          viewBox={`${viewMinX} ${viewMinZ} ${viewW} ${viewD}`}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          className={`w-full h-72 sm:h-80 select-none touch-none ${
            tool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        >
          {/* Dış Arkaplan */}
          <rect x={viewMinX} y={viewMinZ} width={viewW} height={viewD} fill="#F3F1EC" />

          {/* Arsa Zemini */}
          <rect
            x={-halfW}
            y={-halfD}
            width={site.parcelWidthM}
            height={site.parcelDepthM}
            fill="#FAF9F5"
            stroke="#181816"
            strokeWidth={0.35}
          />

          {/* Yüklenen PDF / AutoCAD DXF / Görsel Plan Altlığı Varsa Tam Ölçekli Göster */}
          {planUnderlay && (
            <g
              transform={`translate(${planUnderlay.offsetX}, ${planUnderlay.offsetZ}) rotate(${planUnderlay.rotationDeg})`}
              opacity={planUnderlay.opacity}
            >
              <image
                href={planUnderlay.dataUrl}
                x={-planUnderlay.widthM / 2}
                y={-(planUnderlay.widthM / planUnderlay.aspectRatio) / 2}
                width={planUnderlay.widthM}
                height={planUnderlay.widthM / planUnderlay.aspectRatio}
                preserveAspectRatio="none"
              />
            </g>
          )}

          {/* 5m Kareli Mimari Kılavuz Çizgileri */}
          {gridVerticals.map((gx) => (
            <line
              key={`vx_${gx}`}
              x1={gx}
              y1={-halfD}
              x2={gx}
              y2={halfD}
              stroke="#E5E2DC"
              strokeWidth={gx === 0 ? 0.22 : 0.12}
            />
          ))}
          {gridHorizontals.map((gz) => (
            <line
              key={`hz_${gz}`}
              x1={-halfW}
              y1={gz}
              x2={halfW}
              y2={gz}
              stroke="#E5E2DC"
              strokeWidth={gz === 0 ? 0.22 : 0.12}
            />
          ))}

          {/* İmar Çekme Sınırı (Kesikli Çizgi) */}
          <rect
            x={-halfW + site.setbackM}
            y={-halfD + site.setbackM}
            width={site.parcelWidthM - site.setbackM * 2}
            height={site.parcelDepthM - site.setbackM * 2}
            fill="none"
            stroke="#A8A29E"
            strokeWidth={0.22}
            strokeDasharray="1.2 0.9"
          />

          {/* Yön Etiketleri (Kuzey, Güney Güneşi, Doğu, Batı ve Rüzgar) */}
          <text
            x={0}
            y={-halfD - 1.8}
            textAnchor="middle"
            fontSize={2.1}
            fontWeight="bold"
            fill="#181816"
          >
            ▲ KUZEY · Hakim Rüzgar: {prevailingWindLabel}
          </text>
          <text
            x={0}
            y={halfD + 3.4}
            textAnchor="middle"
            fontSize={2.1}
            fontWeight="bold"
            fill="#C85A17"
          >
            ▼ GÜNEY CEPHE (Kış Güneşi & Doğal Isınma Yönü)
          </text>
          <text
            x={-halfW - 1.5}
            y={0}
            textAnchor="middle"
            fontSize={1.9}
            fontWeight="bold"
            fill="#57534E"
            transform={`rotate(-90, ${-halfW - 1.5}, 0)`}
          >
            BATI ({site.parcelDepthM}m)
          </text>
          <text
            x={halfW + 2.2}
            y={0}
            textAnchor="middle"
            fontSize={1.9}
            fontWeight="bold"
            fill="#57534E"
            transform={`rotate(90, ${halfW + 2.2}, 0)`}
          >
            DOĞU
          </text>

          {/* Mevcut Bina Blokları */}
          {blocks.map((b, idx) => {
            const isSel = b.id === selectedBlockId;
            const bx = b.x - b.width / 2;
            const bz = b.z - b.depth / 2;
            const fillHex =
              b.specialFeature === 'outdoor_pool'
                ? '#38BDF8'
                : b.customWallHex ?? '#E5E0D5';

            return (
              <g
                key={b.id}
                transform={`rotate(${b.rotationDeg}, ${b.x}, ${b.z})`}
                onPointerDown={(ev) => {
                  if (tool === 'draw') return;
                  ev.stopPropagation();
                  (ev.currentTarget.ownerSVGElement as SVGSVGElement)?.setPointerCapture(
                    ev.pointerId
                  );
                  onSelectBlock(b.id);
                  const pt = clientToParcelXZ(ev.clientX, ev.clientY);
                  setDragState({
                    mode: 'move_block',
                    blockId: b.id,
                    startMouseX: pt.x,
                    startMouseZ: pt.z,
                    origX: b.x,
                    origZ: b.z,
                  });
                }}
                style={{ cursor: tool === 'select' ? 'move' : 'crosshair' }}
              >
                <rect
                  x={bx}
                  y={bz}
                  width={b.width}
                  height={b.depth}
                  fill={fillHex}
                  fillOpacity={0.9}
                  stroke={isSel ? '#C85A17' : '#181816'}
                  strokeWidth={isSel ? 0.55 : 0.28}
                />
                <text
                  x={b.x}
                  y={b.z - 0.4}
                  textAnchor="middle"
                  fontSize={Math.min(2.1, b.width * 0.18)}
                  fontWeight="bold"
                  fill="#181816"
                  pointerEvents="none"
                >
                  {idx + 1}. {b.label.slice(0, 16)}
                </text>
                <text
                  x={b.x}
                  y={b.z + 1.9}
                  textAnchor="middle"
                  fontSize={Math.min(1.8, b.width * 0.15)}
                  fill="#44403C"
                  pointerEvents="none"
                >
                  {b.width}×{b.depth}m · {b.floors}K
                </text>

                {/* Sağ-Alt Boyutlandırma Tutamacı */}
                {isSel && tool === 'select' && (
                  <rect
                    x={bx + b.width - 1.3}
                    y={bz + b.depth - 1.3}
                    width={2.2}
                    height={2.2}
                    fill="#C85A17"
                    stroke="#FFFFFF"
                    strokeWidth={0.25}
                    style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      (ev.currentTarget.ownerSVGElement as SVGSVGElement)?.setPointerCapture(
                        ev.pointerId
                      );
                      setDragState({
                        mode: 'resize_block',
                        blockId: b.id,
                        anchorWest: bx,
                        anchorNorth: bz,
                      });
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* Çizim Sırasında Canlı Dikdörtgen Önizlemesi */}
          {previewRect && previewRect.w > 0.5 && previewRect.d > 0.5 && (
            <g pointerEvents="none">
              <rect
                x={previewRect.x}
                y={previewRect.z}
                width={previewRect.w}
                height={previewRect.d}
                fill="#C85A17"
                fillOpacity={0.22}
                stroke="#C85A17"
                strokeWidth={0.4}
                strokeDasharray="0.8 0.5"
              />
              <text
                x={previewRect.x + previewRect.w / 2}
                y={previewRect.z + previewRect.d / 2}
                textAnchor="middle"
                fontSize={2.2}
                fontWeight="bold"
                fill="#9A3412"
              >
                {previewRect.w.toFixed(1)}m × {previewRect.d.toFixed(1)}m (
                {Math.round(previewRect.w * previewRect.d)} m²)
              </text>
            </g>
          )}
        </svg>

        {blocks.length === 0 && !dragState && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="bg-white/95 border border-stone-300 px-4 py-2.5 text-center shadow-sm max-w-sm">
              <div className="font-bold text-[#181816]">Arsanız Hazır — Kendi Binanızı Çizin</div>
              <div className="text-[11px] text-stone-600 mt-0.5">
                Kareli arsa üzerinde farenin sol tuşuna basılı tutup sürükleyerek ilk bina bloğunuzu
                oluşturun veya üstteki hazır parçalardan ekleyin; aşağıdaki 3D sahnede anında yükselir.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Canlı İmar (TAKS) ve Deprem Kütlesi Karnesi */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-stone-200 px-3 py-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Taban Oturumu: <strong>{footprintAreaM2.toLocaleString('tr-TR')} m²</strong> (TAKS:{' '}
            <strong className={isTaksValid ? 'text-[#15803D]' : 'text-amber-700'}>
              %{(currentTaks * 100).toFixed(0)} / Sınır %{(site.maxTaks * 100).toFixed(0)}
            </strong>
            )
          </span>
          <span>
            Toplam İnşaat Alanı: <strong>{totalBuiltAreaM2.toLocaleString('tr-TR')} m²</strong>
          </span>
          <span>
            Hedef Bina Ağırlığı: <strong>~{estWeightTons.toLocaleString('tr-TR')} ton</strong>
          </span>
        </div>
        <span className="text-stone-500 flex items-center gap-1">
          <Maximize2 className="w-3 h-3" /> Arsa: {site.parcelWidthM}m × {site.parcelDepthM}m (1 kare = 5×5m)
        </span>
      </div>
    </div>
  );
};
