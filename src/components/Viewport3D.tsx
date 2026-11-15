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
import { Compass, Eye, Layers, Play, Pause, Sun, Wind } from 'lucide-react';

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
  const [colorMode, setColorMode] = useState<'role' | 'material'>('role');
  const [isPlayingDay, setIsPlayingDay] = useState(false);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
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
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
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

    // Geniş çevre zemin plağı
    const groundGeo = new THREE.PlaneGeometry(420, 420);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe3dfd5,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(240, 48, 0xc4bfb2, 0xd5d1c5);
    grid.position.y = -0.02;
    scene.add(grid);

    const massRoot = new THREE.Group();
    scene.add(massRoot);
    massRootRef.current = massRoot;

    const envOverlay = new THREE.Group();
    scene.add(envOverlay);
    envOverlayRef.current = envOverlay;

    // Tıklama ile 3D kütle seçimi (Raycaster)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
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
            onSelectBlock(found.blockId);
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

    // A) Arsa Parsel Zemini
    const parcelGeo = new THREE.BoxGeometry(site.parcelWidthM, 0.16, site.parcelDepthM);
    const parcelMat = new THREE.MeshStandardMaterial({
      color: 0xf4f2eb,
      roughness: 0.9,
    });
    const parcelMesh = new THREE.Mesh(parcelGeo, parcelMat);
    parcelMesh.position.y = 0.06;
    parcelMesh.receiveShadow = true;
    massRoot.add(parcelMesh);

    // Parsel sınırı ve Çekme mesafesi çizgisi
    const borderPts = [
      new THREE.Vector3(-site.parcelWidthM / 2, 0.18, -site.parcelDepthM / 2),
      new THREE.Vector3(site.parcelWidthM / 2, 0.18, -site.parcelDepthM / 2),
      new THREE.Vector3(site.parcelWidthM / 2, 0.18, site.parcelDepthM / 2),
      new THREE.Vector3(-site.parcelWidthM / 2, 0.18, site.parcelDepthM / 2),
      new THREE.Vector3(-site.parcelWidthM / 2, 0.18, -site.parcelDepthM / 2),
    ];
    const borderLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(borderPts),
      new THREE.LineBasicMaterial({ color: 0x161615 })
    );
    massRoot.add(borderLine);

    const sbW = Math.max(6, site.parcelWidthM - site.setbackM * 2);
    const sbD = Math.max(6, site.parcelDepthM - site.setbackM * 2);
    const sbPts = [
      new THREE.Vector3(-sbW / 2, 0.19, -sbD / 2),
      new THREE.Vector3(sbW / 2, 0.19, -sbD / 2),
      new THREE.Vector3(sbW / 2, 0.19, sbD / 2),
      new THREE.Vector3(-sbW / 2, 0.19, sbD / 2),
      new THREE.Vector3(-sbW / 2, 0.19, -sbD / 2),
    ];
    const sbGeo = new THREE.BufferGeometry().setFromPoints(sbPts);
    const sbLine = new THREE.Line(
      sbGeo,
      new THREE.LineDashedMaterial({ color: 0x9ca3af, dashSize: 1.5, gapSize: 1.0 })
    );
    sbLine.computeLineDistances();
    massRoot.add(sbLine);

    // B) Bina Kütle Grubu (Global Oryantasyon Döndürmeli)
    const orientedBuildingGroup = new THREE.Group();
    orientedBuildingGroup.rotation.y = (-globalOrientationDeg * Math.PI) / 180;
    massRoot.add(orientedBuildingGroup);

    // Avlu mikroiklim su & peyzaj öğesi (merkez boşlukta)
    if (courtyardAreaM2 >= 60) {
      const cSize = Math.min(20, Math.sqrt(courtyardAreaM2) * 0.65);
      const lawnGeo = new THREE.BoxGeometry(cSize, 0.12, cSize * 0.82);
      const lawnMat = new THREE.MeshStandardMaterial({ color: 0x84a96b, roughness: 0.92 });
      const lawn = new THREE.Mesh(lawnGeo, lawnMat);
      lawn.position.set(0, 0.18, 0);
      lawn.receiveShadow = true;
      orientedBuildingGroup.add(lawn);

      // Buharlaşmalı serinletme havuzu (özellikle sıcak iklimlerde)
      const poolGeo = new THREE.BoxGeometry(cSize * 0.42, 0.16, cSize * 0.34);
      const poolMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.18,
        metalness: 0.25,
      });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(0, 0.22, 0);
      orientedBuildingGroup.add(pool);
    }

    // Her bir 3D Kütle Bloğu ve Parametrik Çatısı
    for (const b of blocks) {
      const blockGroup = new THREE.Group();
      blockGroup.position.set(b.x, 0.14, b.z);
      blockGroup.rotation.y = (-b.rotationDeg * Math.PI) / 180;

      const totalH = b.floors * b.floorHeight;
      const isSelected = b.id === selectedBlockId;

      const baseColor =
        colorMode === 'role' ? ROLE_COLORS[b.role] : activeMaterialWallColor;
      const roofColor =
        colorMode === 'role' ? '#334155' : activeMaterialRoofColor;

      const bodyGeo = new THREE.BoxGeometry(b.width, totalH, b.depth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness: 0.76,
        metalness: 0.05,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = totalH / 2;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      blockGroup.add(bodyMesh);

      // Keskin mimari kenar çizgileri
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(bodyGeo),
        new THREE.LineBasicMaterial({
          color: isSelected ? 0xc85a17 : 0x1c1917,
          linewidth: 1,
        })
      );
      edges.position.y = totalH / 2;
      blockGroup.add(edges);

      // Kat döşemesi çizgileri ve cephe pencere bantları + Güney güneş kırıcı saçakları
      const slabMat = new THREE.MeshBasicMaterial({ color: 0x292524 });
      const winGlassMat = new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        roughness: 0.2,
        metalness: 0.35,
        transparent: true,
        opacity: 0.72,
      });
      const shadeMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.6 });

      for (let f = 0; f < b.floors; f++) {
        const yFloor = f * b.floorHeight;
        if (f > 0) {
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(b.width + 0.08, 0.1, b.depth + 0.08),
            slabMat
          );
          band.position.y = yFloor;
          blockGroup.add(band);
        }

        // Güney (+Z) ve Kuzey (-Z) pencere şeritleri
        if (b.role !== 'service_buffer') {
          const winH = b.floorHeight * 0.44;
          const winY = yFloor + b.floorHeight * 0.56;

          const sWin = new THREE.Mesh(
            new THREE.BoxGeometry(b.width * 0.84, winH, 0.08),
            winGlassMat
          );
          sWin.position.set(0, winY, b.depth / 2 + 0.03);
          blockGroup.add(sWin);

          const nWin = new THREE.Mesh(
            new THREE.BoxGeometry(b.width * 0.78, winH, 0.08),
            winGlassMat
          );
          nWin.position.set(0, winY, -b.depth / 2 - 0.03);
          blockGroup.add(nWin);

          // Güney cephe yatay güneş kırıcı çıkması
          if (b.overhangSouthM > 0.2) {
            const briseDepth = Math.min(1.4, b.overhangSouthM * 0.65);
            const brise = new THREE.Mesh(
              new THREE.BoxGeometry(b.width * 0.88, 0.09, briseDepth),
              shadeMat
            );
            brise.position.set(
              0,
              winY + winH / 2 + 0.06,
              b.depth / 2 + briseDepth / 2
            );
            brise.castShadow = true;
            blockGroup.add(brise);
          }
        }
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

      m.position.set(nx, nb.heightM / 2, nz);
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

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#EAE7DF] border border-stone-200 overflow-hidden select-none">
      {/* Three.js Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Sol Üst: Sade ve Anlaşılır Görünüm Butonları */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setIsPlayingDay((p) => !p)}
          className={`px-3 py-1.5 text-xs font-semibold border transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
            isPlayingDay
              ? 'bg-amber-600 text-white border-amber-700'
              : 'bg-[#161615] text-white border-[#161615] hover:bg-stone-800'
          }`}
        >
          {isPlayingDay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlayingDay ? 'Güneşi Durdur' : 'Güneşi Hareket Ettir'}
        </button>

        <button
          onClick={() => setShowSunPath((v) => !v)}
          className={`px-2.5 py-1.5 text-xs font-medium border transition flex items-center gap-1.5 whitespace-nowrap ${
            showSunPath
              ? 'bg-white text-[#161615] border-stone-400 font-semibold'
              : 'bg-white/75 text-stone-500 border-stone-300 hover:bg-white'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          Güneş Yolu
        </button>

        <button
          onClick={() => setShowWindFlow((v) => !v)}
          className={`px-2.5 py-1.5 text-xs font-medium border transition flex items-center gap-1.5 whitespace-nowrap ${
            showWindFlow
              ? 'bg-white text-[#161615] border-stone-400 font-semibold'
              : 'bg-white/75 text-stone-500 border-stone-300 hover:bg-white'
          }`}
        >
          <Wind className="w-3.5 h-3.5 text-sky-600" />
          Rüzgar ({seasonStats.windLabel})
        </button>

        <button
          onClick={() => setColorMode((m) => (m === 'role' ? 'material' : 'role'))}
          className="px-2.5 py-1.5 text-xs font-medium bg-white/95 text-[#161615] border border-stone-300 hover:bg-white transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <Layers className="w-3.5 h-3.5" />
          {colorMode === 'role' ? 'Renk: Oda Görevleri' : 'Renk: Dış Malzeme'}
        </button>
      </div>

      {/* Sağ Üst: Basit Kamera Açıları */}
      <div className="absolute top-3 right-3 flex items-center bg-white/95 border border-stone-300 divide-x divide-stone-200 text-xs">
        <button
          onClick={() => setCameraPreset('iso')}
          className="px-2.5 py-1.5 hover:bg-stone-100 font-medium flex items-center gap-1 whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5" /> 3D Açı
        </button>
        <button
          onClick={() => setCameraPreset('top')}
          className="px-2.5 py-1.5 hover:bg-stone-100 font-medium whitespace-nowrap"
        >
          Üstten Bak
        </button>
        <button
          onClick={() => setCameraPreset('south')}
          className="px-2.5 py-1.5 hover:bg-stone-100 font-medium whitespace-nowrap"
        >
          Güney Cephe
        </button>
      </div>

      {/* Sol Alt: Herkesin Anlayacağı Kısa Bilgi Kutusu */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs border border-stone-300 px-3.5 py-2.5 text-xs space-y-1 max-w-sm">
        <div className="flex items-center gap-2 font-semibold text-[#161615]">
          <Compass className="w-4 h-4 text-[#C85A17] shrink-0" />
          <span>
            {city.name} — Güneş Açısı:{' '}
            {solarPos.isDaylight ? `${solarPos.altitudeDeg.toFixed(0)}°` : 'Gece'} · Rüzgar:{' '}
            {seasonStats.windLabel}
          </span>
        </div>
        <p className="text-[11px] text-stone-600 leading-snug">
          Fareyle sahneyi çevirebilirsiniz. Çatısını veya boyutunu değiştirmek istediğiniz binanın
          üzerine doğrudan tıklayın.
        </p>
      </div>

      {/* Sağ Alt: Sadeleştirilmiş Renk Anlamları */}
      {colorMode === 'role' && (
        <div className="hidden md:flex absolute bottom-3 right-3 bg-white/95 border border-stone-300 px-3 py-2 text-xs flex-col gap-1">
          <div className="font-semibold text-[11px] text-stone-500 mb-0.5">Bina Renkleri</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block bg-[#D97736]" />
            <span>Güney: Güneş Alan Ana Odalar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block bg-[#3B82F6]" />
            <span>Kuzey: Göz Yormayan Aydınlık Atölye/Ofis</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block bg-[#16A34A]" />
            <span>Merkez: Ortak Alan & Avlu Girişi</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block bg-[#64748B]" />
            <span>Batı/Kuzeybatı: Servis & Koridor (Isı Kalkanı)</span>
          </div>
        </div>
      )}
    </div>
  );
};
