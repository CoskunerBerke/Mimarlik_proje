import * as THREE from 'three';

export interface TerrainSamplerConfig {
  grid3x3M: [number, number, number, number, number, number, number, number, number];
  nativeSlopePct: number;
  effectiveSlopePct: number;
  exaggeration?: number;
}

/**
 * 9 noktalı gerçek Copernicus uydu kot matrisi üzerinden (180m x 180m)
 * her (x, z) noktasındaki gerçek arazi yüksekliğini (merkeze göre metre farkı)
 * çift-karesel (biquadratic Lagrange) yüzey enterpolasyonu ile hesaplar.
 * Koordinat sistemi: +X = Doğu, -X = Batı, -Z = Kuzey, +Z = Güney.
 */
export function sampleTerrainDeltaY(
  x: number,
  z: number,
  cfg: TerrainSamplerConfig
): number {
  const [zNW, zN, zNE, zW, zC, zE, zSW, zS, zSE] = cfg.grid3x3M;

  // Kullanıcı saha plankote eğimi girdiyse eğim genliğini orantılı ölçekle
  const overrideScale =
    cfg.nativeSlopePct > 0.25
      ? cfg.effectiveSlopePct / cfg.nativeSlopePct
      : cfg.effectiveSlopePct > 0.25
      ? cfg.effectiveSlopePct / 2.0
      : 1.0;

  const exag = cfg.exaggeration ?? 1.0;
  const scale = overrideScale * exag;

  // [-90m, +90m] -> [-1, +1] normalize koordinatlar (dışta yumuşak sönümlü uzatma)
  const u = Math.max(-1.35, Math.min(1.35, x / 90));
  const v = Math.max(-1.35, Math.min(1.35, z / 90));

  const Lm1 = (t: number) => 0.5 * t * (t - 1);
  const L0 = (t: number) => 1 - t * t;
  const Lp1 = (t: number) => 0.5 * t * (t + 1);

  const ux = [Lm1(u), L0(u), Lp1(u)];
  const vz = [Lm1(v), L0(v), Lp1(v)];

  // Satırlar: v=-1 (Kuzey), v=0 (Merkez), v=+1 (Güney)
  // Sütunlar: u=-1 (Batı), u=0 (Merkez), u=+1 (Doğu)
  const rel = [
    [zNW - zC, zN - zC, zNE - zC],
    [zW - zC, 0, zE - zC],
    [zSW - zC, zS - zC, zSE - zC],
  ];

  let dh = 0;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      dh += rel[j][i] * ux[i] * vz[j];
    }
  }

  // Çok yüksek dağ yamaçlarında sahne dışına taşmaması için makul görsel sınır (-24m .. +24m)
  return Math.max(-24, Math.min(24, dh * scale));
}

/**
 * 3D Arazi Yüzeyi + 4 Yan Toprak/Kayaç Kesit Duvarı + Eşyükselti Kontur Çizgileri üretir.
 */
