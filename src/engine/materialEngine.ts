import {
  BuildingFunctionKey,
  CityClimateProfile,
  EvaluatedMaterial,
  MaterialCategoryKey,
  MaterialItem,
} from '../types/architecture';
import { MATERIALS_DB } from '../data/materials';

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategoryKey, string> = {
  structure: '01 Taşıyıcı Strüktür',
  envelope_wall: '02 Dış Duvar & Kabuk',
  insulation: '03 Isı & Ses Yalıtımı',
  facade_shading: '04 Cephe & Güneş Kırıcı',
  roof_finish: '05 Çatı Kaplama Katmanı',
  courtyard_ground: '06 Avlu & Peyzaj Zemini',
};

export const TS825_LIMITS: Record<1 | 2 | 3 | 4 | 5, { uWallMax: number; uRoofMax: number }> = {
  1: { uWallMax: 0.66, uRoofMax: 0.43 },
  2: { uWallMax: 0.57, uRoofMax: 0.38 },
  3: { uWallMax: 0.48, uRoofMax: 0.28 },
  4: { uWallMax: 0.38, uRoofMax: 0.23 },
  5: { uWallMax: 0.36, uRoofMax: 0.21 },
};

export function haversineRoadDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Karayolu kıvrım katsayısı (1.22)
  return Math.round(R * c * 1.22);
}

