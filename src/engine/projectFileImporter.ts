import * as THREE from 'three';
import { MassBlock } from '../types/architecture';

export interface PlanUnderlayData {
  id: string;
  fileName: string;
  fileKind: 'pdf' | 'dxf' | 'image';
  dataUrl: string;
  aspectRatio: number; // width / height
  widthM: number; // Arsada kapladığı genişlik (metre)
  offsetX: number;
  offsetZ: number;
  rotationDeg: number;
  opacity: number;
  pdfPageCount?: number;
  pdfCurrentPage?: number;
  rawFile?: File;
  extractedSummary: string[];
  suggestedFloors?: number;
  suggestedAreaM2?: number;
  extractedDxfBlocks?: MassBlock[];
}

export interface Imported3DModelData {
  id: string;
  fileName: string;
  formatLabel: string;
  group: THREE.Group;
  rawSize: { x: number; y: number; z: number };
  unitScale: number; // 1 (m), 0.01 (cm), 0.001 (mm)
  customMultiplier: number;
  flipYZ: boolean; // Z-yukarı (AutoCAD/Rhino/STL) -> Y-yukarı çevrimi
  offsetX: number;
  offsetZ: number;
  rotationDeg: number;
  hideGeneratedBlocks: boolean;
}

export type ProjectImportResult =
  | { kind: 'underlay'; underlay: PlanUnderlayData }
  | { kind: 'model3d'; model: Imported3DModelData }
  | { kind: 'blocks_json'; blocks: MassBlock[]; fileName: string };

const ARCH_SPACE_KEYWORDS = [
  'Derslik',
  'Laboratuvar',
  'Kütüphane',
  'Spor Salonu',
  'Konferans',
  'Salon',
  'Mutfak',
  'Yatak Odası',
  'Balkon',
  'Teras',
  'Harim',
  'Şadırvan',
  'Minare',
  'Poliklinik',
  'Acil',
  'Ameliyathane',
  'Ofis',
  'Toplantı',
  'Atölye',
  'Fuaye',
  'Avlu',
  'Otopark',
  'Sığınak',
];

/**
 * PDF Paftasının seçilen sayfasını yüksek çözünürlüklü plan altlığına dönüştürür
 * ve pafta içindeki kat/metrekare/mekan yazılarını otomatik okur.
 */
export async function renderPdfProjectPage(
  file: File,
  pageNumber = 1
): Promise<PlanUnderlayData> {
  const pdfjsLib = await import('pdfjs-dist');
  const pdfWorkerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default;

  const arrayBuf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const safePage = Math.max(1, Math.min(totalPages, pageNumber));
  const page = await pdf.getPage(safePage);

  const baseViewport = page.getViewport({ scale: 1 });
  const maxSide = Math.max(baseViewport.width, baseViewport.height, 1);
  const targetScale = Math.min(3.0, Math.max(1.5, 1900 / maxSide));
  const viewport = page.getViewport({ scale: targetScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF çizim tuvali başlatılamadı.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise;

  // PDF içindeki metinleri (antet, mahal listesi, kat ve m² notları) oku
  let combinedText = '';
  const pagesToScan = Math.min(totalPages, 3);
  for (let pIdx = 1; pIdx <= pagesToScan; pIdx++) {
    try {
      const pg = pIdx === safePage ? page : await pdf.getPage(pIdx);
      const tc = await pg.getTextContent();
      const pageStr = tc.items
        .map((it) => ('str' in it ? String(it.str) : ''))
        .join(' ');
      combinedText += ' ' + pageStr;
    } catch {
      // Metin okunamazsa taranmış görsel paftadır, görüntü olarak devam et
    }
  }

  const summary: string[] = [
    `PDF Paftası yüklendi (${totalPages} sayfa · Aktif: Sayfa ${safePage})`,
  ];

  let suggestedFloors: number | undefined;
  const zPlusMatch = combinedText.match(/\bZ\s*\+\s*(\d{1,2})\b/i);
  const katMatch =
    combinedText.match(/(\d{1,2})\s*(?:normal\s*)?kat(?:lı)?\b/i) ||
    combinedText.match(/kat\s*adedi\s*[:=-]?\s*(\d{1,2})/i);

  if (zPlusMatch) {
    suggestedFloors = Math.min(15, 1 + Number(zPlusMatch[1]));
    summary.push(`Pafta antetinden algılanan kat düzeni: Z+${zPlusMatch[1]} (${suggestedFloors} Kat)`);
  } else if (katMatch) {
    const fl = Number(katMatch[1]);
    if (fl >= 1 && fl <= 18) {
      suggestedFloors = fl;
      summary.push(`Pafta metninden algılanan kat sayısı: ${fl} Kat`);
    }
  }

  let suggestedAreaM2: number | undefined;
  const areaMatches = Array.from(
    combinedText.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{3,5})\s*(?:m²|m2)\b/gi)
  );
  if (areaMatches.length > 0) {
    const parsedNums = areaMatches
      .map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')))
      .filter((n) => !Number.isNaN(n) && n >= 120 && n <= 45000);
    if (parsedNums.length > 0) {
      suggestedAreaM2 = Math.round(Math.max(...parsedNums));
      summary.push(
        `Paftada tespit edilen inşaat/parsel alanı: ~${suggestedAreaM2.toLocaleString('tr-TR')} m²`
      );
    }
  }

  const foundKeywords = ARCH_SPACE_KEYWORDS.filter((kw) =>
    new RegExp(kw, 'i').test(combinedText)
  );
  if (foundKeywords.length > 0) {
    summary.push(`Tespit edilen mekanlar: ${foundKeywords.slice(0, 6).join(', ')}`);
  } else if (combinedText.trim().length < 15) {
    summary.push('Taranmış çizim paftası olarak 3D arsa zeminine 1:1 altlık şeklinde yerleştirildi.');
  }

  const aspectRatio = canvas.width / Math.max(1, canvas.height);

  return {
    id: `pdf_${Date.now()}`,
    fileName: file.name,
    fileKind: 'pdf',
    dataUrl: canvas.toDataURL('image/png'),
    aspectRatio,
    widthM: 56,
    offsetX: 0,
    offsetZ: 0,
    rotationDeg: 0,
    opacity: 0.92,
    pdfPageCount: totalPages,
    pdfCurrentPage: safePage,
    rawFile: file,
    extractedSummary: summary,
    suggestedFloors,
    suggestedAreaM2,
  };
}

