import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import {
  CityClimateProfile,
  MassBlock,
  NeighborContextBlock,
  SeasonKey,
  SiteParameters,
  SpaceZoneRole,
} from '../types/architecture';
import {
  calculateSolarPosition,
  generateSunPathArc,
  SolarPosition,
} from '../engine/solarEngine';
import {
  build3DTerrainCutawayGroup,
  sampleTerrainDeltaY,
  TerrainSamplerConfig,
} from '../engine/terrainMeshHelper';
import { Imported3DModelData, PlanUnderlayData } from '../engine/projectFileImporter';
import {
  Compass,
  Eye,
  FileUp,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Sun,
  Wind,
} from 'lucide-react';

interface Viewport3DProps {
  city: CityClimateProfile;
  season: SeasonKey;
  dayOfYear: number;
  solarHour: number;
  onChangeSolarHour: (h: number) => void;
  site: SiteParameters;
  blocks: MassBlock[];
  neighbors: NeighborContextBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  globalOrientationDeg: number;
  courtyardAreaM2: number;
  activeMaterialWallColor: string;
  activeMaterialRoofColor: string;
  exportTrigger: number;
  terrainGrid3x3M?: [number, number, number, number, number, number, number, number, number];
  nativeSlopePct?: number;
  effectiveSlopePct?: number;
  soilClass?: 'ZB' | 'ZC' | 'ZD' | 'ZE';
  planUnderlay?: PlanUnderlayData | null;
  imported3DModel?: Imported3DModelData | null;
  onDropProjectFile?: (file: File) => void;
}

const ROLE_COLORS: Record<SpaceZoneRole, string> = {
  primary_living: '#D97736', // Güney yaşam - sıcak terakota
  north_daylight: '#3B82F6', // Kuzey günışığı stüdyo - gökyüzü mavisi
  social_atrium: '#16A34A', // Sosyal avlu/atrium - biyofilik yeşil
  service_buffer: '#64748B', // Tampon/servis - arduvaz gri
  circulation_core: '#8B5CF6', // Sirkülasyon/çekirdek
};

function createCompassLabelSprite(text: string, bgHex: string, textHex = '#FFFFFF'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.roundRect(12, 12, 232, 72, 8);
  ctx.fill();
  ctx.font = 'bold 34px "JetBrains Mono", monospace';
  ctx.fillStyle = textHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 49);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(9.5, 3.6, 1);
  return sprite;
}