export function evaluateMaterialsForProject(
  city: CityClimateProfile,
  funcKey: BuildingFunctionKey,
  preferLightweight = false
): EvaluatedMaterial[] {
  return MATERIALS_DB.map((mat) => {
    const distanceKm = haversineRoadDistanceKm(city.lat, city.lng, mat.originLat, mat.originLng);
    const massPerM2 = mat.densityKgM3 * mat.defaultThicknessM; // kg/m²
    const materialCarbonKgM2 = Number((massPerM2 * mat.embodiedCarbonKgCo2PerKg).toFixed(1));
    // Kamyon lojistiği ~0.085 kgCO2e / ton-km
    const transportCarbonKgM2 = Number((((massPerM2 / 1000) * distanceKm) * 0.085).toFixed(2));
    const totalCarbonKgM2 = Number((materialCarbonKgM2 + transportCarbonKgM2).toFixed(1));

    const thermalResistanceR = Number((mat.defaultThicknessM / Math.max(0.02, mat.lambdaWmK)).toFixed(2));

    // 1. İklim ve Zemin Uyumu Skoru
    let climateFitScore = mat.suitableClimates.includes(city.climateType) ? 88 : 58;
    if (city.ts825Zone >= 4 && mat.frostResistance === 'yüksek') climateFitScore += 8;
    if (city.ts825Zone >= 4 && mat.frostResistance !== 'yüksek') climateFitScore -= 16;
    if (city.seasons.summer.humidityPct >= 65 && mat.vaporPermeability === 'yüksek') climateFitScore += 7;
    if (city.climateType === 'hot_arid' && mat.densityKgM3 >= 1800 && !preferLightweight) climateFitScore += 8;
    // Yumuşak zemin / deprem bölgesinde hafif malzeme avantajı
    if (preferLightweight) {
      if (massPerM2 <= 220) climateFitScore += 9;
      else if (massPerM2 >= 550) climateFitScore -= 14;
    }
    climateFitScore = Math.max(35, Math.min(99, climateFitScore));

    // 2. Erişilebilirlik & Yerel Tedarik Skoru
    const distScore = Math.max(25, Math.min(100, 104 - distanceKm * 0.068));
    const craftBonus =
      mat.localCraftAvailability === 'çok yaygın'
        ? 10
        : mat.localCraftAvailability === 'yaygın'
        ? 4
        : -6;
    const accessibilityScore = Math.max(30, Math.min(99, Math.round(distScore + craftBonus)));

    // 3. Sürdürülebilirlik Skoru
    let susRaw = 68;
    if (mat.embodiedCarbonKgCo2PerKg < 0) susRaw += 24; // Biyojenik negatif karbon
    else if (mat.embodiedCarbonKgCo2PerKg < 0.08) susRaw += 16;
    else if (mat.embodiedCarbonKgCo2PerKg > 1.0) susRaw -= 10;

    susRaw += mat.recyclabilityPct * 0.1;
    susRaw += mat.renewableContentPct * 0.08;
    if (distanceKm <= 500) susRaw += 5;
    const sustainabilityScore = Math.max(40, Math.min(99, Math.round(susRaw)));

    // 4. Bina Fonksiyonu Uyumu
    const functionFitScore = mat.suitableFunctions.includes(funcKey) ? 92 : 66;

    const overallScore = Math.round(
      climateFitScore * 0.34 +
        sustainabilityScore * 0.26 +
        accessibilityScore * 0.22 +
        functionFitScore * 0.18
    );

    return {
      material: mat,
      distanceKm,
      climateFitScore,
      accessibilityScore,
      sustainabilityScore,
      functionFitScore,
      overallScore,
      transportCarbonKgM2,
      materialCarbonKgM2,
      totalCarbonKgM2,
      thermalResistanceR,
      isRegionalLeed: distanceKm <= 500,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

export function getRecommendedMaterialSelection(
  evaluated: EvaluatedMaterial[]
): Record<MaterialCategoryKey, string> {
  const categories: MaterialCategoryKey[] = [
    'structure',
    'envelope_wall',
    'insulation',
    'facade_shading',
    'roof_finish',
    'courtyard_ground',
  ];
  const pick: Partial<Record<MaterialCategoryKey, string>> = {};
  for (const cat of categories) {
    const best = evaluated.find((e) => e.material.category === cat);
    if (best) pick[cat] = best.material.id;
  }
  return pick as Record<MaterialCategoryKey, string>;
}

export interface AssemblySummary {
  wallUValueWm2K: number;
  ts825WallLimit: number;
  passesTs825: boolean;
  thermalLagHours: number;
  embodiedCarbonPerBuiltM2: number;
  totalProjectCarbonTons: number;
  baselineConventionalTons: number;
  carbonSavedPct: number;
  regionalRatioPct: number;
}

export function calculateAssemblySummary(
  selectedIds: Record<MaterialCategoryKey, string>,
  evaluated: EvaluatedMaterial[],
  city: CityClimateProfile,
  totalBuiltAreaM2: number
): AssemblySummary {
  const findEval = (id: string) => evaluated.find((e) => e.material.id === id);

  const wallMat = findEval(selectedIds.envelope_wall);
  const insMat = findEval(selectedIds.insulation);
  const facMat = findEval(selectedIds.facade_shading);
  const strMat = findEval(selectedIds.structure);
  const roofMat = findEval(selectedIds.roof_finish);
  const grdMat = findEval(selectedIds.courtyard_ground);

  const rsiRse = 0.17; // İç + Dış yüzeysel ısıl direnç (m²K/W)
  const rWall =
    rsiRse +
    (wallMat?.thermalResistanceR ?? 1.1) +
    (insMat?.thermalResistanceR ?? 2.2) +
    (facMat?.thermalResistanceR ?? 0.12) * 0.5;

  const wallUValueWm2K = Number((1 / Math.max(0.3, rWall)).toFixed(2));
  const ts825WallLimit = TS825_LIMITS[city.ts825Zone].uWallMax;
  const passesTs825 = wallUValueWm2K <= ts825WallLimit;

  // Termal faz kayması (saat) tahmini: ısıl kapasite ve kalınlık fonksiyonu
  const wallHeatCap =
    (wallMat ? wallMat.material.densityKgM3 * wallMat.material.defaultThicknessM * wallMat.material.specificHeatJkgK : 180000) +
    (insMat ? insMat.material.densityKgM3 * insMat.material.defaultThicknessM * insMat.material.specificHeatJkgK : 12000);
  const thermalLagHours = Number(
    Math.min(14.5, Math.max(3.5, 2.8 + wallHeatCap / 82000 + (insMat?.thermalResistanceR ?? 2) * 0.9)).toFixed(1)
  );

  // İnşaat m² başına eşdeğer gömülü karbon (taşıyıcı + kabuk + çatı + bitişler)
  const strCarbon = (strMat?.totalCarbonKgM2 ?? 65) * 1.35;
  const envCarbon =
    ((wallMat?.totalCarbonKgM2 ?? 28) +
      (insMat?.totalCarbonKgM2 ?? 12) +
      (facMat?.totalCarbonKgM2 ?? 14)) *
    0.72;
  const roofCarbon = (roofMat?.totalCarbonKgM2 ?? 18) * 0.35;
  const grdCarbon = (grdMat?.totalCarbonKgM2 ?? 6) * 0.25;
  const mepFinishesFixed = 78; // Sabit cam, doğrama ve MEP payı (kgCO2e/m²)

  const embodiedCarbonPerBuiltM2 = Math.round(
    Math.max(45, strCarbon + envCarbon + roofCarbon + grdCarbon + mepFinishesFixed)
  );

  const totalProjectCarbonTons = Math.round((embodiedCarbonPerBuiltM2 * totalBuiltAreaM2) / 1000);
  // Geleneksel C30 betonarme + XPS + standart tuğla referans bina (~430 kgCO2e/m²)
  const baselineConventionalTons = Math.round((430 * totalBuiltAreaM2) / 1000);
  const carbonSavedPct = Math.round(
    ((baselineConventionalTons - totalProjectCarbonTons) / Math.max(1, baselineConventionalTons)) * 100
  );

  const chosenList = [strMat, wallMat, insMat, facMat, roofMat, grdMat].filter(
    Boolean
  ) as EvaluatedMaterial[];
  const regionalCount = chosenList.filter((c) => c.isRegionalLeed).length;
  const regionalRatioPct = chosenList.length
    ? Math.round((regionalCount / chosenList.length) * 100)
    : 0;

  return {
    wallUValueWm2K,
    ts825WallLimit,
    passesTs825,
    thermalLagHours,
    embodiedCarbonPerBuiltM2,
    totalProjectCarbonTons,
    baselineConventionalTons,
    carbonSavedPct,
    regionalRatioPct,
  };
}