interface DxfPolylineItem {
  points: Array<{ x: number; y: number }>;
  closed: boolean;
}

/**
 * AutoCAD .DXF dosyasındaki çizgileri ve kapalı bina poligonlarını okur;
 * hem 3D zemin altlığı üretir hem de kapalı bina konturlarını 3D kütleye çevirir.
 */
async function parseDxfProjectFile(file: File): Promise<PlanUnderlayData> {
  const raw = await file.text();
  const lines = raw.split(/\r?\n/);

  const polylines: DxfPolylineItem[] = [];
  let inEntities = false;
  let i = 0;

  while (i + 1 < lines.length) {
    const code = lines[i].trim();
    const val = lines[i + 1].trim();
    i += 2;

    if (code === '0' && val === 'SECTION') {
      if (i + 1 < lines.length && lines[i].trim() === '2' && lines[i + 1].trim() === 'ENTITIES') {
        inEntities = true;
        i += 2;
      }
      continue;
    }
    if (code === '0' && val === 'ENDSEC') {
      inEntities = false;
      continue;
    }
    if (!inEntities || code !== '0') continue;

    if (val === 'LINE') {
      let x1 = 0,
        y1 = 0,
        x2 = 0,
        y2 = 0;
      while (i + 1 < lines.length && lines[i].trim() !== '0') {
        const c = lines[i].trim();
        const v = Number(lines[i + 1].trim());
        i += 2;
        if (c === '10') x1 = v;
        else if (c === '20') y1 = v;
        else if (c === '11') x2 = v;
        else if (c === '21') y2 = v;
      }
      if (!Number.isNaN(x1) && !Number.isNaN(x2)) {
        polylines.push({
          points: [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ],
          closed: false,
        });
      }
    } else if (val === 'LWPOLYLINE') {
      const pts: Array<{ x: number; y: number }> = [];
      let closed = false;
      let curX: number | null = null;
      while (i + 1 < lines.length && lines[i].trim() !== '0') {
        const c = lines[i].trim();
        const vStr = lines[i + 1].trim();
        i += 2;
        if (c === '70') {
          closed = (Number(vStr) & 1) === 1;
        } else if (c === '10') {
          curX = Number(vStr);
        } else if (c === '20' && curX !== null) {
          const curY = Number(vStr);
          if (!Number.isNaN(curX) && !Number.isNaN(curY)) {
            pts.push({ x: curX, y: curY });
          }
          curX = null;
        }
      }
      if (pts.length >= 2) {
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (Math.hypot(first.x - last.x, first.y - last.y) < 0.05 && pts.length >= 3) {
          closed = true;
        }
        polylines.push({ points: pts, closed });
      }
    } else if (val === 'CIRCLE') {
      let cx = 0,
        cy = 0,
        r = 0;
      while (i + 1 < lines.length && lines[i].trim() !== '0') {
        const c = lines[i].trim();
        const v = Number(lines[i + 1].trim());
        i += 2;
        if (c === '10') cx = v;
        else if (c === '20') cy = v;
        else if (c === '40') r = v;
      }
      if (r > 0) {
        const cPts: Array<{ x: number; y: number }> = [];
        for (let s = 0; s < 20; s++) {
          const ang = (s / 20) * Math.PI * 2;
          cPts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
        }
        polylines.push({ points: cPts, closed: true });
      }
    }
  }

  if (polylines.length === 0) {
    throw new Error(
      'DXF dosyasında okunabilir çizgi (LINE / LWPOLYLINE) bulunamadı. Lütfen ASCII DXF veya PDF olarak kaydedip deneyin.'
    );
  }

  // Uç/aykırı sıfır noktalarını (UTM koordinatlı Türk plankotelerinde (0,0) noktası) filtrele
  const allX: number[] = [];
  const allY: number[] = [];
  for (const pl of polylines) {
    for (const pt of pl.points) {
      if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        allX.push(pt.x);
        allY.push(pt.y);
      }
    }
  }
  allX.sort((a, b) => a - b);
  allY.sort((a, b) => a - b);

  const pLow = Math.floor(allX.length * 0.02);
  const pHigh = Math.max(pLow, Math.ceil(allX.length * 0.98) - 1);
  const minX = allX[pLow];
  const maxX = allX[pHigh];
  const minY = allY[pLow];
  const maxY = allY[pHigh];

  const rawSpanX = Math.max(1e-3, maxX - minX);
  const rawSpanY = Math.max(1e-3, maxY - minY);
  const maxRawSpan = Math.max(rawSpanX, rawSpanY);

  // Birim tahmini (mm / cm / m)
  let unitToMeter = 1;
  let unitLabel = 'Metre (m)';
  if (maxRawSpan > 8000) {
    unitToMeter = 0.001;
    unitLabel = 'Milimetre -> Metre (×0.001)';
  } else if (maxRawSpan > 250) {
    unitToMeter = 0.01;
    unitLabel = 'Santimetre -> Metre (×0.01)';
  }

  const widthM = Math.max(24, Math.min(85, Number((rawSpanX * unitToMeter).toFixed(1))));
  const aspect = rawSpanX / rawSpanY;

  // Yüksek çözünürlüklü CAD pafta tuvali çiz
  const canvasW = 1600;
  const canvasH = Math.max(600, Math.min(2200, Math.round(canvasW / aspect)));
  const pad = 70;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FCFBF8';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const drawW = canvasW - pad * 2;
  const drawH = canvasH - pad * 2;

  const mapPt = (x: number, y: number) => ({
    px: pad + ((x - minX) / rawSpanX) * drawW,
    py: canvasH - pad - ((y - minY) / rawSpanY) * drawH,
  });

  // Kapalı bina konturlarını tespit et
  const centerRawX = (minX + maxX) / 2;
  const centerRawY = (minY + maxY) / 2;
  const candidateFootprints: Array<{
    cx: number;
    cz: number;
    w: number;
    d: number;
    area: number;
  }> = [];

  for (const pl of polylines) {
    if (pl.points.length < 2) continue;
    // Uç değer dışındaki çizgileri atla
    if (
      pl.points[0].x < minX - rawSpanX * 0.2 ||
      pl.points[0].x > maxX + rawSpanX * 0.2
    ) {
      continue;
    }

    ctx.beginPath();
    const p0 = mapPt(pl.points[0].x, pl.points[0].y);
    ctx.moveTo(p0.px, p0.py);
    for (let k = 1; k < pl.points.length; k++) {
      const pk = mapPt(pl.points[k].x, pl.points[k].y);
      ctx.lineTo(pk.px, pk.py);
    }
    if (pl.closed) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(200, 90, 23, 0.10)';
      ctx.fill();
    }
    ctx.strokeStyle = pl.closed ? '#181816' : '#57534E';
    ctx.lineWidth = pl.closed ? 2.4 : 1.3;
    ctx.stroke();

    if (pl.closed && pl.points.length >= 3) {
      let bMinX = Infinity,
        bMaxX = -Infinity,
        bMinY = Infinity,
        bMaxY = -Infinity;
      for (const pt of pl.points) {
        if (pt.x < bMinX) bMinX = pt.x;
        if (pt.x > bMaxX) bMaxX = pt.x;
        if (pt.y < bMinY) bMinY = pt.y;
        if (pt.y > bMaxY) bMaxY = pt.y;
      }
      const wM = (bMaxX - bMinX) * unitToMeter;
      const dM = (bMaxY - bMinY) * unitToMeter;
      const area = wM * dM;
      // Bina kütlesi olabilecek makul kapalı konturlar (4m - 55m arası, parsel dış sınırı olmayan)
      if (wM >= 4 && dM >= 4 && wM <= 55 && dM <= 55 && area < widthM * (widthM / aspect) * 0.72) {
        const cx = ((bMinX + bMaxX) / 2 - centerRawX) * unitToMeter;
        const cz = -((bMinY + bMaxY) / 2 - centerRawY) * unitToMeter;
        candidateFootprints.push({ cx, cz, w: wM, d: dM, area });
      }
    }
  }

  candidateFootprints.sort((a, b) => b.area - a.area);
  const extractedDxfBlocks: MassBlock[] = candidateFootprints.slice(0, 6).map((fp, idx) => ({
    id: `dxf_blk_${idx + 1}_${Date.now().toString().slice(-3)}`,
    label: `CAD Kütle #${idx + 1}`,
    role: idx === 0 ? 'primary_living' : 'north_daylight',
    x: Number(Math.max(-30, Math.min(30, fp.cx)).toFixed(1)),
    z: Number(Math.max(-26, Math.min(26, fp.cz)).toFixed(1)),
    width: Number(fp.w.toFixed(1)),
    depth: Number(fp.d.toFixed(1)),
    floors: 3,
    floorHeight: 3.4,
    rotationDeg: 0,
    roofType: 'flat_green',
    roofPitchDeg: 18,
    secondaryPitchDeg: 85,
    overhangSouthM: 0.9,
    sawtoothCount: 3,
    skylightRatio: 0.25,
    ridgeDirection: fp.w >= fp.d ? 'EW' : 'NS',
    hasPvPanels: false,
    glazingStyle: 'punched',
    customWallHex: '#EAE5DA',
    customRoofHex: '#475569',
  }));

  const summary = [
    `AutoCAD DXF çizimi okundu (${polylines.length} vektör çizgi/poligon · Birim: ${unitLabel})`,
  ];
  if (extractedDxfBlocks.length > 0) {
    summary.push(
      `Çizim içinde ${extractedDxfBlocks.length} adet kapalı bina konturu algılandı — tek tıkla 3D binaya yükseltebilirsiniz.`
    );
  }

  return {
    id: `dxf_${Date.now()}`,
    fileName: file.name,
    fileKind: 'dxf',
    dataUrl: canvas.toDataURL('image/png'),
    aspectRatio: canvasW / canvasH,
    widthM,
    offsetX: 0,
    offsetZ: 0,
    rotationDeg: 0,
    opacity: 0.95,
    extractedSummary: summary,
    extractedDxfBlocks,
  };
}

