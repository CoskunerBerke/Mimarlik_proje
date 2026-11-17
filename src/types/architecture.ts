export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export type ClimateZoneType =
  | 'hot_humid'
  | 'hot_arid'
  | 'temperate_marine'
  | 'temperate_continental'
  | 'cold_mountain';

export interface SeasonalClimateStats {
  avgTempC: number;
  minTempC: number;
  maxTempC: number;
  humidityPct: number;
  windSpeedMs: number;
  windDirectionDeg: number; // 0 = Kuzey (N), 90 = Doğu (E), 180 = Güney (S), 270 = Batı (W) - Rüzgarın GELDİĞİ yön
  windLabel: string;
  directRadiationWm2: number;
  diffuseRadiationWm2: number;
  precipitationMm: number;
}

export interface CityClimateProfile {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  elevationM: number;
  koppen: string;
  koppenDesc: string;
  ts825Zone: 1 | 2 | 3 | 4 | 5;
  climateType: ClimateZoneType;
  heatingDegreeDays: number;
  coolingDegreeDays: number;
  annualSnowLoadKnM2: number;
  seasons: Record<SeasonKey, SeasonalClimateStats>;
  passiveStrategies: string[];
  isCustomLive?: boolean;
}

export type BuildingFunctionKey =
  | 'residential'
  | 'villa'
  | 'dormitory'
  | 'hotel'
  | 'kindergarten'
  | 'education'
  | 'library'
  | 'cultural'
  | 'office'
  | 'commercial'
  | 'healthcare'
  | 'sports'
  | 'religious'
  | 'transport'
  | 'public_gov'
  | 'atelier'
  | 'industrial'
  | 'agro'
  | 'mixed'
  | 'custom';

export type SpaceZoneRole =
  | 'primary_living'
  | 'north_daylight'
  | 'social_atrium'
  | 'service_buffer'
  | 'circulation_core';

export interface ProgramSpaceItem {
  id: string;
  name: string;
  role: SpaceZoneRole;
  ratioPct: number;
  preferredOrientation: 'Güney / GD' | 'Kuzey (Homojen)' | 'Doğu (Sabah)' | 'Kuzeybatı / Tampon' | 'Merkez / Avlu';
  targetDaylightFactor: number;
  minCeilingHeightM: number;
  notes: string;
}

export interface BuildingProgramDefinition {
  key: BuildingFunctionKey;
  title: string;
  subtitle: string;
  defaultFloorHeightM: number;
  idealMaxDepthM: number;
  daylightPriority: number;
  ventilationPriority: number;
  thermalStabilityPriority: number;
  courtyardAffinity: number;
  spaces: ProgramSpaceItem[];
}

export type MassTypologyKey =
  | 'courtyard'
  | 'u_court'
  | 'l_shield'
  | 'compact_prism'
  | 'staggered_pavilion'
  | 'linear_ew';

export type RoofTypeKey =
  | 'sawtooth'
  | 'mono_pitch'
  | 'asymmetric_gable'
  | 'gable'
  | 'flat_green'
  | 'butterfly'
  | 'louver_canopy'
  | 'dome'
  | 'barrel_vault';

export type SpecialBlockFeature =
  | 'minaret'
  | 'sadirvan'
  | 'balconies'
  | 'arcade'
  | 'entrance_canopy'
  | 'glass_bridge'
  | 'outdoor_pool';

export interface MassBlock {
  id: string;
  label: string;
  role: SpaceZoneRole;
  x: number; // +X = Doğu, -X = Batı (metre)
  z: number; // +Z = Güney, -Z = Kuzey (metre)
  width: number; // X yönü genişlik (m)
  depth: number; // Z yönü derinlik (m)
  floors: number;
  floorHeight: number;
  rotationDeg: number; // Y ekseni dönüş açısı (derece)
  roofType: RoofTypeKey;
  roofPitchDeg: number; // Güney / Ana eğim açısı (derece)
  secondaryPitchDeg: number; // Kuzey / İkincil eğim veya ışıklık açısı (derece)
  overhangSouthM: number; // Güney saçak / güneş kırıcı çıkması (m)
  sawtoothCount: number; // Testere dişi / fener adedi
  skylightRatio: number; // Çatı / Clerestory saydamlık oranı (0.0 - 0.7)
  ridgeDirection: 'EW' | 'NS';
  hasPvPanels: boolean;
  specialFeature?: SpecialBlockFeature;
  glazingStyle?: 'punched' | 'curtain_wall' | 'arched_classic' | 'minimal_hall';
  customWallHex?: string;
  customRoofHex?: string;
}

export interface NeighborContextBlock {
  id: string;
  label: string;
  direction: 'Kuzey' | 'Güney' | 'Doğu' | 'Batı';
  enabled: boolean;
  heightM: number;
  distanceM: number;
  widthM: number;
  depthM: number;
}

export interface SiteParameters {
  parcelWidthM: number; // Doğu-Batı (X)
  parcelDepthM: number; // Kuzey-Güney (Z)
  slopeDeg: number;
  slopeAspect: 'Güney' | 'Kuzey' | 'Doğu' | 'Batı' | 'Düz';
  maxTaks: number;
  maxKaks: number;
  setbackM: number;
}

export interface TypologyRecommendation {
  key: MassTypologyKey;
  name: string;
  tagline: string;
  totalScore: number;
  thermalScore: number;
  daylightScore: number;
  ventilationScore: number;
  courtyardComfortScore: number;
  surfaceToVolumeRatio: number;
  courtyardRatioHW: string;
  recommendedOrientationDeg: number;
  rationale: string[];
  courtyardAreaM2: number;
  footprintAreaM2: number;
  totalBuiltAreaM2: number;
  taksRatio: number;
  kaksRatio: number;
  blocks: MassBlock[];
}

export type MaterialCategoryKey =
  | 'structure'
  | 'envelope_wall'
  | 'insulation'
  | 'facade_shading'
  | 'roof_finish'
  | 'courtyard_ground';

export interface MaterialItem {
  id: string;
  name: string;
  category: MaterialCategoryKey;
  originRegion: string;
  originCity: string;
  originLat: number;
  originLng: number;
  lambdaWmK: number;
  defaultThicknessM: number;
  densityKgM3: number;
  specificHeatJkgK: number;
  embodiedCarbonKgCo2PerKg: number;
  recyclabilityPct: number;
  renewableContentPct: number;
  vaporPermeability: 'yüksek' | 'orta' | 'düşük';
  frostResistance: 'yüksek' | 'orta' | 'düşük';
  localCraftAvailability: 'çok yaygın' | 'yaygın' | 'uzman ekip';
  suitableClimates: ClimateZoneType[];
  suitableFunctions: BuildingFunctionKey[];
  architecturalNote: string;
  colorHex: string;
}

export interface EvaluatedMaterial {
  material: MaterialItem;
  distanceKm: number;
  climateFitScore: number;
  accessibilityScore: number;
  sustainabilityScore: number;
  functionFitScore: number;
  overallScore: number;
  transportCarbonKgM2: number;
  materialCarbonKgM2: number;
  totalCarbonKgM2: number;
  thermalResistanceR: number;
  isRegionalLeed: boolean; // < 500 km yerel tedarik eşiği
}
