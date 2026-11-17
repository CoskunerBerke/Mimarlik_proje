import {
  BuildingFunctionKey,
  CityClimateProfile,
  MassBlock,
  RoofTypeKey,
} from '../types/architecture';
import { calculateSolarPosition } from './solarEngine';

export interface RoofTypeMeta {
  key: RoofTypeKey;
  name: string;
  shortName: string;
  description: string;
  bestFor: string;
}

export const ROOF_TYPES_META: Record<RoofTypeKey, RoofTypeMeta> = {
  sawtooth: {
    key: 'sawtooth',
    name: 'Testere Dişi Kuzey Işıklığı (Sawtooth)',
    shortName: 'Testere Dişi',
    description:
      'Kuzeye bakan dik ışıklık yüzeyleriyle kamaşmasız homojen günışığı alırken, güneye bakan eğimli yüzeylerde optimum açıda BIPV güneş enerjisi üretir.',
    bestFor: 'Eğitim Stüdyoları, Müze/Kültür, Üretim Atölyesi, Açık Ofis',
  },
  mono_pitch: {
    key: 'mono_pitch',
    name: 'Tek Eğimli Solar Clerestory Çatı (Mono-Pitch)',
    shortName: 'Tek Eğimli Solar',
    description:
      'Güney cephede yükselen kesiti ve hesaplanmış saçak çıkmasıyla kış güneşini mekanın derinliğine taşır, yaz güneşini keser.',
    bestFor: 'Konut, Derslik, Güney Pasif Solar Kütleler',
  },
  asymmetric_gable: {
    key: 'asymmetric_gable',
    name: 'Asimetrik İklimsel Beşik Çatı',
    shortName: 'Asimetrik Beşik',
    description:
      'Güney kanadı enlem açısına göre fotovoltaik ve güneş kontrolüne, kuzey kanadı rüzgar saptırma ve kar tahliyesine göre farklı açılarda çalışır.',
    bestFor: 'Karasal ve Soğuk İklimler, Karma ve Eğitim Yapıları',
  },
  gable: {
    key: 'gable',
    name: 'Simetrik Havalandırmalı Beşik Çatı',
    shortName: 'Beşik Çatı',
    description:
      'Yüksek yağış ve kar yükünü hızla tahliye eden, geniş saçaklarıyla cepheleri yağmur ve yaz güneşinden koruyan klasik eğimli çatı.',
    bestFor: 'Karadeniz, Doğu Anadolu, Konut ve Sağlık Yapıları',
  },
  flat_green: {
    key: 'flat_green',
    name: 'Ekstansif Yeşil Teras + Tepe Işık Feneri',
    shortName: 'Yeşil Çatı + Fener',
    description:
      'Bitkisel toprak katmanıyla yaz çatı ısınmasını sönümler, yağmur suyunu tutar ve kontrollü tepe fenerleriyle merkeze ışık indirir.',
    bestFor: 'Sıcak-Kurak İklimler, Yoğun Kentsel Parseller, Sağlık & Ofis',
  },
  butterfly: {
    key: 'butterfly',
    name: 'Kelebek (V-Kesit) Yağmur Hasadı & Günışığı Çatısı',
    shortName: 'Kelebek (V-Çatı)',
    description:
      'İçe eğimli iki kanadıyla dış cephelerde pencere yüksekliğini artırarak günışığını derinleştirir ve yağmur suyunu merkezi sarnıca toplar.',
    bestFor: 'Kurak/Yarı-Kurak Bölgeler, Derin Planlı Ofis ve Kültür Binaları',
  },
  louver_canopy: {
    key: 'louver_canopy',
    name: 'Biyoklimatik Güneş Kırıcı Kanopi / Pergola',
    shortName: 'Solar Kanopi',
    description:
      'Yaz gündönümü güneş açısına göre kalibre edilmiş açılı kanatlarla avlu ve yarı-açık sosyal teraslarda gölgeli mikroiklim üretir.',
    bestFor: 'Sıcak-Nemli Akdeniz/Ege, Sosyal Avlu ve Fuaye Kütleleri',
  },
  dome: {
    key: 'dome',
    name: 'Kasnak Pencereli Merkezi Kubbe & Revak Örtüsü',
    shortName: 'Merkezi Kubbe',
    description:
      'Yüksek kasnak pencerelerinden süzülen dolaylı günışığı ve doğal sıcak hava yükselmesi (baca etkisi) sağlayan kubbeli ibadet/toplanma örtüsü.',
    bestFor: 'Cami, İbadethane, Külliye ve Anıtsal Kamusal Mekânlar',
  },
  barrel_vault: {
    key: 'barrel_vault',
    name: 'Geniş Açıklıklı Tonoz / Kemer Çatı (Barrel Vault)',
    shortName: 'Tonoz / Kemer Çatı',
    description:
      'Kolonsuz geniş açıklık geçen aerodinamik kemer kesitiyle rüzgar yükünü azaltır ve tepe bantlarından dengeli ışık alır.',
    bestFor: 'Spor Salonu, Yüzme Havuzu, Otogar/Terminal ve Sergi Holleri',
  },
};