/**
 * 3D Mimari Model Dosyalarını (.GLB, .GLTF, .OBJ, .FBX, .DAE, .STL, .PLY)
 * doğrudan Three.js sahnesine gerçek gölge ve arazi uyumuyla yükler.
 */
async function parse3DArchitecturalFile(file: File, ext: string): Promise<Imported3DModelData> {
  const group = new THREE.Group();
  let formatLabel = ext.toUpperCase();
  let defaultFlipYZ = false;

  if (ext === 'glb' || ext === 'gltf') {
    formatLabel = 'glTF / GLB BIM 3D Modeli';
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const buf = await file.arrayBuffer();
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(buf, '', (res) => resolve(res), (err) => reject(err));
    });
    group.add(gltf.scene);
  } else if (ext === 'obj') {
    formatLabel = 'Wavefront OBJ 3D Modeli (SketchUp / Rhino / Revit)';
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const text = await file.text();
    const parsed = new OBJLoader().parse(text);
    group.add(parsed);
  } else if (ext === 'stl') {
    formatLabel = 'STL 3D Katı Kütle Modeli';
    defaultFlipYZ = true; // CAD STL çıktıları çoğunlukla Z-yukarıdır
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const buf = await file.arrayBuffer();
    const geo = new STLLoader().parse(buf);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xeae5da,
        roughness: 0.78,
        metalness: 0.05,
      })
    );
    group.add(mesh);
  } else if (ext === 'fbx') {
    formatLabel = 'Autodesk FBX 3D Modeli (Revit / 3ds Max)';
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const buf = await file.arrayBuffer();
    const parsed = new FBXLoader().parse(buf, '');
    group.add(parsed);
  } else if (ext === 'dae') {
    formatLabel = 'Collada DAE 3D Modeli (SketchUp / ArchiCAD)';
    const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
    const text = await file.text();
    const parsed = new ColladaLoader().parse(text, '');
    group.add(parsed.scene);
  } else if (ext === 'ply') {
    formatLabel = 'PLY 3D Modeli';
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    const buf = await file.arrayBuffer();
    const geo = new PLYLoader().parse(buf);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xeae5da,
        roughness: 0.78,
      })
    );
    group.add(mesh);
  } else {
    throw new Error(`Desteklenmeyen 3D format: .${ext}`);
  }

  // Tüm alt yüzeylere gölge atma/alma, eksik normal ve mimari maket kenar çizgisi ekle
  const defaultClayMat = new THREE.MeshStandardMaterial({
    color: 0xeae5da,
    roughness: 0.76,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const meshesToOutline: THREE.Mesh[] = [];
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (m.geometry && !m.geometry.attributes.normal) {
        m.geometry.computeVertexNormals();
      }
      if (!m.material || (ext === 'obj' && (m.material as THREE.MeshPhongMaterial).color?.getHex() === 0xffffff)) {
        m.material = defaultClayMat;
      }
      m.castShadow = true;
      m.receiveShadow = true;
      meshesToOutline.push(m);
    }
  });

  // Mimari okunaklılık için keskin köşelere ince kontur çizgisi ekle (aşırı yoğun mesh değilse)
  for (const m of meshesToOutline.slice(0, 40)) {
    const posCount = m.geometry?.attributes?.position?.count ?? 0;
    if (posCount > 0 && posCount < 35000) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry, 28),
        new THREE.LineBasicMaterial({ color: 0x292524 })
      );
      m.add(edges);
    }
  }

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxHoriz = Math.max(size.x, size.y, size.z, 0.001);
  let unitScale = 1;
  if (maxHoriz > 900) {
    unitScale = 0.001; // mm -> m
  } else if (maxHoriz > 130) {
    unitScale = 0.01; // cm -> m
  }

  return {
    id: `m3d_${Date.now()}`,
    fileName: file.name,
    formatLabel,
    group,
    rawSize: {
      x: Number(size.x.toFixed(2)),
      y: Number(size.y.toFixed(2)),
      z: Number(size.z.toFixed(2)),
    },
    unitScale,
    customMultiplier: 1,
    flipYZ: defaultFlipYZ,
    offsetX: 0,
    offsetZ: 0,
    rotationDeg: 0,
    hideGeneratedBlocks: true,
  };
}