function buildParametricRoofGroup(
  block: MassBlock,
  wallColorHex: string,
  roofColorHex: string
): THREE.Group {
  const roofGroup = new THREE.Group();
  const w = block.width;
  const d = block.depth;
  const baseH = block.floors * block.floorHeight;
  roofGroup.position.y = baseH;

  // Eğer sırt yönü NS ise çatıyı 90 derece çevirip w/d takasla oluştur
  const isNS = block.ridgeDirection === 'NS';
  const spanX = isNS ? d : w;
  const spanZ = isNS ? w : d;

  const innerHolder = new THREE.Group();
  if (isNS) {
    innerHolder.rotation.y = Math.PI / 2;
  }
  roofGroup.add(innerHolder);

  const roofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(roofColorHex),
    roughness: 0.65,
    metalness: 0.15,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(wallColorHex),
    roughness: 0.78,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7DD3FC'),
    emissive: new THREE.Color('#0284C7'),
    emissiveIntensity: 0.18,
    roughness: 0.15,
    metalness: 0.3,
    transparent: true,
    opacity: 0.78,
  });
  const pvMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#172554'),
    roughness: 0.25,
    metalness: 0.65,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4D7C0F'),
    roughness: 0.9,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x1e1e1c,
    transparent: true,
    opacity: 0.35,
  });

  const pitchRad = (Math.max(4, Math.min(50, block.roofPitchDeg)) * Math.PI) / 180;
  const overS = block.overhangSouthM;

  if (block.roofType === 'sawtooth') {
    const count = Math.max(2, Math.min(6, block.sawtoothCount));
    const bayD = spanZ / count;
    const toothH = Math.min(3.6, Math.max(1.1, bayD * Math.tan(pitchRad) * 0.72));

    for (let i = 0; i < count; i++) {
      // -spanZ/2 Kuzey, +spanZ/2 Güney
      const zNorth = -spanZ / 2 + i * bayD;
      const zSouth = zNorth + bayD;

      // 2D profil (X=z ekseni kesiti, Y=yükseklik) -> X yönünde spanX kadar extrude edilir
      const shape = new THREE.Shape();
      const northDropOffset = toothH / Math.tan((Math.max(60, block.secondaryPitchDeg) * Math.PI) / 180);
      shape.moveTo(zSouth, 0);
      shape.lineTo(zNorth + northDropOffset, toothH);
      shape.lineTo(zNorth, 0);
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: spanX,
        bevelEnabled: false,
      });
      // Extrude +Z'ye uzatır; bunu X eksenine çevirelim:
      // shape X -> Z, shape Y -> Y, extrude Z -> X
      extrudeGeo.rotateY(Math.PI / 2);
      // rotateY(+90°): (x_shape, y, z_ext) -> (z_ext, y, -x_shape). Düzeltmek için:
      const posAttr = extrudeGeo.attributes.position;
      for (let k = 0; k < posAttr.count; k++) {
        posAttr.setX(k, posAttr.getX(k) - spanX / 2);
        posAttr.setZ(k, -posAttr.getZ(k));
      }
      extrudeGeo.computeVertexNormals();

      const toothMesh = new THREE.Mesh(extrudeGeo, roofMat);
      toothMesh.castShadow = true;
      toothMesh.receiveShadow = true;
      innerHolder.add(toothMesh);
      innerHolder.add(new THREE.LineSegments(new THREE.EdgesGeometry(extrudeGeo), edgeMat));

      // Kuzey yüzüne dikey/eğimli günışığı cam bandı
      const glassH = toothH * Math.min(0.9, 0.45 + block.skylightRatio * 0.75);
      const glassGeo = new THREE.BoxGeometry(spanX * 0.94, glassH, 0.14);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, glassH * 0.52, zNorth + northDropOffset * 0.5 + 0.05);
      innerHolder.add(glassMesh);

      // Güney eğimli yüzeye BIPV fotovoltaik panel
      if (block.hasPvPanels) {
        const slopeLen = Math.hypot(bayD - northDropOffset, toothH);
        const slopeAngle = Math.atan2(toothH, bayD - northDropOffset);
        const pvGeo = new THREE.BoxGeometry(spanX * 0.88, 0.07, slopeLen * 0.76);
        const pvMesh = new THREE.Mesh(pvGeo, pvMat);
        pvMesh.position.set(
          0,
          toothH * 0.48 + 0.06,
          (zSouth + zNorth + northDropOffset) * 0.5
        );
        pvMesh.rotation.x = slopeAngle;
        innerHolder.add(pvMesh);
      }
    }
  } else if (block.roofType === 'mono_pitch') {
    // Güneyde (+Z) yükselen solar clerestory tek eğimli çatı
    const riseH = Math.min(4.2, Math.max(1.0, spanZ * Math.tan(pitchRad) * 0.48));
    const zN = -spanZ / 2 - 0.35;
    const zS = spanZ / 2;

    // Alt kama gövde
    const shape = new THREE.Shape();
    shape.moveTo(zN, 0);
    shape.lineTo(zS, 0);
    shape.lineTo(zS, riseH);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: spanX, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      pos.setX(k, pos.getX(k) - spanX / 2);
      pos.setZ(k, -pos.getZ(k));
    }
    geo.computeVertexNormals();

    const wedge = new THREE.Mesh(geo, wallMat);
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    innerHolder.add(wedge);
    innerHolder.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));

    // Eğimli üst çatı plağı + Güney saçak çıkması (overS)
    const totalRunZ = zS + overS - zN;
    const slopeAngle = Math.atan2(riseH, zS - zN);
    const slabLen = totalRunZ / Math.cos(slopeAngle);
    const slabGeo = new THREE.BoxGeometry(spanX + 0.6, 0.22, slabLen);
    const slabMesh = new THREE.Mesh(slabGeo, roofMat);
    const midZ = (zN + zS + overS) / 2;
    const midY = (midZ - zN) * Math.tan(slopeAngle) + 0.11;
    slabMesh.position.set(0, midY, midZ);
    slabMesh.rotation.x = -slopeAngle;
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    innerHolder.add(slabMesh);

    // Güney yüksek yüzeye Clerestory pencere bandı
    if (block.skylightRatio > 0.05) {
      const clH = Math.max(0.5, riseH * Math.min(0.85, block.skylightRatio + 0.25));
      const clGeo = new THREE.BoxGeometry(spanX * 0.92, clH, 0.16);
      const clMesh = new THREE.Mesh(clGeo, glassMat);
      clMesh.position.set(0, riseH - clH * 0.55, zS + 0.02);
      innerHolder.add(clMesh);
    }

    if (block.hasPvPanels) {
      const pvGeo = new THREE.BoxGeometry(spanX * 0.85, 0.08, slabLen * 0.72);
      const pvMesh = new THREE.Mesh(pvGeo, pvMat);
      pvMesh.position.set(0, midY + 0.14, midZ - overS * 0.2);
      pvMesh.rotation.x = -slopeAngle;
      innerHolder.add(pvMesh);
    }
  } else if (block.roofType === 'gable' || block.roofType === 'asymmetric_gable') {
    const ridgeZ = block.roofType === 'asymmetric_gable' ? -spanZ * 0.16 : 0;
    const southRun = spanZ / 2 - ridgeZ;
    const riseH = Math.min(4.8, Math.max(1.2, southRun * Math.tan(pitchRad) * 0.8));
    const zN = -spanZ / 2 - 0.45;
    const zS = spanZ / 2 + overS * 0.75;

    const shape = new THREE.Shape();
    shape.moveTo(zN, 0);
    shape.lineTo(zS, 0);
    shape.lineTo(ridgeZ, riseH);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: spanX + 0.5, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      pos.setX(k, pos.getX(k) - (spanX + 0.5) / 2);
      pos.setZ(k, -pos.getZ(k));
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    innerHolder.add(mesh);
    innerHolder.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));

    if (block.hasPvPanels) {
      const sLen = Math.hypot(zS - ridgeZ, riseH);
      const sAng = Math.atan2(riseH, zS - ridgeZ);
      const pvGeo = new THREE.BoxGeometry(spanX * 0.84, 0.08, sLen * 0.74);
      const pvMesh = new THREE.Mesh(pvGeo, pvMat);
      pvMesh.position.set(0, riseH * 0.52 + 0.08, (ridgeZ + zS) / 2);
      pvMesh.rotation.x = sAng;
      innerHolder.add(pvMesh);
    }
  } else if (block.roofType === 'butterfly') {
    const riseH = Math.min(3.4, Math.max(1.0, (spanZ / 2) * Math.tan(pitchRad) * 0.75));
    const zN = -spanZ / 2 - 0.5;
    const zS = spanZ / 2 + overS * 0.75;

    const shape = new THREE.Shape();
    shape.moveTo(zN, 0);
    shape.lineTo(zS, 0);
    shape.lineTo(zS, riseH);
    shape.lineTo(0, 0.32);
    shape.lineTo(zN, riseH * 0.92);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: spanX, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      pos.setX(k, pos.getX(k) - spanX / 2);
      pos.setZ(k, -pos.getZ(k));
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    innerHolder.add(mesh);
    innerHolder.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));

    // Kuzey ve Güney yüksek cephe clerestory bantları
    const clGeo = new THREE.BoxGeometry(spanX * 0.9, riseH * 0.55, 0.18);
    const clSouth = new THREE.Mesh(clGeo, glassMat);
    clSouth.position.set(0, riseH * 0.55, spanZ / 2 + 0.04);
    const clNorth = new THREE.Mesh(clGeo, glassMat);
    clNorth.position.set(0, riseH * 0.5, -spanZ / 2 - 0.04);
    innerHolder.add(clSouth, clNorth);
  } else if (block.roofType === 'louver_canopy') {
    // Biyoklimatik güneş kırıcı pergola / kanopi
    const canopyH = 2.4;
    const frameGeo = new THREE.BoxGeometry(spanX + 0.8, 0.22, spanZ + overS);
    const frameEdges = new THREE.EdgesGeometry(frameGeo);
    const frameLine = new THREE.LineSegments(
      frameEdges,
      new THREE.LineBasicMaterial({ color: 0x27272a })
    );
    frameLine.position.set(0, canopyH, overS * 0.5);
    innerHolder.add(frameLine);

    // Köşe dikmeler
    const postGeo = new THREE.BoxGeometry(0.32, canopyH, 0.32);
    const corners = [
      [-spanX / 2 + 0.3, -spanZ / 2 + 0.3],
      [spanX / 2 - 0.3, -spanZ / 2 + 0.3],
      [-spanX / 2 + 0.3, spanZ / 2 - 0.3],
      [spanX / 2 - 0.3, spanZ / 2 - 0.3],
    ];
    for (const [cx, cz] of corners) {
      const post = new THREE.Mesh(postGeo, roofMat);
      post.position.set(cx, canopyH / 2, cz);
      post.castShadow = true;
      innerHolder.add(post);
    }

    // Açılı güneş kırıcı kanatlar (louvers)
    const bladeCount = Math.max(6, Math.round((spanZ + overS) / 1.15));
    const bladeTilt = (Math.max(10, Math.min(65, block.roofPitchDeg)) * Math.PI) / 180;
    const bladeGeo = new THREE.BoxGeometry(spanX + 0.5, 0.08, 0.65);
    for (let i = 0; i < bladeCount; i++) {
      const bz = -spanZ / 2 + (i / Math.max(1, bladeCount - 1)) * (spanZ + overS);
      const blade = new THREE.Mesh(bladeGeo, roofMat);
      blade.position.set(0, canopyH, bz);
      blade.rotation.x = bladeTilt;
      blade.castShadow = true;
      innerHolder.add(blade);
    }
  } else if (block.roofType === 'dome') {
    // Merkezi Kubbe + Kasnak Pencereleri + Köşe Kubbeleri + Alem (Cami / Külliye / Anıtsal Yapı)
    const leadMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(block.customRoofHex ?? '#4B5563'),
      roughness: 0.48,
      metalness: 0.35,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#B45309'),
      roughness: 0.3,
      metalness: 0.8,
    });

    // Çatı parapeti
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(spanX + 0.4, 0.35, spanZ + 0.4),
      wallMat
    );
    deck.position.y = 0.18;
    deck.castShadow = true;
    deck.receiveShadow = true;
    innerHolder.add(deck);

    const minSpan = Math.min(spanX, spanZ);
    const domeRadius = minSpan * 0.38;
    const drumH = Math.max(1.1, domeRadius * 0.28);

    // Sekizgen/Silindirik Kubbe Kasnağı
    const drumGeo = new THREE.CylinderGeometry(domeRadius * 1.03, domeRadius * 1.06, drumH, 16);
    const drumMesh = new THREE.Mesh(drumGeo, wallMat);
    drumMesh.position.y = 0.35 + drumH / 2;
    drumMesh.castShadow = true;
    innerHolder.add(drumMesh);

    // Kasnak etrafı günışığı pencereleri
    const winRing = new THREE.Mesh(
      new THREE.CylinderGeometry(domeRadius * 1.045, domeRadius * 1.045, drumH * 0.52, 16),
      glassMat
    );
    winRing.position.y = 0.35 + drumH * 0.52;
    innerHolder.add(winRing);

    // Ana Yarım Küre Kurşun Kubbe
    const domeGeo = new THREE.SphereGeometry(
      domeRadius,
      32,
      20,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52
    );
    const domeMesh = new THREE.Mesh(domeGeo, leadMat);
    domeMesh.position.y = 0.35 + drumH - 0.1;
    domeMesh.castShadow = true;
    domeMesh.receiveShadow = true;
    innerHolder.add(domeMesh);

    // Kubbe Alemi
    const alemPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, domeRadius * 0.28, 8),
      bronzeMat
    );
    alemPole.position.y = 0.35 + drumH + domeRadius + domeRadius * 0.12;
    innerHolder.add(alemPole);

    // Geniş harimlerde 4 köşe ağırlık/köşe kubbesi
    if (minSpan >= 11) {
      const cRad = domeRadius * 0.28;
      const offX = spanX * 0.34;
      const offZ = spanZ * 0.34;
      for (const [cx, cz] of [
        [-offX, -offZ],
        [offX, -offZ],
        [-offX, offZ],
        [offX, offZ],
      ]) {
        const subDrum = new THREE.Mesh(
          new THREE.CylinderGeometry(cRad, cRad * 1.05, drumH * 0.55, 12),
          wallMat
        );
        subDrum.position.set(cx, 0.35 + drumH * 0.27, cz);
        const subDome = new THREE.Mesh(
          new THREE.SphereGeometry(cRad, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
          leadMat
        );
        subDome.position.set(cx, 0.35 + drumH * 0.52, cz);
        subDome.castShadow = true;
        innerHolder.add(subDrum, subDome);
      }
    }
  } else if (block.roofType === 'barrel_vault') {
    // Geniş Açıklıklı Tonoz / Kemer Çatı (Spor Salonu, Yüzme Havuzu, Otogar)
    const vaultRadius = spanZ / 2;
    const vaultRise = Math.min(5.2, Math.max(2.0, vaultRadius * 0.42));
    const cylGeo = new THREE.CylinderGeometry(
      vaultRadius,
      vaultRadius,
      spanX + 1.2,
      28,
      1,
      false,
      0,
      Math.PI
    );
    // Cylinder Y eksenindedir; X ekseni boyunca yatıralım ve yüksekliğini vaultRise oranında ölçekleyelim
    cylGeo.rotateZ(Math.PI / 2);
    const pos = cylGeo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const py = pos.getY(k);
      pos.setY(k, Math.max(0, py) * (vaultRise / Math.max(0.5, vaultRadius)));
    }
    cylGeo.computeVertexNormals();

    const vaultMesh = new THREE.Mesh(cylGeo, roofMat);
    vaultMesh.castShadow = true;
    vaultMesh.receiveShadow = true;
    innerHolder.add(vaultMesh);
    innerHolder.add(new THREE.LineSegments(new THREE.EdgesGeometry(cylGeo, 22), edgeMat));

    // Tepe günışığı bandı
    const topSkylight = new THREE.Mesh(
      new THREE.BoxGeometry(spanX * 0.82, 0.22, spanZ * 0.22),
      glassMat
    );
    topSkylight.position.set(0, vaultRise + 0.04, 0);
    innerHolder.add(topSkylight);
  } else if (block.roofType === 'flat_terrace') {
    // Mimari Parapetli Düz Teras Çatı (Taş / Beton Döşeme + Harpuştalı Parapet — Işıklıksız Yalın Görünüm)
    const terraceDeckMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(block.customRoofHex ?? '#D8D2C5'),
      roughness: 0.86,
      metalness: 0.03,
    });
    const copingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#44403C'),
      roughness: 0.65,
    });

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(spanX * 0.96, 0.24, spanZ * 0.96),
      terraceDeckMat
    );
    deck.position.y = 0.12;
    deck.receiveShadow = true;
    innerHolder.add(deck);

    const pThick = 0.32;
    const pH = 0.62;
    const sides: Array<[number, number, number, number]> = [
      [spanX, pThick, 0, -spanZ / 2 + pThick / 2],
      [spanX, pThick, 0, spanZ / 2 - pThick / 2],
      [pThick, spanZ, spanX / 2 - pThick / 2, 0],
      [pThick, spanZ, -spanX / 2 + pThick / 2, 0],
    ];
    for (const [pw, pd, px, pz] of sides) {
      const pWall = new THREE.Mesh(new THREE.BoxGeometry(pw, pH, pd), wallMat);
      pWall.position.set(px, pH / 2, pz);
      pWall.castShadow = true;
      pWall.receiveShadow = true;
      const coping = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.06, 0.08, pd + 0.06), copingMat);
      coping.position.set(px, pH + 0.04, pz);
      innerHolder.add(pWall, coping);
    }

    if (block.hasPvPanels) {
      const pvStand = new THREE.Mesh(
        new THREE.BoxGeometry(spanX * 0.68, 0.08, Math.min(2.4, spanZ * 0.42)),
        pvMat
      );
      pvStand.position.set(0, 0.85, 0);
      pvStand.rotation.x = 0.38;
      innerHolder.add(pvStand);
    }
  } else {
    // flat_green: Ekstansif yeşil çatı + parapet + kuzey tepe ışık fenerleri
    const greenBedGeo = new THREE.BoxGeometry(spanX * 0.94, 0.26, spanZ * 0.94);
    const greenBed = new THREE.Mesh(greenBedGeo, greenMat);
    greenBed.position.y = 0.14;
    greenBed.receiveShadow = true;
    innerHolder.add(greenBed);

    // Parapet çerçevesi
    const pThick = 0.35;
    const pH = 0.65;
    const pNorth = new THREE.Mesh(new THREE.BoxGeometry(spanX, pH, pThick), wallMat);
    pNorth.position.set(0, pH / 2, -spanZ / 2 + pThick / 2);
    const pSouth = new THREE.Mesh(new THREE.BoxGeometry(spanX, pH, pThick), wallMat);
    pSouth.position.set(0, pH / 2, spanZ / 2 - pThick / 2);
    const pEast = new THREE.Mesh(new THREE.BoxGeometry(pThick, pH, spanZ), wallMat);
    pEast.position.set(spanX / 2 - pThick / 2, pH / 2, 0);
    const pWest = new THREE.Mesh(new THREE.BoxGeometry(pThick, pH, spanZ), wallMat);
    pWest.position.set(-spanX / 2 + pThick / 2, pH / 2, 0);
    innerHolder.add(pNorth, pSouth, pEast, pWest);

    // Kuzey ışık fenerleri (monitors)
    if (block.skylightRatio > 0.06) {
      const mCount = Math.max(1, Math.min(4, block.sawtoothCount));
      for (let i = 0; i < mCount; i++) {
        const mz = -spanZ * 0.28 + (i / Math.max(1, mCount - 1 || 1)) * (spanZ * 0.52);
        const monBody = new THREE.Mesh(
          new THREE.BoxGeometry(spanX * 0.55, 1.15, 1.6),
          wallMat
        );
        monBody.position.set(0, 0.7, mz);
        monBody.castShadow = true;
        const monGlass = new THREE.Mesh(
          new THREE.BoxGeometry(spanX * 0.52, 0.85, 0.12),
          glassMat
        );
        monGlass.position.set(0, 0.72, mz - 0.82);
        innerHolder.add(monBody, monGlass);
      }
    }

    if (block.hasPvPanels) {
      const pvStand = new THREE.Mesh(
        new THREE.BoxGeometry(spanX * 0.65, 0.08, 2.2),
        pvMat
      );
      pvStand.position.set(0, 0.95, spanZ * 0.25);
      pvStand.rotation.x = 0.42;
      innerHolder.add(pvStand);
    }
  }

  return roofGroup;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  city,
  season,
  dayOfYear,
  solarHour,
  onChangeSolarHour,
  site,
  blocks,
  neighbors,
  selectedBlockId,
  onSelectBlock,
  globalOrientationDeg,
  courtyardAreaM2,
  activeMaterialWallColor,
  activeMaterialRoofColor,
  exportTrigger,
  terrainGrid3x3M,
  nativeSlopePct = 0,
  effectiveSlopePct = 0,
  soilClass = 'ZC',
  planUnderlay = null,
  imported3DModel = null,
  onDropProjectFile,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const massRootRef = useRef<THREE.Group | null>(null);
  const envOverlayRef = useRef<THREE.Group | null>(null);
  const windParticlesRef = useRef<
    Array<{ mesh: THREE.Mesh; progress: number; speed: number; laneOffset: number }>
  >([]);
  const selectableMeshesRef = useRef<Array<{ mesh: THREE.Object3D; blockId: string }>>([]);

  const [showSunPath, setShowSunPath] = useState(true);
  const [showWindFlow, setShowWindFlow] = useState(true);
  const [colorMode, setColorMode] = useState<'role' | 'material'>('material');
  const [isPlayingDay, setIsPlayingDay] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onSelectBlockRef = useRef(onSelectBlock);
  onSelectBlockRef.current = onSelectBlock;

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const solarPos: SolarPosition = calculateSolarPosition(city.lat, dayOfYear, solarHour);
  const seasonStats = city.seasons[season];

  // Gün animasyonu (Güneş hareketini oynat)
  const hourRef = useRef(solarHour);
  hourRef.current = solarHour;
  useEffect(() => {
    if (!isPlayingDay) return;
    const id = window.setInterval(() => {
      const next = hourRef.current + 0.15;
      onChangeSolarHour(next > 19.2 ? 5.5 : Number(next.toFixed(2)));
    }, 65);
    return () => window.clearInterval(id);
  }, [isPlayingDay, onChangeSolarHour]);

  // 1. Sahne, Kamera ve Renderer Kurulumu
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EAE7DF');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight),
      1,
      900
    );
    camera.position.set(68, 62, 78);
    cameraRef.current = camera;

    const isMobileScreen = window.innerWidth < 640;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileScreen ? 1.5 : 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.touchAction = 'none';
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minDistance = 22;
    controls.maxDistance = 260;
    controls.target.set(0, 6, 0);
    controlsRef.current = controls;

    // Gökyüzü yayılı ışık (HemisphereLight) + Güneş Işığı (DirectionalLight)
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0xd6d3c9, 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.95);
    sunLight.castShadow = true;
    const shadowRes = isMobileScreen ? 1024 : 2048;
    sunLight.shadow.mapSize.width = shadowRes;
    sunLight.shadow.mapSize.height = shadowRes;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 320;
    const dCam = 95;
    sunLight.shadow.camera.left = -dCam;
    sunLight.shadow.camera.right = dCam;
    sunLight.shadow.camera.top = dCam;
    sunLight.shadow.camera.bottom = -dCam;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLightRef.current = sunLight;

    const massRoot = new THREE.Group();
    scene.add(massRoot);
    massRootRef.current = massRoot;

    const envOverlay = new THREE.Group();
    scene.add(envOverlay);
    envOverlayRef.current = envOverlay;

    // Dokunma & Tıklama ile 3D kütle seçimi (Mobil parmak toleranslı Raycaster)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      const maxMove = ev.pointerType === 'touch' ? 16 : 6;
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > maxMove) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const targets = selectableMeshesRef.current.map((s) => s.mesh);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        let hitObj: THREE.Object3D | null = hits[0].object;
        while (hitObj) {
          const found = selectableMeshesRef.current.find((s) => s.mesh === hitObj);
          if (found) {
            onSelectBlockRef.current(found.blockId);
            return;
          }
          hitObj = hitObj.parent;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!containerRef.current) return;
      const w = Math.max(1, containerRef.current.clientWidth);
      const h = Math.max(1, containerRef.current.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(el);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();

      // Mevsimsel rüzgar partikül akışı animasyonu
      const wpList = windParticlesRef.current;
      for (const wp of wpList) {
        wp.progress += wp.speed * 0.0045;
        if (wp.progress > 1) wp.progress -= 1;
        const dist = (wp.progress - 0.5) * 135;
        // Yerel Z ekseni boyunca ilerle, ortadaki kütleye yaklaşınca hafif yanlara sapma (sapma akışı)
        const nearCenter = Math.exp(-(dist * dist) / 900);
        const deflect = Math.sign(wp.laneOffset || 1) * nearCenter * 6.5;
        wp.mesh.position.set(wp.laneOffset + deflect, 2.2 + nearCenter * 3.5, dist);
        const mat = wp.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.sin(wp.progress * Math.PI) * 0.72;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // 2. Arsa, Kütleler, Çatılar ve Komşu Yapıların Güncellenmesi
  useEffect(() => {
    const massRoot = massRootRef.current;
    if (!massRoot) return;

    while (massRoot.children.length > 0) {
      massRoot.remove(massRoot.children[0]);
    }
    selectableMeshesRef.current = [];

    // A) Gerçek 3D Uydu Topoğrafyası, Eşyükselti Konturları ve Yeraltı Toprak Kesiti Bloğu
    const defaultGrid: [number, number, number, number, number, number, number, number, number] = [
      0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const terrainCfg: TerrainSamplerConfig = {
      grid3x3M: terrainGrid3x3M ?? defaultGrid,
      nativeSlopePct,
      effectiveSlopePct,
      exaggeration: 1.0,
    };

    const terrainGroup = build3DTerrainCutawayGroup(180, 40, terrainCfg, soilClass);
    const hasSubterranean = blocks.some(
      (b) => (b.yOffsetM ?? 0) < -0.15 || (b.basementFloors ?? 0) > 0
    );
    if (hasSubterranean) {
      // Zemin altı / bodrum kat varsa üst toprak kabuğunu yarı-saydam X-Ray kesit görünümüne geçir
      const topSurface = terrainGroup.children[0] as THREE.Mesh | undefined;
      if (topSurface && (topSurface.material as THREE.MeshStandardMaterial)?.vertexColors) {
        const mat = topSurface.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = 0.56;
        mat.depthWrite = false;
      }
    }
    massRoot.add(terrainGroup);

    // Arazi eğimine tam oturan Parsel Sınırı ve Çekme Mesafesi Çizgileri
    const sampleRectOnTerrain = (rw: number, rd: number, yLift: number): THREE.Vector3[] => {
      const pts: THREE.Vector3[] = [];
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const x = -rw / 2 + (i / steps) * rw;
        const z = -rd / 2;
        pts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, terrainCfg) + yLift, z));
      }
      for (let i = 0; i <= steps; i++) {
        const x = rw / 2;
        const z = -rd / 2 + (i / steps) * rd;
        pts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, terrainCfg) + yLift, z));
      }
      for (let i = 0; i <= steps; i++) {
        const x = rw / 2 - (i / steps) * rw;
        const z = rd / 2;
        pts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, terrainCfg) + yLift, z));
      }
      for (let i = 0; i <= steps; i++) {
        const x = -rw / 2;
        const z = rd / 2 - (i / steps) * rd;
        pts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, terrainCfg) + yLift, z));
      }
      return pts;
    };

    const borderPts = sampleRectOnTerrain(site.parcelWidthM, site.parcelDepthM, 0.25);
    const borderLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(borderPts),
      new THREE.LineBasicMaterial({ color: 0x161615 })
    );
    massRoot.add(borderLine);

    const sbW = Math.max(6, site.parcelWidthM - site.setbackM * 2);
    const sbD = Math.max(6, site.parcelDepthM - site.setbackM * 2);
    const sbPts = sampleRectOnTerrain(sbW, sbD, 0.28);
    const sbGeo = new THREE.BufferGeometry().setFromPoints(sbPts);
    const sbLine = new THREE.Line(
      sbGeo,
      new THREE.LineDashedMaterial({ color: 0x78716c, dashSize: 1.5, gapSize: 1.0 })
    );
    sbLine.computeLineDistances();
    massRoot.add(sbLine);

    // B) Bina Kütle Grubu (Global Oryantasyon Döndürmeli + Eğimli Zemine Subasman/İstinat Oturtmalı)
    const orientRad = (-globalOrientationDeg * Math.PI) / 180;
    const cosO = Math.cos(orientRad);
    const sinO = Math.sin(orientRad);
    const toWorldXZ = (lx: number, lz: number) => ({
      wx: lx * cosO + lz * sinO,
      wz: -lx * sinO + lz * cosO,
    });

    const orientedBuildingGroup = new THREE.Group();
    orientedBuildingGroup.rotation.y = orientRad;
    massRoot.add(orientedBuildingGroup);

    // A2) Mimarın Yüklediği PDF / AutoCAD DXF / Kat Planı Görseli Altlığı (Eğimli Arazinin Tam Üzerine Serilir)
    if (planUnderlay) {
      const uW = planUnderlay.widthM;
      const uD = uW / Math.max(0.15, planUnderlay.aspectRatio);
      const segs = 32;
      const sheetGeo = new THREE.PlaneGeometry(uW, uD, segs, segs);
      sheetGeo.rotateX(-Math.PI / 2);

      const rotRad = (-planUnderlay.rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);

      const posAttr = sheetGeo.attributes.position;
      for (let vi = 0; vi < posAttr.count; vi++) {
        const lx = posAttr.getX(vi);
        const lz = posAttr.getZ(vi);
        const wx = planUnderlay.offsetX + lx * cosR + lz * sinR;
        const wz = planUnderlay.offsetZ - lx * sinR + lz * cosR;
        const wy = sampleTerrainDeltaY(wx, wz, terrainCfg) + 0.08;
        posAttr.setXYZ(vi, wx, wy, wz);
      }
      sheetGeo.computeVertexNormals();

      const tex = new THREE.TextureLoader().load(planUnderlay.dataUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;

      const sheetMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.92,
        metalness: 0.02,
        transparent: planUnderlay.opacity < 0.99,
        opacity: planUnderlay.opacity,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const sheetMesh = new THREE.Mesh(sheetGeo, sheetMat);
      sheetMesh.receiveShadow = true;
      massRoot.add(sheetMesh);
    }

    // A3) Mimarın Doğrudan Sürükleyip Bıraktığı 3D Model (.OBJ, .GLB, .FBX, .DAE, .STL, .PLY)
    if (imported3DModel) {
      const modelHolder = new THREE.Group();
      const cloned = imported3DModel.group.clone(true);
      if (imported3DModel.flipYZ) {
        cloned.rotation.x = -Math.PI / 2;
      }
      const effScale = Math.max(0.0001, imported3DModel.unitScale * imported3DModel.customMultiplier);
      cloned.scale.setScalar(effScale);
      cloned.rotation.y = (-imported3DModel.rotationDeg * Math.PI) / 180;

      modelHolder.add(cloned);
      modelHolder.updateMatrixWorld(true);

      const bbox = new THREE.Box3().setFromObject(modelHolder);
      const bCenter = new THREE.Vector3();
      const bSize = new THREE.Vector3();
      bbox.getCenter(bCenter);
      bbox.getSize(bSize);

      // Modelin taban köşelerine göre eğimli araziye subasman bazası oluştur
      const hw = Math.max(1, bSize.x / 2);
      const hd = Math.max(1, bSize.z / 2);
      const cPts = [
        [imported3DModel.offsetX - hw, imported3DModel.offsetZ - hd],
        [imported3DModel.offsetX + hw, imported3DModel.offsetZ - hd],
        [imported3DModel.offsetX + hw, imported3DModel.offsetZ + hd],
        [imported3DModel.offsetX - hw, imported3DModel.offsetZ + hd],
      ];
      let minCY = Infinity;
      let maxCY = -Infinity;
      for (const [cx, cz] of cPts) {
        const cy = sampleTerrainDeltaY(cx, cz, terrainCfg);
        if (cy < minCY) minCY = cy;
        if (cy > maxCY) maxCY = cy;
      }

      const targetGroundY = maxCY + 0.15;
      const plinthH = Math.max(0.45, targetGroundY - (minCY - 1.5));
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(bSize.x * 0.96, plinthH, bSize.z * 0.96),
        new THREE.MeshStandardMaterial({ color: 0x8c877e, roughness: 0.9 })
      );
      plinth.position.set(
        imported3DModel.offsetX,
        targetGroundY - plinthH / 2,
        imported3DModel.offsetZ
      );
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      massRoot.add(plinth);

      modelHolder.position.set(
        imported3DModel.offsetX - bCenter.x,
        targetGroundY - bbox.min.y,
        imported3DModel.offsetZ - bCenter.z
      );
      massRoot.add(modelHolder);
    }

    const showProceduralBlocks = !(imported3DModel && imported3DModel.hideGeneratedBlocks);

    // Avlu peyzaj zemini ve mimari ağaçlar
    const hasExplicitSadirvanOrPool = blocks.some(
      (b) => b.specialFeature === 'sadirvan' || b.specialFeature === 'outdoor_pool'
    );
    if (showProceduralBlocks && !planUnderlay && courtyardAreaM2 >= 60) {
      const centerTerrY = sampleTerrainDeltaY(0, 0, terrainCfg);
      const cSize = Math.min(22, Math.sqrt(courtyardAreaM2) * 0.65);
      const lawnGeo = new THREE.BoxGeometry(cSize, 0.7, cSize * 0.85);
      const lawnMat = new THREE.MeshStandardMaterial({
        color: hasExplicitSadirvanOrPool ? 0xdad4c6 : 0x84a96b,
        roughness: 0.92,
      });
      const lawn = new THREE.Mesh(lawnGeo, lawnMat);
      lawn.position.set(0, centerTerrY + 0.04, 0);
      lawn.receiveShadow = true;
      orientedBuildingGroup.add(lawn);
    }

    // Parsel çeperine sade 3D mimari ağaçlar ekle (ölçek algısını güçlendirir)
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 });
    const treeCrownMat = new THREE.MeshStandardMaterial({ color: 0x5c7c47, roughness: 0.85 });
    const treeSpots: Array<[number, number]> = [
      [-site.parcelWidthM * 0.41, site.parcelDepthM * 0.38],
      [site.parcelWidthM * 0.41, site.parcelDepthM * 0.38],
      [-site.parcelWidthM * 0.42, -site.parcelDepthM * 0.38],
      [site.parcelWidthM * 0.42, -site.parcelDepthM * 0.38],
    ];
    for (const [tx, tz] of treeSpots) {
      const ty = sampleTerrainDeltaY(tx, tz, terrainCfg);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 7), treeTrunkMat);
      trunk.position.set(tx, ty + 1.1, tz);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.85, 12, 10), treeCrownMat);
      crown.position.set(tx, ty + 3.4, tz);
      crown.scale.set(1, 1.25, 1);
      crown.castShadow = true;
      massRoot.add(trunk, crown);
    }

    // Her bir 3D Kütle Bloğu, Özel Mimari Elemanlar ve Parametrik Çatısı
    for (const b of showProceduralBlocks ? blocks : []) {
      const halfW = b.width / 2;
      const halfD = b.depth / 2;
      const cornerOffsets = [
        [-halfW, -halfD],
        [halfW, -halfD],
        [halfW, halfD],
        [-halfW, halfD],
      ];
      let minCornerY = Infinity;
      let maxCornerY = -Infinity;
      for (const [ox, oz] of cornerOffsets) {
        const { wx, wz } = toWorldXZ(b.x + ox, b.z + oz);
        const ty = sampleTerrainDeltaY(wx, wz, terrainCfg);
        if (ty < minCornerY) minCornerY = ty;
        if (ty > maxCornerY) maxCornerY = ty;
      }

      const groundFloorY = maxCornerY + 0.2;
      const plinthBottomY = minCornerY - 1.8;
      const plinthH = Math.max(0.5, groundFloorY - plinthBottomY);
      const yOff = b.yOffsetM ?? 0;
      const bsmFloors = Math.max(0, Math.round(b.basementFloors ?? 0));

      const blockGroup = new THREE.Group();
      blockGroup.position.set(b.x, groundFloorY + yOff, b.z);
      blockGroup.rotation.y = (-b.rotationDeg * Math.PI) / 180;

      const totalH = b.floors * b.floorHeight;
      const isSelected = b.id === selectedBlockId;

      const baseColor =
        colorMode === 'role'
          ? ROLE_COLORS[b.role]
          : b.customWallHex ?? activeMaterialWallColor;
      const roofColor =
        colorMode === 'role'
          ? '#334155'
          : b.customRoofHex ?? activeMaterialRoofColor;

      // ÖZEL ELEMAN 0: YARI-AÇIK MİMARİ PERGOLA VERANDA (Duvar kutusu değil, gerçek açık kolonlu pergola!)
      if (b.specialFeature === 'pergola') {
        const timberMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(b.customWallHex ?? '#6B4B2E'),
          roughness: 0.72,
        });
        const patioMat = new THREE.MeshStandardMaterial({
          color: 0xe5dfd3,
          roughness: 0.88,
        });

        // Zemin taş teras plağı
        const patio = new THREE.Mesh(
          new THREE.BoxGeometry(b.width, 0.22, b.depth),
          patioMat
        );
        patio.position.y = 0.11;
        patio.receiveShadow = true;
        blockGroup.add(patio);

        // Köşe ve orta ahşap/çelik dikmeler
        const pH = Math.max(2.6, b.floorHeight);
        const postGeo = new THREE.BoxGeometry(0.22, pH, 0.22);
        const xPosts =
          b.width >= 9
            ? [-b.width / 2 + 0.2, 0, b.width / 2 - 0.2]
            : [-b.width / 2 + 0.2, b.width / 2 - 0.2];
        for (const px of xPosts) {
          for (const pz of [-b.depth / 2 + 0.2, b.depth / 2 - 0.2]) {
            const post = new THREE.Mesh(postGeo, timberMat);
            post.position.set(px, pH / 2, pz);
            post.castShadow = true;
            blockGroup.add(post);
          }
        }

        // Çevre ana kirişler (aşıklar)
        const beamFB = new THREE.BoxGeometry(b.width + 0.3, 0.2, 0.22);
        const bFront = new THREE.Mesh(beamFB, timberMat);
        bFront.position.set(0, pH, b.depth / 2 - 0.2);
        const bBack = bFront.clone();
        bBack.position.z = -b.depth / 2 + 0.2;
        bFront.castShadow = true;
        bBack.castShadow = true;
        blockGroup.add(bFront, bBack);

        // Üst güneş kırıcı pergola mertekleri
        const rafterCount = Math.max(5, Math.round(b.width / 0.75));
        const rafterGeo = new THREE.BoxGeometry(0.1, 0.18, b.depth + 0.45);
        for (let r = 0; r < rafterCount; r++) {
          const rx =
            -b.width / 2 + (r / Math.max(1, rafterCount - 1)) * b.width;
          const rafter = new THREE.Mesh(rafterGeo, timberMat);
          rafter.position.set(rx, pH + 0.14, 0);
          rafter.castShadow = true;
          blockGroup.add(rafter);
        }

        if (isSelected) {
          const selRing = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(b.width + 0.8, 0.2, b.depth + 0.8)),
            new THREE.LineBasicMaterial({ color: 0xc85a17 })
          );
          selRing.position.y = 0.15;
          blockGroup.add(selRing);
        }

        orientedBuildingGroup.add(blockGroup);
        selectableMeshesRef.current.push({ mesh: blockGroup, blockId: b.id });
        continue;
      }

      // ÖZEL ELEMAN 1: GERÇEKÇİ 3D MİNARE
      if (b.specialFeature === 'minaret') {
        const stoneMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(baseColor),
          roughness: 0.75,
        });
        const leadMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(roofColor),
          roughness: 0.45,
          metalness: 0.35,
        });
        const kursuH = Math.min(4.5, totalH * 0.18);
        const shaftH = totalH * 0.62;
        const spireH = totalH * 0.2;
        const rShaft = Math.max(0.75, b.width * 0.34);

        const plinthMesh = new THREE.Mesh(
          new THREE.BoxGeometry(b.width, plinthH + kursuH, b.depth),
          stoneMat
        );
        plinthMesh.position.y = (kursuH - plinthH) / 2;
        plinthMesh.castShadow = true;
        blockGroup.add(plinthMesh);

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(rShaft * 0.86, rShaft, shaftH, 16),
          stoneMat
        );
        shaft.position.y = kursuH + shaftH / 2;
        shaft.castShadow = true;
        blockGroup.add(shaft);

        // Şerefe balkonu (yüksek minarelerde çift şerefe)
        const serefeHeights = totalH >= 28 ? [kursuH + shaftH * 0.62, kursuH + shaftH * 0.92] : [kursuH + shaftH * 0.82];
        for (const sy of serefeHeights) {
          const serefe = new THREE.Mesh(
            new THREE.CylinderGeometry(rShaft * 1.42, rShaft * 1.1, 0.75, 16),
            stoneMat
          );
          serefe.position.y = sy;
          serefe.castShadow = true;
          blockGroup.add(serefe);
        }

        // Külah (konik kurşun külah) + Alem
        const kulah = new THREE.Mesh(
          new THREE.ConeGeometry(rShaft * 0.88, spireH, 16),
          leadMat
        );
        kulah.position.y = kursuH + shaftH + spireH / 2;
        kulah.castShadow = true;
        blockGroup.add(kulah);

        orientedBuildingGroup.add(blockGroup);
        selectableMeshesRef.current.push({ mesh: blockGroup, blockId: b.id });
        continue;
      }

      // ÖZEL ELEMAN 2: MERKEZİ AVLU ŞADIRVANI
      if (b.specialFeature === 'sadirvan') {
        const stoneMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(baseColor),
          roughness: 0.7,
        });
        const waterMat = new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          roughness: 0.15,
          metalness: 0.3,
        });
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(b.width * 0.38, b.width * 0.4, 0.9, 8),
          stoneMat
        );
        basin.position.y = 0.45;
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(b.width * 0.33, b.width * 0.33, 0.94, 8),
          waterMat
        );
        water.position.y = 0.46;
        blockGroup.add(basin, water);

        for (let c = 0; c < 8; c++) {
          const ang = (c / 8) * Math.PI * 2;
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.16, b.floorHeight, 8),
            stoneMat
          );
          col.position.set(
            Math.cos(ang) * b.width * 0.44,
            b.floorHeight / 2,
            Math.sin(ang) * b.depth * 0.44
          );
          col.castShadow = true;
          blockGroup.add(col);
        }

        const roofGrp = buildParametricRoofGroup(b, baseColor, roofColor);
        blockGroup.add(roofGrp);
        orientedBuildingGroup.add(blockGroup);
        selectableMeshesRef.current.push({ mesh: blockGroup, blockId: b.id });
        continue;
      }

      // ÖZEL ELEMAN 3: AÇIK YÜZME HAVUZU & GÜNEŞLENME TERASI
      if (b.specialFeature === 'outdoor_pool') {
        const deckMesh = new THREE.Mesh(
          new THREE.BoxGeometry(b.width + 2.4, plinthH + 0.25, b.depth + 2.4),
          new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.85 })
        );
        deckMesh.position.y = -plinthH / 2 + 0.1;
        deckMesh.receiveShadow = true;
        const waterMesh = new THREE.Mesh(
          new THREE.BoxGeometry(b.width, 0.28, b.depth),
          new THREE.MeshStandardMaterial({
            color: 0x0ea5e9,
            roughness: 0.12,
            metalness: 0.35,
          })
        );
        waterMesh.position.y = 0.16;
        blockGroup.add(deckMesh, waterMesh);
        orientedBuildingGroup.add(blockGroup);
        selectableMeshesRef.current.push({ mesh: blockGroup, blockId: b.id });
        continue;
      }

      // Dikey Y Kotu (+Y Havada Pilotis / 0m Subasman / -Y Zemin Altı Kuranglez) ve Bodrum Katları
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x8c877e,
        roughness: 0.9,
      });

      if (bsmFloors > 0) {
        const bsmH = bsmFloors * b.floorHeight;
        const bsmGeo = new THREE.BoxGeometry(b.width + 0.16, bsmH, b.depth + 0.16);
        const bsmMat = new THREE.MeshStandardMaterial({
          color: 0x9b9589,
          roughness: 0.88,
        });
        const bsmMesh = new THREE.Mesh(bsmGeo, bsmMat);
        bsmMesh.position.y = -bsmH / 2;
        blockGroup.add(bsmMesh);

        const bsmEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(bsmGeo),
          new THREE.LineBasicMaterial({ color: 0xc85a17 })
        );
        bsmEdges.position.y = -bsmH / 2;
        blockGroup.add(bsmEdges);

        // Bodrum kat ara döşeme çizgileri ve kuranglez pencereleri
        const bsmWinMat = new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          roughness: 0.2,
          metalness: 0.4,
        });
        for (let bf = 1; bf <= bsmFloors; bf++) {
          const by = -bf * b.floorHeight;
          const bBand = new THREE.Mesh(
            new THREE.BoxGeometry(b.width + 0.26, 0.14, b.depth + 0.26),
            plinthMat
          );
          bBand.position.y = by;
          blockGroup.add(bBand);

          const kw = new THREE.Mesh(
            new THREE.BoxGeometry(b.width * 0.65, 0.55, 0.12),
            bsmWinMat
          );
          kw.position.set(0, by + b.floorHeight * 0.72, b.depth / 2 + 0.09);
          blockGroup.add(kw);
        }
      } else if (yOff > 0.35) {
        // +Y yukarı kaldırılmış kütle: Zemin kotuna inen taşıyıcı pilotis kolonları
        const colH = yOff + 0.4;
        const colGeo = new THREE.CylinderGeometry(0.28, 0.32, colH, 10);
        for (const [cx, cz] of [
          [-b.width * 0.4, -b.depth * 0.38],
          [b.width * 0.4, -b.depth * 0.38],
          [-b.width * 0.4, b.depth * 0.38],
          [b.width * 0.4, b.depth * 0.38],
        ]) {
          const pCol = new THREE.Mesh(colGeo, plinthMat);
          pCol.position.set(cx, -yOff + colH / 2 - 0.2, cz);
          pCol.castShadow = true;
          blockGroup.add(pCol);
        }
      } else if (yOff < -0.15) {
        // -Y zemin altına çekilmiş gömülü kütle: Zemin yüzeyinde istinat/kuranglez kesit çerçevesi
        const collarGeo = new THREE.BoxGeometry(b.width + 1.2, 0.35, b.depth + 1.2);
        const collarEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(collarGeo),
          new THREE.LineBasicMaterial({ color: 0x181816 })
        );
        collarEdges.position.y = -yOff;
        blockGroup.add(collarEdges);
      } else {
        // Standart zemin oturtması: Eğimli araziye gömülen subasman & istinat bazası
        const plinthGeo = new THREE.BoxGeometry(b.width + 0.3, plinthH, b.depth + 0.3);
        const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
        plinthMesh.position.y = -plinthH / 2;
        plinthMesh.castShadow = true;
        plinthMesh.receiveShadow = true;
        blockGroup.add(plinthMesh);
      }

      const bodyGeo = new THREE.BoxGeometry(b.width, totalH, b.depth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness: 0.78,
        metalness: 0.04,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = totalH / 2;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      blockGroup.add(bodyMesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(bodyGeo),
        new THREE.LineBasicMaterial({
          color: isSelected ? 0xc85a17 : 0x292524,
        })
      );
      edges.position.y = totalH / 2;
      blockGroup.add(edges);

      // Kat Döşeme Silmeleri, Gerçekçi Çerçeveli Pencereler, Balkonlar, Revaklar ve Giriş Saçağı
      const slabMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cb, roughness: 0.7 });
      const mullionMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 });
      const winGlassMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.14,
        metalness: 0.45,
        transparent: true,
        opacity: 0.78,
      });
      const shadeMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.6 });

      for (let f = 0; f < b.floors; f++) {
        const yFloor = f * b.floorHeight;
        if (f > 0) {
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(b.width + 0.18, 0.16, b.depth + 0.18),
            slabMat
          );
          band.position.y = yFloor;
          blockGroup.add(band);
        }

        // Cephe Pencere Düzeni (Bina Tipine Özel Gerçekçi Ritim)
        if (b.glazingStyle === 'curtain_wall') {
          const cwH = b.floorHeight * 0.76;
          const cwY = yFloor + b.floorHeight * 0.5;
          const sGlass = new THREE.Mesh(
            new THREE.BoxGeometry(b.width * 0.92, cwH, 0.08),
            winGlassMat
          );
          sGlass.position.set(0, cwY, b.depth / 2 + 0.03);
          const nGlass = sGlass.clone();
          nGlass.position.set(0, cwY, -b.depth / 2 - 0.03);
          blockGroup.add(sGlass, nGlass);

          // Düşey giydirme cephe kayıtları (mullions)
          const mCount = Math.max(3, Math.round(b.width / 2.4));
          for (let m = 0; m <= mCount; m++) {
            const mx = -b.width * 0.46 + (m / mCount) * (b.width * 0.92);
            const mul = new THREE.Mesh(new THREE.BoxGeometry(0.08, cwH, 0.14), mullionMat);
            mul.position.set(mx, cwY, b.depth / 2 + 0.04);
            blockGroup.add(mul);
          }
        } else if (b.glazingStyle === 'arched_classic') {
          if (f === 0) {
            // Cami / Anıtsal Taş Cephe: 4 cephede alt ve üst sıra kemerli pencere ritmi
            const bays = Math.max(2, Math.round(b.width / 4.2));
            for (let k = 0; k < bays; k++) {
              const wx = -b.width * 0.36 + (bays === 1 ? 0 : (k / (bays - 1)) * (b.width * 0.72));
              const lowH = Math.min(2.8, totalH * 0.28);
              const lowW = new THREE.Mesh(new THREE.BoxGeometry(1.3, lowH, 0.12), winGlassMat);
              lowW.position.set(wx, lowH * 0.6 + 0.8, b.depth / 2 + 0.03);
              const lowWN = lowW.clone();
              lowWN.position.z = -b.depth / 2 - 0.03;
              blockGroup.add(lowW, lowWN);

              // Doğu ve Batı cephe pencereleri
              const sideW = new THREE.Mesh(new THREE.BoxGeometry(0.12, lowH, 1.3), winGlassMat);
              sideW.position.set(b.width / 2 + 0.03, lowH * 0.6 + 0.8, wx * (b.depth / b.width));
              const sideWW = sideW.clone();
              sideWW.position.x = -b.width / 2 - 0.03;
              blockGroup.add(sideW, sideWW);

              if (totalH >= 7.5) {
                const upW = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.12), winGlassMat);
                upW.position.set(wx, totalH * 0.7, b.depth / 2 + 0.03);
                const upWN = upW.clone();
                upWN.position.z = -b.depth / 2 - 0.03;
                blockGroup.add(upW, upWN);
              }
            }
          }
        } else if (b.glazingStyle === 'minimal_hall') {
          if (f === 0) {
            // Spor / Fabrika / Oditoryum üst günışığı şeridi
            const ribH = Math.min(1.6, totalH * 0.22);
            const rib = new THREE.Mesh(
              new THREE.BoxGeometry(b.width * 0.88, ribH, 0.1),
              winGlassMat
            );
            rib.position.set(0, totalH - ribH * 0.9, b.depth / 2 + 0.03);
            const ribN = rib.clone();
            ribN.position.z = -b.depth / 2 - 0.03;
            blockGroup.add(rib, ribN);
          }
        } else {
          // Gerçekçi Konut / Okul / Hastane Modüler Çerçeveli Pencere Dizisi
          const bayCount = Math.max(2, Math.round(b.width / 3.6));
          const winW = Math.min(1.8, (b.width / bayCount) * 0.58);
          const winH = b.floorHeight * 0.48;
          const winY = yFloor + b.floorHeight * 0.55;

          for (let k = 0; k < bayCount; k++) {
            const wx =
              -b.width * 0.4 +
              (bayCount === 1 ? 0 : (k / (bayCount - 1)) * (b.width * 0.8));
            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(winW + 0.14, winH + 0.14, 0.08),
              mullionMat
            );
            frame.position.set(wx, winY, b.depth / 2 + 0.02);
            const pane = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.1), winGlassMat);
            pane.position.set(wx, winY, b.depth / 2 + 0.03);

            const paneN = pane.clone();
            paneN.position.z = -b.depth / 2 - 0.03;
            blockGroup.add(frame, pane, paneN);
          }

          // Güney cephe güneş kırıcı saçak
          if (b.overhangSouthM > 0.25 && b.specialFeature !== 'balconies') {
            const briseDepth = Math.min(1.2, b.overhangSouthM * 0.55);
            const brise = new THREE.Mesh(
              new THREE.BoxGeometry(b.width * 0.9, 0.09, briseDepth),
              shadeMat
            );
            brise.position.set(0, winY + winH / 2 + 0.08, b.depth / 2 + briseDepth / 2);
            brise.castShadow = true;
            blockGroup.add(brise);
          }
        }

        // ÖZEL ELEMAN 4: KONUT / OTEL / VİLLA ÇIKMA BALKONLAR (1. kattan itibaren)
        if (b.specialFeature === 'balconies' && f >= 1) {
          const balcCount = Math.max(2, Math.round(b.width / 6.5));
          const balcW = Math.min(3.8, (b.width / balcCount) * 0.65);
          const balcD = 1.45;
          for (let k = 0; k < balcCount; k++) {
            const bx =
              -b.width * 0.34 +
              (balcCount === 1 ? 0 : (k / (balcCount - 1)) * (b.width * 0.68));
            const slabB = new THREE.Mesh(
              new THREE.BoxGeometry(balcW, 0.16, balcD),
              slabMat
            );
            slabB.position.set(bx, yFloor + 0.08, b.depth / 2 + balcD / 2);
            slabB.castShadow = true;

            const railB = new THREE.Mesh(
              new THREE.BoxGeometry(balcW, 0.95, 0.06),
              winGlassMat
            );
            railB.position.set(bx, yFloor + 0.62, b.depth / 2 + balcD - 0.05);
            blockGroup.add(slabB, railB);
          }
        }
      }

      // ÖZEL ELEMAN 5: ZEMİN KAT REVAK / KEMERLİ KOLONAD (Cami Avlusu, Çarşı)
      if (b.specialFeature === 'arcade') {
        const colCount = Math.max(3, Math.round(Math.max(b.width, b.depth) / 3.8));
        const colMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.8 });
        const alongX = b.width >= b.depth;
        for (let c = 0; c < colCount; c++) {
          const t = colCount === 1 ? 0 : -0.44 + (c / (colCount - 1)) * 0.88;
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.22, b.floorHeight * 0.95, 10),
            colMat
          );
          if (alongX) {
            col.position.set(b.width * t, b.floorHeight * 0.48, b.depth / 2 + 0.55);
          } else {
            col.position.set(
              b.x >= 0 ? -b.width / 2 - 0.55 : b.width / 2 + 0.55,
              b.floorHeight * 0.48,
              b.depth * t
            );
          }
          col.castShadow = true;
          blockGroup.add(col);
        }
      }

      // ÖZEL ELEMAN 6: GİRİŞ KANOPİSİ / SAÇAĞI (Hastane Acil, Okul, Otel Girişi)
      if (b.specialFeature === 'entrance_canopy') {
        const canW = Math.min(8.5, b.width * 0.45);
        const canD = 3.2;
        const canY = Math.min(3.6, b.floorHeight * 0.92);
        const canSlab = new THREE.Mesh(
          new THREE.BoxGeometry(canW, 0.22, canD),
          shadeMat
        );
        canSlab.position.set(0, canY, b.depth / 2 + canD / 2);
        canSlab.castShadow = true;
        const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, canY, 8), shadeMat);
        pL.position.set(-canW * 0.42, canY / 2, b.depth / 2 + canD - 0.3);
        const pR = pL.clone();
        pR.position.x = canW * 0.42;
        blockGroup.add(canSlab, pL, pR);
      }

      // Seçili kütle taban vurgusu
      if (isSelected) {
        const selRingGeo = new THREE.BoxGeometry(b.width + 1.4, 0.22, b.depth + 1.4);
        const selRing = new THREE.LineSegments(
          new THREE.EdgesGeometry(selRingGeo),
          new THREE.LineBasicMaterial({ color: 0xc85a17 })
        );
        selRing.position.y = 0.15;
        blockGroup.add(selRing);
      }

      // Parametrik 3D Çatı Ekle
      const roofGrp = buildParametricRoofGroup(b, baseColor, roofColor);
      blockGroup.add(roofGrp);

      orientedBuildingGroup.add(blockGroup);
      selectableMeshesRef.current.push({ mesh: blockGroup, blockId: b.id });
    }

    // C) Çevre Komşu Yapılar (Gölgeleme ve Rüzgar Perdeleme Analizi için)
    const neighborMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3cb,
      roughness: 0.9,
      transparent: true,
      opacity: 0.82,
    });
    const neighborEdge = new THREE.LineBasicMaterial({ color: 0xa8a29e });

    for (const nb of neighbors) {
      if (!nb.enabled) continue;
      const g = new THREE.BoxGeometry(nb.widthM, nb.heightM, nb.depthM);
      const m = new THREE.Mesh(g, neighborMat);
      m.castShadow = true;
      m.receiveShadow = true;

      let nx = 0;
      let nz = 0;
      if (nb.direction === 'Kuzey') {
        nz = -(site.parcelDepthM / 2 + nb.distanceM + nb.depthM / 2);
      } else if (nb.direction === 'Güney') {
        nz = site.parcelDepthM / 2 + nb.distanceM + nb.depthM / 2;
      } else if (nb.direction === 'Doğu') {
        nx = site.parcelWidthM / 2 + nb.distanceM + nb.widthM / 2;
      } else {
        nx = -(site.parcelWidthM / 2 + nb.distanceM + nb.widthM / 2);
      }

      const nbTerrY = sampleTerrainDeltaY(nx, nz, terrainCfg);
      m.position.set(nx, nbTerrY + nb.heightM / 2, nz);
      massRoot.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), neighborEdge);
      e.position.copy(m.position);
      massRoot.add(e);
    }
  }, [
    blocks,
    neighbors,
    site,
    selectedBlockId,
    globalOrientationDeg,
    courtyardAreaM2,
    colorMode,
    activeMaterialWallColor,
    activeMaterialRoofColor,
    terrainGrid3x3M,
    nativeSlopePct,
    effectiveSlopePct,
    soilClass,
    planUnderlay,
    imported3DModel,
  ]);

  // 3. Güneş Yörüngesi Kubbesi, Anlık Güneş Işığı Gölgesi ve Mevsimsel Rüzgar Akışı
  useEffect(() => {
    const envOverlay = envOverlayRef.current;
    const sunLight = sunLightRef.current;
    if (!envOverlay || !sunLight) return;

    while (envOverlay.children.length > 0) {
      envOverlay.remove(envOverlay.children[0]);
    }
    windParticlesRef.current = [];

    const domeRadius = Math.max(58, Math.max(site.parcelWidthM, site.parcelDepthM) * 0.92);

    // Güneş Işığı Konumu & Gölge Güncelleme
    if (solarPos.isDaylight) {
      sunLight.intensity = Math.min(2.2, 0.75 + solarPos.sunVector.y * 1.65);
      sunLight.position.set(
        solarPos.sunVector.x * domeRadius * 1.4,
        Math.max(6, solarPos.sunVector.y * domeRadius * 1.4),
        solarPos.sunVector.z * domeRadius * 1.4
      );
    } else {
      sunLight.intensity = 0.08;
      sunLight.position.set(0, 40, 0);
    }

    // Pusula Çemberi ve K / G / D / B Yön Etiketleri
    const compassCirclePts: THREE.Vector3[] = [];
    for (let a = 0; a <= 360; a += 4) {
      const r = (a * Math.PI) / 180;
      compassCirclePts.push(
        new THREE.Vector3(Math.sin(r) * domeRadius, 0.12, -Math.cos(r) * domeRadius)
      );
    }
    envOverlay.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(compassCirclePts),
        new THREE.LineBasicMaterial({ color: 0xa8a29e })
      )
    );

    const lblN = createCompassLabelSprite('KUZEY (0°)', '#161615');
    lblN.position.set(0, 2.2, -domeRadius - 4);
    const lblS = createCompassLabelSprite('GÜNEY (180°)', '#C85A17');
    lblS.position.set(0, 2.2, domeRadius + 4);
    const lblE = createCompassLabelSprite('DOĞU (90°)', '#57534E');
    lblE.position.set(domeRadius + 5, 2.2, 0);
    const lblW = createCompassLabelSprite('BATI (270°)', '#57534E');
    lblW.position.set(-domeRadius - 5, 2.2, 0);
    envOverlay.add(lblN, lblS, lblE, lblW);

    // Güneş Yörüngesi Yayları (21 Haziran, 21 Mart/Eylül, 21 Aralık)
    if (showSunPath) {
      const arcs = [
        { doy: 172, color: 0xd97706, opacity: 0.9 }, // Yaz gündönümü
        { doy: 80, color: 0xb45309, opacity: 0.55 }, // Ekinoks
        { doy: 355, color: 0x0284c7, opacity: 0.85 }, // Kış gündönümü
      ];

      for (const arcCfg of arcs) {
        const pts = generateSunPathArc(city.lat, arcCfg.doy, domeRadius);
        if (pts.length > 1) {
          const vecs = pts.map((p) => new THREE.Vector3(p.x, p.y, p.z));
          const arcLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(vecs),
            new THREE.LineBasicMaterial({
              color: arcCfg.color,
              transparent: true,
              opacity: arcCfg.opacity,
            })
          );
          envOverlay.add(arcLine);
        }
      }

      // Seçili günün aktif güneş yörüngesi
      const activeArcPts = generateSunPathArc(city.lat, dayOfYear, domeRadius);
      if (activeArcPts.length > 1) {
        const activeVecs = activeArcPts.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        envOverlay.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(activeVecs),
            new THREE.LineBasicMaterial({ color: 0xea580c })
          )
        );
      }

      // Aktif Güneş Küresi + Güneş Işını Vektörü
      if (solarPos.isDaylight) {
        const sx = solarPos.sunVector.x * domeRadius;
        const sy = solarPos.sunVector.y * domeRadius;
        const sz = solarPos.sunVector.z * domeRadius;

        const sunSphere = new THREE.Mesh(
          new THREE.SphereGeometry(2.3, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b })
        );
        sunSphere.position.set(sx, sy, sz);
        envOverlay.add(sunSphere);

        const sunHalo = new THREE.Mesh(
          new THREE.SphereGeometry(3.8, 20, 20),
          new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.3,
          })
        );
        sunHalo.position.set(sx, sy, sz);
        envOverlay.add(sunHalo);

        const rayPts = [new THREE.Vector3(sx, sy, sz), new THREE.Vector3(0, 2, 0)];
        const rayLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(rayPts),
          new THREE.LineDashedMaterial({ color: 0xd97706, dashSize: 2, gapSize: 1.5 })
        );
        rayLine.computeLineDistances();
        envOverlay.add(rayLine);
      }
    }

    // Mevsimsel Rüzgar Akış Vektörleri (Hakim rüzgar yönünden arsaya giriş)
    if (showWindFlow) {
      const windGroup = new THREE.Group();
      // windDirectionDeg: Rüzgarın GELDİĞİ azimut (0 = Kuzey/-Z -> +Z'ye doğru eser)
      // Yerel akışta parçacıklar -Z'den +Z'ye ilerler; dolayısıyla rotation.y = -windDirectionDeg
      windGroup.rotation.y = (-seasonStats.windDirectionDeg * Math.PI) / 180;
      envOverlay.add(windGroup);

      const streamMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.55,
      });

      const lanes = [-26, -18, -10, -3, 4, 11, 19, 27];
      for (const lane of lanes) {
        // Sabit akış izi çizgisi
        const curvePts: THREE.Vector3[] = [];
        for (let t = -62; t <= 62; t += 4) {
          const near = Math.exp(-(t * t) / 900);
          const defl = Math.sign(lane || 1) * near * 6.5;
          curvePts.push(new THREE.Vector3(lane + defl, 1.4, t));
        }
        const traceLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curvePts),
          new THREE.LineBasicMaterial({
            color: 0x0ea5e9,
            transparent: true,
            opacity: 0.25,
          })
        );
        windGroup.add(traceLine);

        // Hareketli rüzgar ok/kapsül parçacıkları
        for (let p = 0; p < 3; p++) {
          const pill = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.22, 3.6),
            streamMat.clone()
          );
          windGroup.add(pill);
          windParticlesRef.current.push({
            mesh: pill,
            progress: (p / 3 + Math.abs(lane) * 0.013) % 1,
            speed: Math.max(0.45, seasonStats.windSpeedMs * 0.24),
            laneOffset: lane,
          });
        }
      }
    }
  }, [
    city.lat,
    dayOfYear,
    solarHour,
    season,
    showSunPath,
    showWindFlow,
    site.parcelWidthM,
    site.parcelDepthM,
    solarPos.isDaylight,
    solarPos.sunVector.x,
    solarPos.sunVector.y,
    solarPos.sunVector.z,
    seasonStats.windDirectionDeg,
    seasonStats.windSpeedMs,
  ]);

  // 4. 3D OBJ Dışa Aktarma (Rhino / SketchUp / Blender / Revit uyumlu)
  useEffect(() => {
    if (exportTrigger === 0 || !massRootRef.current) return;
    const exporter = new OBJExporter();
    const objText = exporter.parse(massRootRef.current);
    const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iklimform_${city.id}_3d_kutle.obj`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportTrigger, city.id]);

  const setCameraPreset = (preset: 'iso' | 'top' | 'south' | 'east') => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    ctrl.target.set(0, 5, 0);
    if (preset === 'iso') cam.position.set(68, 60, 76);
    else if (preset === 'top') cam.position.set(0, 125, 0.1);
    else if (preset === 'south') cam.position.set(0, 18, 98);
    else if (preset === 'east') cam.position.set(98, 22, 0);
    ctrl.update();
  };

  const isFlatSite = effectiveSlopePct < 2.5;

  return (
    <div
      className={`w-full flex flex-col bg-white border border-stone-300 overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50 h-[100dvh] border-0' : ''
      }`}
    >
      {/* Üst Kontrol Çubuğu (Mobil, Tablet ve Masaüstü Uyumlu — Asla Üst Üste Binmez) */}
      <div className="px-2.5 sm:px-3 py-2 bg-[#FAF9F6] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlayingDay((p) => !p)}
            className={`px-2.5 py-1.5 font-semibold border transition flex items-center gap-1 whitespace-nowrap ${
              isPlayingDay
                ? 'bg-amber-600 text-white border-amber-700'
                : 'bg-[#161615] text-white border-[#161615] hover:bg-stone-800'
            }`}
          >
            {isPlayingDay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlayingDay ? 'Durdur' : 'Güneşi Oynat'}
          </button>

          <button
            type="button"
            onClick={() => setShowSunPath((v) => !v)}
            className={`px-2.5 py-1.5 font-medium border transition flex items-center gap-1 whitespace-nowrap ${
              showSunPath
                ? 'bg-white text-[#161615] border-stone-400 font-semibold'
                : 'bg-stone-100 text-stone-500 border-stone-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            Güneş
          </button>

          <button
            type="button"
            onClick={() => setShowWindFlow((v) => !v)}
            className={`px-2.5 py-1.5 font-medium border transition flex items-center gap-1 whitespace-nowrap ${
              showWindFlow
                ? 'bg-white text-[#161615] border-stone-400 font-semibold'
                : 'bg-stone-100 text-stone-500 border-stone-300'
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-sky-600" />
            Rüzgar
          </button>

          <button
            type="button"
            onClick={() => setColorMode((m) => (m === 'role' ? 'material' : 'role'))}
            className="px-2.5 py-1.5 font-medium bg-white text-[#161615] border border-stone-300 hover:bg-stone-50 transition flex items-center gap-1 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="sm:hidden">
              {colorMode === 'material' ? 'Gerçekçi' : 'Zon Rengi'}
            </span>
            <span className="hidden sm:inline">
              {colorMode === 'material' ? 'Görünüm: Gerçekçi Mimari' : 'Görünüm: Zon Diyagramı'}
            </span>
          </button>
        </div>

        <div className="flex items-center bg-white border border-stone-300 divide-x divide-stone-200">
          <button
            type="button"
            onClick={() => setCameraPreset('iso')}
            className="px-2.5 py-1.5 hover:bg-stone-100 font-medium flex items-center gap-1 whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" /> 3D Açı
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('top')}
            className="px-2.5 py-1.5 hover:bg-stone-100 font-medium whitespace-nowrap"
          >
            Üst Plan
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('south')}
            className="px-2.5 py-1.5 hover:bg-stone-100 font-medium whitespace-nowrap"
          >
            Güney
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="px-2.5 py-1.5 bg-[#FAF9F6] hover:bg-stone-200 font-semibold flex items-center gap-1 whitespace-nowrap text-[#181816]"
            title={isFullscreen ? 'Tam ekrandan çık' : '3D sahneyi tam ekran aç'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#C85A17]" /> Küçült
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#C85A17]" /> Tam Ekran
              </>
            )}
          </button>
        </div>
      </div>

      {/* Three.js 3D Tuval + Doğrudan Proje Dosyası Sürükle-Bırak Desteği */}
      <div
        className={`relative w-full ${isFullscreen ? 'flex-1 min-h-0' : ''}`}
        onDragOver={(e) => {
          if (!onDropProjectFile) return;
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e) => {
          if (!onDropProjectFile) return;
          e.preventDefault();
          setIsDraggingFile(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onDropProjectFile(f);
        }}
      >
        <div
          ref={containerRef}
          className={`w-full cursor-grab active:cursor-grabbing bg-[#EAE7DF] ${
            isFullscreen ? 'h-full min-h-[280px]' : 'h-[330px] sm:h-[430px]'
          }`}
        />

        {isDraggingFile && (
          <div className="pointer-events-none absolute inset-0 bg-[#181816]/80 border-4 border-dashed border-[#C85A17] flex flex-col items-center justify-center text-white p-6 text-center z-20">
            <FileUp className="w-10 h-10 text-[#C85A17] mb-2" />
            <div className="text-base font-bold">
              Proje Dosyanızı Doğrudan 3D Araziye Bırakın
            </div>
            <div className="text-xs text-stone-300 mt-1">
              PDF Pafta (.pdf) · AutoCAD (.dxf) · 3D Model (.obj, .glb, .gltf, .fbx, .dae, .stl) · Kat Planı Görseli (.png, .jpg, .svg)
            </div>
          </div>
        )}
      </div>

      {/* Alt Bilgi ve Renk Anlamları Çubuğu (Tuvalin Altında — Sıfır Çakışma) */}
      <div className="px-3 sm:px-3.5 py-2.5 bg-[#FAF9F6] border-t border-stone-200 space-y-2 text-xs safe-bottom-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-[#161615]">
            <Compass className="w-4 h-4 text-[#C85A17] shrink-0" />
            <span>
              {city.name} ·{' '}
              <strong className={isFlatSite ? 'text-[#15803D]' : 'text-[#C85A17]'}>
                {isFlatSite
                  ? `Düz Arazi (%${effectiveSlopePct} Eğim)`
                  : `Eğimli Arazi (%${effectiveSlopePct} Eğim — Subasman Kademeli)`}
              </strong>{' '}
              · Güneş: {solarPos.isDaylight ? `${solarPos.altitudeDeg.toFixed(0)}°` : 'Gece'}
            </span>
          </div>
          <span className="text-[11px] text-stone-500">
            Düzenlemek istediğiniz 3D bloğa dokunun / tıklayın
          </span>
        </div>

        {colorMode === 'role' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-700 pt-1 border-t border-stone-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 inline-block bg-[#D97736]" /> Güney: Güneş Alan Odalar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 inline-block bg-[#3B82F6]" /> Kuzey: Aydınlık Atölye/Ofis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 inline-block bg-[#16A34A]" /> Merkez: Ortak Alan & Avlu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 inline-block bg-[#64748B]" /> Batı/KB: Servis & Koridor
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 inline-block bg-[#8C877E]" /> Gri Baza: Eğim Subasmanı / İstinat
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