export interface RoofOptimizationResult {
  roofType: RoofTypeKey;
  roofPitchDeg: number;
  secondaryPitchDeg: number;
  overhangSouthM: number;
  sawtoothCount: number;
  skylightRatio: number;
  hasPvPanels: boolean;
  reasoning: string;
}

export interface RoofPerformanceMetrics {
  summerNoonAltDeg: number;
  winterNoonAltDeg: number;
  idealSouthOverhangM: number;
  winterSunPenetrationM: number;
  summerDirectBlockPct: number;
  estimatedDaylightFactorPct: number;
  glareRiskLabel: 'Düşük (Kamaşmasız)' | 'Orta (Dengeli)' | 'Yüksek (Kırıcı Önerilir)';
  annualPvYieldKwh: number;
  rainwaterHarvestM3Yr: number;
  optimalLouverCutoffDeg: number;
}

const DEG2RAD = Math.PI / 180;

export function recommendOptimalRoofForBlock(
  block: MassBlock,
  city: CityClimateProfile,
  funcKey: BuildingFunctionKey
): RoofOptimizationResult {
  const absLat = Math.abs(city.lat);
  const summerNoon = calculateSolarPosition(city.lat, 172, 12).altitudeDeg;
  const pvTilt = Math.max(18, Math.min(44, Math.round(absLat * 0.78 + 3)));

  // Yüksek pencere bandı (2.1m) için 21 Haziran öğle güneşini kesen ideal saçak boyu
  const windowHeightRef = 2.1;
  const idealOverhang = Number(
    Math.max(0.6, Math.min(2.2, windowHeightRef / Math.tan(summerNoon * DEG2RAD) + 0.35)).toFixed(2)
  );

  // 0. Cami / İbadethane veya Spor / Terminal özel geniş açıklık örtüleri
  if (funcKey === 'religious' && block.role === 'primary_living') {
    return {
      roofType: 'dome',
      roofPitchDeg: 35,
      secondaryPitchDeg: 85,
      overhangSouthM: idealOverhang,
      sawtoothCount: 1,
      skylightRatio: 0.28,
      hasPvPanels: false,
      reasoning: `Ana ibadet mekânında (harim) kasnak pencereleriyle kamaşmasız çevre günışığı alan ve ısınan havayı kubbe üst kotundan tahliye eden merkezi kubbe örtüsü.`,
    };
  }
  if ((funcKey === 'sports' || funcKey === 'transport') && block.role === 'north_daylight') {
    return {
      roofType: 'barrel_vault',
      roofPitchDeg: 24,
      secondaryPitchDeg: 85,
      overhangSouthM: Math.max(1.4, idealOverhang + 0.4),
      sawtoothCount: 2,
      skylightRatio: 0.32,
      hasPvPanels: true,
      reasoning: `Kolonsuz geniş açıklığı hafif çelik/lamine ahşap kemerle geçen, rüzgar aerodinamiği yüksek ve tepe günışığı bantlı tonoz çatı.`,
    };
  }

  // 1. Kuzey homojen günışığı gerektiren stüdyo/sergi/üretim/kütüphane kütleleri
  if (
    block.role === 'north_daylight' ||
    funcKey === 'atelier' ||
    funcKey === 'industrial' ||
    funcKey === 'library' ||
    (funcKey === 'cultural' && block.role !== 'service_buffer')
  ) {
    const count = Math.max(2, Math.min(6, Math.round(block.depth / 4.2)));
    return {
      roofType: 'sawtooth',
      roofPitchDeg: pvTilt,
      secondaryPitchDeg: 86, // Kuzeye bakan dikey/hafif eğimli kamaşmasız cam yüzey
      overhangSouthM: idealOverhang,
      sawtoothCount: count,
      skylightRatio: 0.38,
      hasPvPanels: true,
      reasoning: `${city.lat.toFixed(1)}° enleminde ${pvTilt}° güney eğimli testere dişi yüzey maksimum yıllık BIPV üretimi sağlarken, 86° kuzey ışıklıkları ${summerNoon.toFixed(0)}° yaz güneşini kesip homojen günışığı alır.`,
    };
  }

  // 2. Sosyal atrium / avlu arayüzü sıcak iklimde
  if (block.role === 'social_atrium' && city.climateType === 'hot_humid') {
    return {
      roofType: 'louver_canopy',
      roofPitchDeg: Math.round(90 - summerNoon + 12),
      secondaryPitchDeg: 0,
      overhangSouthM: Math.max(1.4, idealOverhang + 0.5),
      sawtoothCount: 4,
      skylightRatio: 0.45,
      hasPvPanels: false,
      reasoning: `Sıcak-nemli iklimde ${summerNoon.toFixed(0)}° yaz güneşini kesip deniz meltemini ve kış güneşini geçiren biyoklimatik kanat açısı.`,
    };
  }

  // 3. Soğuk dağ / yüksek kar yükü (TS 825 4-5. bölge)
  if (city.climateType === 'cold_mountain') {
    const snowPitch = Math.max(34, pvTilt + 4);
    return {
      roofType: 'asymmetric_gable',
      roofPitchDeg: snowPitch,
      secondaryPitchDeg: 28,
      overhangSouthM: idealOverhang,
      sawtoothCount: 2,
      skylightRatio: 0.2,
      hasPvPanels: true,
      reasoning: `${city.annualSnowLoadKnM2} kN/m² kar yükünü tahliye eden ${snowPitch}° güney eğimi ve kuzey rüzgarını saptıran aerodinamik 28° arka kanat.`,
    };
  }

  // 4. Sıcak-kurak iklim (Diyarbakır, Konya vb.)
  if (city.climateType === 'hot_arid') {
    if (funcKey === 'office' || funcKey === 'education') {
      return {
        roofType: 'butterfly',
        roofPitchDeg: 14,
        secondaryPitchDeg: 14,
        overhangSouthM: Math.max(1.2, idealOverhang + 0.3),
        sawtoothCount: 2,
        skylightRatio: 0.18,
        hasPvPanels: true,
        reasoning: `Kurak iklimde nadir yağışları merkezi sarnıca toplayan 14° V-kesit çatı ve gölgeli yüksek cephe pencereleri.`,
      };
    }
    return {
      roofType: 'flat_green',
      roofPitchDeg: 4,
      secondaryPitchDeg: 85,
      overhangSouthM: Math.max(1.1, idealOverhang + 0.2),
      sawtoothCount: 2,
      skylightRatio: 0.16,
      hasPvPanels: true,
      reasoning: `Yatay çatıdaki aşırı yaz ışınımını (${city.seasons.summer.directRadiationWm2} W/m²) toprak/sedum ısıl kütlesiyle sönümleyen yeşil teras ve kuzey ışık fenerleri.`,
    };
  }

  // 5. Çok yağışlı denizel veya sıcak-nemli konut/sağlık
  if (city.seasons.winter.precipitationMm + city.seasons.autumn.precipitationMm > 460) {
    return {
      roofType: 'gable',
      roofPitchDeg: 26,
      secondaryPitchDeg: 26,
      overhangSouthM: Math.max(1.15, idealOverhang + 0.25),
      sawtoothCount: 2,
      skylightRatio: 0.15,
      hasPvPanels: true,
      reasoning: `Yoğun mevsimsel yağışa karşı 26° çift yönlü hızlı su tahliyesi ve cepheyi koruyan ${(idealOverhang + 0.25).toFixed(2)}m geniş saçaklar.`,
    };
  }

  // 6. Ilıman karasal / geçiş iklimi ana yaşam kütleleri -> Tek eğimli solar clerestory
  return {
    roofType: 'mono_pitch',
    roofPitchDeg: Math.max(16, Math.min(28, Math.round(pvTilt * 0.68))),
    secondaryPitchDeg: 90,
    overhangSouthM: idealOverhang,
    sawtoothCount: 3,
    skylightRatio: 0.28,
    hasPvPanels: true,
    reasoning: `Kış gündönümünde alçak açılı güneşi clerestory bandından mekanın derinliğine alırken, yazın ${idealOverhang}m saçakla aşırı ısınmayı engeller.`,
  };
}