/**
 * Görsel kat/vaziyet planlarını (.PNG, .JPG, .WEBP, .SVG) 3D arsa zeminine altlık yapar.
 */
async function parseImagePlanFile(file: File): Promise<PlanUnderlayData> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
    reader.readAsDataURL(file);
  });

  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1000, h: img.naturalHeight || 1000 });
    img.onerror = () => reject(new Error('Plan görseli çözümlenemedi.'));
    img.src = dataUrl;
  });

  return {
    id: `img_${Date.now()}`,
    fileName: file.name,
    fileKind: 'image',
    dataUrl,
    aspectRatio: dims.w / Math.max(1, dims.h),
    widthM: 54,
    offsetX: 0,
    offsetZ: 0,
    rotationDeg: 0,
    opacity: 0.92,
    extractedSummary: [
      `Plan görseli yüklendi (${dims.w}×${dims.h} piksel) — 3D arsa zeminine altlık olarak serildi.`,
      'İsterseniz "Kendi Binanı Kendin Yap" sekmesine geçerek bu planın üzerinden 3D kütlelerinizi çizebilirsiniz.',
    ],
  };
}

/**
 * Mimarın veya öğrencinin sürükleyip bıraktığı herhangi bir proje dosyasını
 * uzantısına göre otomatik tanır ve işler.
 */
