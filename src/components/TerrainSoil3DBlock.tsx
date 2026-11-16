import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TopographyAnalysis } from '../engine/realSiteAnalyzer';
import {
  build3DTerrainCutawayGroup,
  sampleTerrainDeltaY,
  TerrainSamplerConfig,
} from '../engine/terrainMeshHelper';

interface TerrainSoil3DBlockProps {
  topography: TopographyAnalysis;
  effectiveSlopePct: number;
  soilClass: 'ZB' | 'ZC' | 'ZD' | 'ZE';
  soilTitle: string;
  minFrostDepthCm: number;
}

function makePinLabel(text: string, bg: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 84;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(8, 8, 264, 68, 8);
  ctx.fill();
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 140, 42);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  sprite.scale.set(22, 6.6, 1);
  return sprite;
}

export const TerrainSoil3DBlock: React.FC<TerrainSoil3DBlockProps> = ({
  topography,
  effectiveSlopePct,
  soilClass,
  soilTitle,
  minFrostDepthCm,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const [exaggerate, setExaggerate] = useState(false);

  const isFlat = effectiveSlopePct < 2.5;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EFECE4');

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, el.clientWidth) / Math.max(1, el.clientHeight),
      1,
      800
    );
    camera.position.set(145, 95, 155);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 70;
    controls.maxDistance = 320;
    controls.target.set(0, -2, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc7c1b2, 0.85));
    const dirLight = new THREE.DirectionalLight(0xfff5e4, 1.45);
    dirLight.position.set(90, 140, 80);
    scene.add(dirLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    const onResize = () => {
      if (!mountRef.current) return;
      const w = Math.max(1, mountRef.current.clientWidth);
      const h = Math.max(1, mountRef.current.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }

    const cfg: TerrainSamplerConfig = {
      grid3x3M: topography.grid3x3M,
      nativeSlopePct: topography.slopePct,
      effectiveSlopePct,
      exaggeration: exaggerate ? 2.5 : 1.0,
    };

    const terrainMeshGrp = build3DTerrainCutawayGroup(160, 36, cfg, soilClass);
    root.add(terrainMeshGrp);

    // Ortada Örnek 65x55m Arsa Parsel Çerçevesi (arazi eğimine tam oturan çizgi)
    const pw = 65;
    const pd = 55;
    const borderPts: THREE.Vector3[] = [];
    const segs = 16;
    for (let i = 0; i <= segs; i++) {
      const x = -pw / 2 + (i / segs) * pw;
      const z = -pd / 2;
      borderPts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, cfg) + 0.35, z));
    }
    for (let i = 0; i <= segs; i++) {
      const x = pw / 2;
      const z = -pd / 2 + (i / segs) * pd;
      borderPts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, cfg) + 0.35, z));
    }
    for (let i = 0; i <= segs; i++) {
      const x = pw / 2 - (i / segs) * pw;
      const z = pd / 2;
      borderPts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, cfg) + 0.35, z));
    }
    for (let i = 0; i <= segs; i++) {
      const x = -pw / 2;
      const z = pd / 2 - (i / segs) * pd;
      borderPts.push(new THREE.Vector3(x, sampleTerrainDeltaY(x, z, cfg) + 0.35, z));
    }
    root.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(borderPts),
        new THREE.LineBasicMaterial({ color: 0xc85a17 })
      )
    );

    // Kuzey, Güney, Doğu, Batı ve Merkez Rakım Etiketleri
    const pins: Array<{ x: number; z: number; txt: string; bg: string }> = [
      {
        x: 0,
        z: 0,
        txt: `Merkez: ${topography.elevationM}m`,
        bg: '#181816',
      },
      {
        x: 0,
        z: -74,
        txt: `Kuzey: ${topography.neighbors100m.northM}m`,
        bg: '#0369A1',
      },
      {
        x: 0,
        z: 74,
        txt: `Güney: ${topography.neighbors100m.southM}m`,
        bg: '#C85A17',
      },
      {
        x: 74,
        z: 0,
        txt: `Doğu: ${topography.neighbors100m.eastM}m`,
        bg: '#44403C',
      },
      {
        x: -74,
        z: 0,
        txt: `Batı: ${topography.neighbors100m.westM}m`,
        bg: '#44403C',
      },
    ];

    for (const p of pins) {
      const py = sampleTerrainDeltaY(p.x, p.z, cfg);
      const pole = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.x, py, p.z),
          new THREE.Vector3(p.x, py + 7, p.z),
        ]),
        new THREE.LineBasicMaterial({ color: 0x181816 })
      );
      root.add(pole);
      const sp = makePinLabel(p.txt, p.bg);
      sp.position.set(p.x, py + 10, p.z);
      root.add(sp);
    }

    // Eğimli ise yağmur suyu / eğim yönü oku
    if (!isFlat) {
      const rad = (topography.aspectDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.sin(rad), -0.12, -Math.cos(rad)).normalize();
      const arrow = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, sampleTerrainDeltaY(0, 0, cfg) + 2.5, 0),
        34,
        0x0284c7,
        7,
        4.5
      );
      root.add(arrow);
    }
  }, [topography, effectiveSlopePct, soilClass, exaggerate, isFlat]);

  return (
    <div className="border border-stone-300 bg-white overflow-hidden">
      {/* Üst Başlık: Düz mü Eğimli mi Net Karar Bandı */}
      <div className="px-4 py-3 bg-[#FAF9F6] border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <span
            className={`px-2.5 py-1 font-bold text-xs text-white ${
              isFlat ? 'bg-[#15803D]' : 'bg-[#C85A17]'
            }`}
          >
            {isFlat ? 'ARAZİ DÜZ (%' + effectiveSlopePct + ')' : 'ARAZİ EĞİMLİ (%' + effectiveSlopePct + ')'}
          </span>
          <span className="font-semibold text-[#181816]">
            3D Uydu Topoğrafya ve Yeraltı Toprak Kesiti Modeli
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExaggerate((v) => !v)}
          className={`px-3 py-1 text-xs font-semibold border transition ${
            exaggerate
              ? 'bg-[#181816] text-white border-[#181816]'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
          }`}
        >
          {exaggerate ? 'Görünüm: 2.5x Eğim Belirgin' : 'Eğimi 2.5x Belirginleştir'}
        </button>
      </div>

      {/* 3D Topoğrafya & Zemin Kesiti Sahnesi */}
      <div ref={mountRef} className="w-full h-72 cursor-grab active:cursor-grabbing" />

      {/* Alt Katman Açıklaması (Çakışmasız Temiz Şerit) */}
      <div className="px-4 py-2.5 bg-[#FAF9F6] border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 inline-block bg-[#6B705C]" /> Üst Toprak (0–80 cm)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 inline-block bg-[#A68A6D]" /> Alt Zemin: {soilTitle} ({soilClass})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 inline-block bg-[#57534E]" /> Derin Ana Kayaç
          </span>
        </div>
        <div className="font-mono text-[11px] text-stone-500">
          Min. Temel Don Derinliği: -{minFrostDepthCm} cm · Fareyle 3D çevirebilirsiniz
        </div>
      </div>
    </div>
  );
};