export function analyzeBlockRoofPerformance(
  block: MassBlock,
  city: CityClimateProfile
): RoofPerformanceMetrics {
  const summerNoonAltDeg = Number(calculateSolarPosition(city.lat, 172, 12).altitudeDeg.toFixed(1));
  const winterNoonAltDeg = Number(calculateSolarPosition(city.lat, 355, 12).altitudeDeg.toFixed(1));

  const windowHeightM = Math.min(2.6, block.floorHeight * 0.65);
  const idealSouthOverhangM = Number(
    (windowHeightM / Math.tan(summerNoonAltDeg * DEG2RAD)).toFixed(2)
  );

  // Kış güneşi iç mekan penetrasyon derinliği (m)
  const effectiveHeadHeight =
    block.roofType === 'mono_pitch' || block.roofType === 'butterfly'
      ? block.floorHeight + Math.min(2.4, block.depth * 0.18 * Math.tan(block.roofPitchDeg * DEG2RAD))
      : block.floorHeight * 0.82;

  const overhangShadowDropWinter = block.overhangSouthM * Math.tan(winterNoonAltDeg * DEG2RAD);
  const netSunnyApertureWinter = Math.max(0.2, effectiveHeadHeight - 0.85 - overhangShadowDropWinter);
  const rawPenetration = netSunnyApertureWinter / Math.tan(winterNoonAltDeg * DEG2RAD);
  const winterSunPenetrationM = Number(Math.min(block.depth, Math.max(0.8, rawPenetration)).toFixed(1));

  // Yaz öğle doğrudan güneş engelleme oranı (%)
  let summerDirectBlockPct = 65;
  if (block.roofType === 'sawtooth') {
    // Kuzeye bakan ışıklık açısı yaz güneşinden dik oldukça blokaj %95-100 olur
    summerDirectBlockPct = block.secondaryPitchDeg >= 78 ? 98 : Math.round(70 + block.secondaryPitchDeg * 0.3);
  } else if (block.roofType === 'louver_canopy') {
    summerDirectBlockPct = 92;
  } else {
    const shadedVertical = block.overhangSouthM * Math.tan(summerNoonAltDeg * DEG2RAD);
    summerDirectBlockPct = Math.min(100, Math.round((shadedVertical / Math.max(0.5, windowHeightM)) * 100));
  }

  // Ortalama Günışığı Faktörü (%DF) tahmini
  const sideLightFactor = Math.min(3.2, (block.floorHeight * 2.1) / Math.max(6, block.depth));
  let roofLightBonus = 0;
  if (block.roofType === 'sawtooth') {
    roofLightBonus = block.skylightRatio * 7.2 * Math.min(1.25, block.sawtoothCount / 3);
  } else if (block.roofType === 'mono_pitch' || block.roofType === 'butterfly') {
    roofLightBonus = block.skylightRatio * 4.4;
  } else if (block.roofType === 'flat_green') {
    roofLightBonus = block.skylightRatio * 4.8;
  } else if (block.roofType === 'louver_canopy') {
    roofLightBonus = block.skylightRatio * 6.0;
  } else {
    roofLightBonus = block.skylightRatio * 2.8;
  }
  const estimatedDaylightFactorPct = Number(
    Math.min(9.5, sideLightFactor + roofLightBonus).toFixed(1)
  );

  // Kamaşma riski
  let glareRiskLabel: RoofPerformanceMetrics['glareRiskLabel'] = 'Orta (Dengeli)';
  if (block.roofType === 'sawtooth' && block.secondaryPitchDeg >= 78) {
    glareRiskLabel = 'Düşük (Kamaşmasız)';
  } else if (summerDirectBlockPct >= 85) {
    glareRiskLabel = 'Düşük (Kamaşmasız)';
  } else if (summerDirectBlockPct < 55 && block.skylightRatio > 0.3) {
    glareRiskLabel = 'Yüksek (Kırıcı Önerilir)';
  }

  // Yıllık BIPV Elektrik Üretimi (kWh/yıl)
  const roofArea = block.width * block.depth;
  const usablePvAreaRatio =
    block.roofType === 'sawtooth'
      ? 0.58
      : block.roofType === 'mono_pitch'
      ? 0.72
      : block.roofType === 'flat_green'
      ? 0.38
      : block.roofType === 'louver_canopy'
      ? 0.35
      : 0.48;
  const optimalTilt = Math.abs(city.lat) * 0.78 + 3;
  const tiltDiff = Math.abs(block.roofPitchDeg - optimalTilt);
  const tiltEfficiency = Math.max(0.72, 1 - Math.pow(tiltDiff / 75, 2));
  const avgSummerWinterDirect =
    (city.seasons.summer.directRadiationWm2 + city.seasons.winter.directRadiationWm2) / 2;
  const annualIrradiationKwhM2 = avgSummerWinterDirect * 2.85; // ~1550 - 1950 kWh/m²/yıl
  const pvEfficiency = 0.205 * 0.82; // Panel verimi x sistem PR
  const annualPvYieldKwh = block.hasPvPanels
    ? Math.round(roofArea * usablePvAreaRatio * annualIrradiationKwhM2 * pvEfficiency * tiltEfficiency)
    : 0;

  // Yıllık yağmur suyu hasadı (m³/yıl)
  const annualPrecipMm =
    city.seasons.spring.precipitationMm +
    city.seasons.summer.precipitationMm +
    city.seasons.autumn.precipitationMm +
    city.seasons.winter.precipitationMm;
  const runoffCoeff = block.roofType === 'flat_green' ? 0.42 : block.roofType === 'butterfly' ? 0.9 : 0.82;
  const rainwaterHarvestM3Yr = Math.round((roofArea * (annualPrecipMm / 1000)) * runoffCoeff);

  const optimalLouverCutoffDeg = Math.max(15, Math.round(90 - summerNoonAltDeg + 10));

  return {
    summerNoonAltDeg,
    winterNoonAltDeg,
    idealSouthOverhangM,
    winterSunPenetrationM,
    summerDirectBlockPct,
    estimatedDaylightFactorPct,
    glareRiskLabel,
    annualPvYieldKwh,
    rainwaterHarvestM3Yr,
    optimalLouverCutoffDeg,
  };
}