export async function importArchitectProjectFile(file: File): Promise<ProjectImportResult> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (ext === 'pdf') {
    const underlay = await renderPdfProjectPage(file, 1);
    return { kind: 'underlay', underlay };
  }

  if (ext === 'dxf') {
    const underlay = await parseDxfProjectFile(file);
    return { kind: 'underlay', underlay };
  }

  if (['glb', 'gltf', 'obj', 'fbx', 'dae', 'stl', 'ply'].includes(ext)) {
    const model = await parse3DArchitecturalFile(file, ext);
    return { kind: 'model3d', model };
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    const underlay = await parseImagePlanFile(file);
    return { kind: 'underlay', underlay };
  }

  if (ext === 'json') {
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    const arr = Array.isArray(parsed) ? parsed : parsed?.blocks;
    if (Array.isArray(arr) && arr.length > 0) {
      return { kind: 'blocks_json', blocks: arr as MassBlock[], fileName: file.name };
    }
    throw new Error('JSON dosyasında geçerli bina kütle verisi bulunamadı.');
  }

  throw new Error(
    `".${ext}" uzantısı desteklenmiyor. Desteklenen formatlar: PDF (.pdf), AutoCAD (.dxf), 3D Model (.glb, .gltf, .obj, .fbx, .dae, .stl, .ply), Plan Görseli (.png, .jpg, .svg) veya Proje (.json).`
  );
}