export function build3DTerrainCutawayGroup(
  sizeM: number,
  segments: number,
  cfg: TerrainSamplerConfig,
  soilClass: 'ZB' | 'ZC' | 'ZD' | 'ZE'
): THREE.Group {
  const group = new THREE.Group();
  const half = sizeM / 2;

  // Zemin sınıfına göre yeraltı toprak/kayaç katman renkleri
  const subSoilColors: Record<'ZB' | 'ZC' | 'ZD' | 'ZE', { mid: number; deep: number }> = {
    ZB: { mid: 0x8c877e, deep: 0x57534e }, // Sağlam kayaç / kalker-magmatik
    ZC: { mid: 0xa68a6d, deep: 0x6b635b }, // Sıkı marn / kumtaşı / yumuşak kaya
    ZD: { mid: 0xb07d56, deep: 0x7c5e46 }, // Orta sıkı kil-kum tortul
    ZE: { mid: 0x9c7a54, deep: 0x695846 }, // Yumuşak alüvyon / vadi tabanı
  };
  const strata = subSoilColors[soilClass];

  // 1. Üst Topoğrafik Arazi Yüzeyi (Vertex renkli + Gölge alan yüzey)
  const topGeo = new THREE.PlaneGeometry(sizeM, sizeM, segments, segments);
  topGeo.rotateX(-Math.PI / 2);

  const pos = topGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = sampleTerrainDeltaY(vx, vz, cfg);
    pos.setY(i, vy);
    if (vy < minY) minY = vy;
    if (vy > maxY) maxY = vy;
  }
  topGeo.computeVertexNormals();

  const spanY = Math.max(2, maxY - minY);
  const lowCol = new THREE.Color('#D5D0C3');
  const midCol = new THREE.Color('#DFDBD0');
  const highCol = new THREE.Color('#C7C1B2');

  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / spanY;
    const c = t < 0.5 ? lowCol.clone().lerp(midCol, t * 2) : midCol.clone().lerp(highCol, (t - 0.5) * 2);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  topGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const topMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.receiveShadow = true;
  group.add(topMesh);

  // 2. Eşyükselti Kontur Çizgileri / Topoğrafik Izgara Çizgileri
  const gridStep = 15;
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x9c9689,
    transparent: true,
    opacity: 0.45,
  });

  for (let gx = -half; gx <= half; gx += gridStep) {
    const pts: THREE.Vector3[] = [];
    for (let gz = -half; gz <= half; gz += 4) {
      pts.push(new THREE.Vector3(gx, sampleTerrainDeltaY(gx, gz, cfg) + 0.06, gz));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  for (let gz = -half; gz <= half; gz += gridStep) {
    const pts: THREE.Vector3[] = [];
    for (let gx = -half; gx <= half; gx += 4) {
      pts.push(new THREE.Vector3(gx, sampleTerrainDeltaY(gx, gz, cfg) + 0.06, gz));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }

  // 3. Yerin Altındaki 3D Toprak ve Ana Kayaç Kesit Katmanları (4 Yan Etek Duvarı)
  const baseBottomY = minY - 11;
  const rockSplitOffset = 4.5; // Üst zemin kalınlığı ~4.5m, altı ana kayaç katmanı

  const buildSkirtRibbon = (
    sampleEdgePt: (idx: number) => { x: number; z: number },
    yTopFn: (x: number, z: number) => number,
    yBotFn: (x: number, z: number) => number,
    colorHex: number
  ) => {
    const steps = segments;
    const verts: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= steps; s++) {
      const { x, z } = sampleEdgePt(s);
      const yt = yTopFn(x, z);
      const yb = yBotFn(x, z);
      verts.push(x, yt, z);
      verts.push(x, yb, z);
    }
    for (let s = 0; s < steps; s++) {
      const a = s * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
    );
    group.add(m);
  };

  const edges: Array<(s: number) => { x: number; z: number }> = [
    // Güney kenarı (+Z)
    (s) => ({ x: -half + (s / segments) * sizeM, z: half }),
    // Doğu kenarı (+X)
    (s) => ({ x: half, z: half - (s / segments) * sizeM }),
    // Kuzey kenarı (-Z)
    (s) => ({ x: half - (s / segments) * sizeM, z: -half }),
    // Batı kenarı (-X)
    (s) => ({ x: -half, z: -half + (s / segments) * sizeM }),
  ];

  for (const edgeFn of edges) {
    // Üst bitkisel toprak şeridi (0 - 0.8m)
    buildSkirtRibbon(
      edgeFn,
      (x, z) => sampleTerrainDeltaY(x, z, cfg),
      (x, z) => sampleTerrainDeltaY(x, z, cfg) - 0.8,
      0x6b705c
    );
    // Orta zemin katmanı (Alüvyon / Kil-Marn / Sıkı Tortul: 0.8m - 4.8m)
    buildSkirtRibbon(
      edgeFn,
      (x, z) => sampleTerrainDeltaY(x, z, cfg) - 0.8,
      (x, z) => Math.max(baseBottomY + 2.5, sampleTerrainDeltaY(x, z, cfg) - rockSplitOffset),
      strata.mid
    );
    // Derin ana kayaç tabanı
    buildSkirtRibbon(
      edgeFn,
      (x, z) => Math.max(baseBottomY + 2.5, sampleTerrainDeltaY(x, z, cfg) - rockSplitOffset),
      () => baseBottomY,
      strata.deep
    );
  }

  // Alt kapak
  const bottomCap = new THREE.Mesh(
    new THREE.PlaneGeometry(sizeM, sizeM),
    new THREE.MeshBasicMaterial({ color: strata.deep, side: THREE.DoubleSide })
  );
  bottomCap.rotation.x = Math.PI / 2;
  bottomCap.position.y = baseBottomY;
  group.add(bottomCap);

  return group;
}