/**
 * Kullanıcının elinde o an hazır dosya yoksa tek tıkla PDF / DXF / 3D OBJ
 * içe aktarma motorunu canlı test edebilmesi için gerçek örnek mimari dosyalar üretir.
 */
export function createSampleProjectFile(kind: 'pdf' | 'dxf' | 'obj'): File {
  if (kind === 'pdf') {
    const pdfBytes = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 600] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Length 425 >>
stream
0.98 0.97 0.95 rg
20 20 760 560 re f
0.15 0.15 0.14 RG
3 w
55 55 690 490 re S
0.78 0.35 0.09 RG
4 w
130 330 460 140 re S
130 150 150 180 re S
450 160 140 150 re S
BT
/F1 17 Tf
0.12 0.12 0.12 rg
145 395 Td
(MIMARI VAZIYET PAFTASI - Z+3 Kat - Toplam 2650 m2) Tj
0 -28 Td
(Mekanlar: Derslik - Laboratuvar - Spor Salonu - Avlu) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
0000000302 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
779
%%EOF`;
    return new File([pdfBytes], 'ornek_mimari_vaziyet_paftasi.pdf', { type: 'application/pdf' });
  }

  if (kind === 'dxf') {
    const dxfContent = [
      '0', 'SECTION', '2', 'ENTITIES',
      // Parsel Dış Çerçevesi (60x50m)
      '0', 'LWPOLYLINE', '70', '1',
      '10', '-30', '20', '-25',
      '10', '30', '20', '-25',
      '10', '30', '20', '25',
      '10', '-30', '20', '25',
      // Kuzey Ana Blok Konturu
      '0', 'LWPOLYLINE', '70', '1',
      '10', '-18', '20', '4',
      '10', '16', '20', '4',
      '10', '16', '20', '16',
      '10', '-18', '20', '16',
      // Batı Kanat Konturu
      '0', 'LWPOLYLINE', '70', '1',
      '10', '-18', '20', '-14',
      '10', '-6', '20', '-14',
      '10', '-6', '20', '4',
      '10', '-18', '20', '4',
      // Doğu Salon Konturu
      '0', 'LWPOLYLINE', '70', '1',
      '10', '6', '20', '-13',
      '10', '20', '20', '-13',
      '10', '20', '20', '1',
      '10', '6', '20', '1',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    return new File([dxfContent], 'ornek_autocad_kat_plani.dxf', { type: 'text/plain' });
  }

  // L-Planlı + Kademeli Beşik Çatılı Gerçek 3D Wavefront .OBJ Maketi
  const objContent = `# Ornek Mimari 3D Maket (.OBJ)
v -14 0 -10
v  14 0 -10
v  14 0  2
v -14 0  2
v -14 10 -10
v  14 10 -10
v  14 10  2
v -14 10  2
v -14 14.5 -4
v  14 14.5 -4
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
f 5 6 10 9
f 7 8 9 10
f 5 9 8
f 6 7 10
v -14 0  2
v  -3 0  2
v  -3 0  14
v -14 0  14
v -14 7  2
v  -3 7  2
v  -3 7  14
v -14 7  14
f 11 12 16 15
f 12 13 17 16
f 13 14 18 17
f 14 11 15 18
f 15 16 17 18
`;
  return new File([objContent], 'ornek_sketchup_3d_maket.obj', { type: 'text/plain' });
}
