import {
  BuildingFunctionKey,
  CityClimateProfile,
  MassBlock,
  MassTypologyKey,
  SiteParameters,
  SpaceZoneRole,
  TypologyRecommendation,
} from '../types/architecture';
import { BUILDING_PROGRAMS } from '../data/programs';
import { recommendOptimalRoofForBlock } from './roofEngine';

function createConfiguredBlock(
  partial: {
    id: string;
    label: string;
    role: SpaceZoneRole;
    x: number;
    z: number;
    width: number;
    depth: number;
    floors: number;
    floorHeight: number;
    rotationDeg?: number;
    ridgeDirection?: 'EW' | 'NS';
  },
  city: CityClimateProfile,
  funcKey: BuildingFunctionKey
): MassBlock {
  const base: MassBlock = {
    id: partial.id,
    label: partial.label,
    role: partial.role,
    x: Number(partial.x.toFixed(1)),
    z: Number(partial.z.toFixed(1)),
    width: Number(Math.max(6, partial.width).toFixed(1)),
    depth: Number(Math.max(6, partial.depth).toFixed(1)),
    floors: Math.max(1, Math.round(partial.floors)),
    floorHeight: partial.floorHeight,
    rotationDeg: partial.rotationDeg ?? 0,
    roofType: 'mono_pitch',
    roofPitchDeg: 22,
    secondaryPitchDeg: 85,
    overhangSouthM: 1.1,
    sawtoothCount: 3,
    skylightRatio: 0.25,
    ridgeDirection: partial.ridgeDirection ?? (partial.width >= partial.depth ? 'EW' : 'NS'),
    hasPvPanels: true,
  };

  const optRoof = recommendOptimalRoofForBlock(base, city, funcKey);
  return {
    ...base,
    roofType: optRoof.roofType,
    roofPitchDeg: optRoof.roofPitchDeg,
    secondaryPitchDeg: optRoof.secondaryPitchDeg,
    overhangSouthM: optRoof.overhangSouthM,
    sawtoothCount: optRoof.sawtoothCount,
    skylightRatio: optRoof.skylightRatio,
    hasPvPanels: optRoof.hasPvPanels,
  };
}

function calcEnvelopeAV(blocks: MassBlock[]): { av: number; footprint: number; totalArea: number } {
  let surface = 0;
  let volume = 0;
  let footprint = 0;
  let totalArea = 0;

  for (const b of blocks) {
    const h = b.floors * b.floorHeight;
    const fp = b.width * b.depth;
    footprint += fp;
    totalArea += fp * b.floors;
    volume += fp * h;
    // Üst çatı + 4 cephe (bitişik kenarlar için %12 azaltım tahmini)
    const walls = 2 * (b.width + b.depth) * h * 0.88;
    surface += fp + walls;
  }

  return {
    av: volume > 0 ? Number((surface / volume).toFixed(2)) : 0.35,
    footprint: Math.round(footprint),
    totalArea: Math.round(totalArea),
  };
}

export function generateTypologyRecommendations(
  city: CityClimateProfile,
  funcKey: BuildingFunctionKey,
  targetAreaM2: number,
  site: SiteParameters
): TypologyRecommendation[] {
  const prog = BUILDING_PROGRAMS[funcKey];
  const fh = prog.defaultFloorHeightM;

  const buildW = Math.max(24, site.parcelWidthM - site.setbackM * 2);
  const buildD = Math.max(24, site.parcelDepthM - site.setbackM * 2);
  const parcelArea = site.parcelWidthM * site.parcelDepthM;
  const maxAllowedFootprint = Math.min(buildW * buildD, parcelArea * site.maxTaks);

  // İklime göre ideal yönelim sapması (derece, Güney=0, Güneydoğu=+15)
  const recOrient =
    city.climateType === 'cold_mountain'
      ? 12
      : city.climateType === 'temperate_continental'
      ? 10
      : city.climateType === 'hot_arid'
      ? 18
      : city.climateType === 'hot_humid'
      ? -8
      : 8;

  const results: TypologyRecommendation[] = [];

  // =========================================================================
  // 1. MERKEZİ İÇ AVLULU KÜTLE (COURTYARD BLOCK)
  // =========================================================================
  {
    const wingDepth = Math.min(prog.idealMaxDepthM, Math.max(8.5, Math.min(buildW, buildD) * 0.22));
    const outerW = Math.min(buildW, Math.max(26, Math.sqrt(targetAreaM2 * 0.52)));
    const outerD = Math.min(buildD, Math.max(24, outerW * 0.86));
    const innerW = Math.max(8, outerW - wingDepth * 2);
    const innerD = Math.max(8, outerD - wingDepth * 2);
    const ringFootprint = Math.min(maxAllowedFootprint, outerW * outerD - innerW * innerD);
    const floors = Math.max(1, Math.min(8, Math.round(targetAreaM2 / Math.max(180, ringFootprint))));
    // Güney kanadını 1 kat alçak tutarak kış güneşini avluya alma opsiyonu (ılıman/soğuk iklimde)
    const southFloors =
      city.climateType === 'hot_arid' ? floors : Math.max(1, floors - (floors >= 3 ? 1 : 0));

    const blocks: MassBlock[] = [
      createConfiguredBlock(
        {
          id: 'cy_north',
          label: 'Kuzey Kanadı (Homojen Günışığı / Stüdyo)',
          role: 'north_daylight',
          x: 0,
          z: -(innerD / 2 + wingDepth / 2),
          width: outerW,
          depth: wingDepth,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'cy_south',
          label: 'Güney Kanadı (Ana Yaşam & Solar Cephe)',
          role: 'primary_living',
          x: 0,
          z: innerD / 2 + wingDepth / 2,
          width: outerW,
          depth: wingDepth,
          floors: southFloors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'cy_east',
          label: 'Doğu Kanadı (Sabah Güneşi Birimleri)',
          role: 'social_atrium',
          x: innerW / 2 + wingDepth / 2,
          z: 0,
          width: wingDepth,
          depth: innerD,
          floors,
          floorHeight: fh,
          ridgeDirection: 'NS',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'cy_west',
          label: 'Batı Kanadı (Servis & Isıl Tampon Çekirdek)',
          role: 'service_buffer',
          x: -(innerW / 2 + wingDepth / 2),
          z: 0,
          width: wingDepth,
          depth: innerD,
          floors,
          floorHeight: fh,
          ridgeDirection: 'NS',
        },
        city,
        funcKey
      ),
    ];

    const stats = calcEnvelopeAV(blocks);
    const courtArea = Math.round(innerW * innerD);
    const hwRatio = (floors * fh) / Math.max(6, Math.min(innerW, innerD));

    let thermal = 76;
    let daylight = 88;
    let vent = 78;
    let courtScore = 92;

    if (city.climateType === 'hot_arid') {
      thermal = 95;
      courtScore = 98;
      vent = 84;
    } else if (city.climateType === 'cold_mountain') {
      thermal = 68;
      courtScore = 72;
    } else if (city.climateType === 'hot_humid') {
      vent = 72; // Kapalı avlu nemli iklimde parçalı kütleden biraz daha az rüzgar alır
      thermal = 82;
    } else {
      thermal = 84;
      courtScore = 90;
    }

    if (prog.courtyardAffinity >= 9) courtScore = Math.min(99, courtScore + 5);

    const totalScore = Math.round(
      thermal * 0.3 + daylight * 0.25 + vent * 0.2 + courtScore * 0.25
    );

    results.push({
      key: 'courtyard',
      name: 'Merkezi Mikroiklim Avlulu Kütle',
      tagline: 'Gölge havuzu, rüzgar koruması ve 4 yönden dengeli günışığı sağlayan avlulu tipoloji',
      totalScore,
      thermalScore: thermal,
      daylightScore: daylight,
      ventilationScore: vent,
      courtyardComfortScore: courtScore,
      surfaceToVolumeRatio: stats.av,
      courtyardRatioHW: `H/W = ${hwRatio.toFixed(2)}`,
      recommendedOrientationDeg: recOrient,
      courtyardAreaM2: courtArea,
      footprintAreaM2: stats.footprint,
      totalBuiltAreaM2: stats.totalArea,
      taksRatio: Number((stats.footprint / parcelArea).toFixed(2)),
      kaksRatio: Number((stats.totalArea / parcelArea).toFixed(2)),
      rationale: [
        `${courtArea} m² büyüklüğündeki merkezi iç avlu (H/W = ${hwRatio.toFixed(2)}), gece serin havasını hapsederek gündüz dış ortamdan 3–5°C daha konforlu mikroiklim üretir.`,
        southFloors < floors
          ? `Güney kanadı ${southFloors} kata düşürülerek kış güneşinin avlu zeminine ve kuzey stüdyo cephesine ulaşması sağlanmıştır.`
          : `Eşit yüksekli avlu çeperi kavurucu yaz ışınımına karşı maksimum kendi kendini gölgeleme (self-shading) sağlar.`,
        `Batı kanadına servis ve ıslak hacimler yerleştirilerek öğleden sonra aşırı ısınma yükü kesilmiştir.`,
      ],
      blocks,
    });
  }

  // =========================================================================
  // 2. GÜNEYE AÇILAN U-TİPİ GÜNEŞ AVLUSU (U-SHAPED SOLAR COURT)
  // =========================================================================
  {
    const wingDepth = Math.min(prog.idealMaxDepthM, 13.0);
    const uWidth = Math.min(buildW, Math.max(26, Math.sqrt(targetAreaM2 * 0.56)));
    const uDepth = Math.min(buildD, Math.max(22, uWidth * 0.8));
    const courtW = Math.max(10, uWidth - wingDepth * 2);
    const sideLegD = Math.max(10, uDepth - wingDepth);
    const uFootprint = uWidth * wingDepth + 2 * (wingDepth * sideLegD);
    const floors = Math.max(1, Math.min(8, Math.round(targetAreaM2 / Math.max(180, uFootprint))));
    const sideFloors = Math.max(1, floors - (floors >= 4 ? 1 : 0));

    const blocks: MassBlock[] = [
      createConfiguredBlock(
        {
          id: 'u_north_main',
          label: 'Kuzey Ana Gövde (Güney Avluya Bakan Yaşam/Derslik)',
          role: 'primary_living',
          x: 0,
          z: -(uDepth / 2 - wingDepth / 2),
          width: uWidth,
          depth: wingDepth,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'u_east_wing',
          label: 'Doğu Kol (Stüdyo & Sosyal Etkileşim)',
          role: 'north_daylight',
          x: uWidth / 2 - wingDepth / 2,
          z: wingDepth / 2,
          width: wingDepth,
          depth: sideLegD,
          floors: sideFloors,
          floorHeight: fh,
          ridgeDirection: 'NS',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'u_west_wing',
          label: 'Batı Kol (Servis, İdari & Rüzgar Kalkanı)',
          role: 'service_buffer',
          x: -(uWidth / 2 - wingDepth / 2),
          z: wingDepth / 2,
          width: wingDepth,
          depth: sideLegD,
          floors: sideFloors,
          floorHeight: fh,
          ridgeDirection: 'NS',
        },
        city,
        funcKey
      ),
    ];

    const stats = calcEnvelopeAV(blocks);
    const courtArea = Math.round(courtW * sideLegD);
    const hwRatio = (floors * fh) / Math.max(8, courtW);

    let thermal = 85;
    let daylight = 91;
    let vent = 84;
    let courtScore = 90;

    if (city.climateType === 'temperate_continental' || city.climateType === 'temperate_marine') {
      thermal = 92;
      courtScore = 95;
      daylight = 93;
    } else if (city.climateType === 'cold_mountain') {
      thermal = 84;
      courtScore = 88;
    } else if (city.climateType === 'hot_arid') {
      thermal = 80;
    }

    const totalScore = Math.round(
      thermal * 0.3 + daylight * 0.25 + vent * 0.2 + courtScore * 0.25
    );

    results.push({
      key: 'u_court',
      name: 'Güneye Açılan U-Tipi Güneş Avlusu',
      tagline: 'Kuzey kış rüzgarlarına sırtını dönüp kış güneşini avluya toplayan biyoklimatik U-form',
      totalScore,
      thermalScore: thermal,
      daylightScore: daylight,
      ventilationScore: vent,
      courtyardComfortScore: courtScore,
      surfaceToVolumeRatio: stats.av,
      courtyardRatioHW: `H/W = ${hwRatio.toFixed(2)}`,
      recommendedOrientationDeg: recOrient,
      courtyardAreaM2: courtArea,
      footprintAreaM2: stats.footprint,
      totalBuiltAreaM2: stats.totalArea,
      taksRatio: Number((stats.footprint / parcelArea).toFixed(2)),
      kaksRatio: Number((stats.totalArea / parcelArea).toFixed(2)),
      rationale: [
        `Kuzeydeki yüksek ana blok kış rüzgarlarını (${city.seasons.winter.windLabel}) saptırırken, güneye açık ${courtArea} m² güneş cebi bahar ve kış dış mekan kullanım süresini 2 ay uzatır.`,
        `İnce kanat derinliği (${wingDepth.toFixed(1)} m) sayesinde mekanların %90'ında çift cepheli günışığı ve doğal havalandırma sağlanır.`,
        `${prog.title} programı için kamusal giriş ve açık etkinlik alanı doğrudan güney avlusundan kurgulanır.`,
      ],
      blocks,
    });
  }

  // =========================================================================
  // 3. KADEMELİ GEÇİRGEN PAVYON & RÜZGAR SOKAĞI (STAGGERED PAVILIONS)
  // =========================================================================
  {
    const blockDepth = Math.min(12.5, prog.idealMaxDepthM * 0.88);
    const blockW = Math.min(buildW * 0.56, Math.max(18, Math.sqrt(targetAreaM2 * 0.25)));
    const totalFp = blockW * blockDepth * 3;
    const floors = Math.max(1, Math.min(6, Math.round(targetAreaM2 / Math.max(180, totalFp))));
    const gapZ = Math.min((buildD - blockDepth * 3) / 2, 9);
    const staggerX = Math.min((buildW - blockW) * 0.35, 8);

    const blocks: MassBlock[] = [
      createConfiguredBlock(
        {
          id: 'pav_north',
          label: 'Kuzey Pavyonu (Stüdyo / Kuzey Işığı Bloku)',
          role: 'north_daylight',
          x: -staggerX,
          z: -(blockDepth + Math.max(4, gapZ)),
          width: blockW,
          depth: blockDepth,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'pav_center',
          label: 'Merkez Sosyal Pavyon & Rüzgar Boğazı',
          role: 'social_atrium',
          x: staggerX,
          z: 0,
          width: blockW * 0.92,
          depth: blockDepth,
          floors: Math.max(1, floors - 1),
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'pav_south',
          label: 'Güney Pavyonu (Ana Yaşam & Gölgeli Revak)',
          role: 'primary_living',
          x: -staggerX * 0.5,
          z: blockDepth + Math.max(4, gapZ),
          width: blockW,
          depth: blockDepth,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
    ];

    const stats = calcEnvelopeAV(blocks);
    const courtArea = Math.round(blockW * Math.max(5, gapZ) * 2);

    let thermal = 74;
    let daylight = 95;
    let vent = 97;
    let courtScore = 86;

    if (city.climateType === 'hot_humid') {
      thermal = 92;
      vent = 99;
      courtScore = 94;
    } else if (city.climateType === 'cold_mountain') {
      thermal = 54; // Yüksek A/V oranı soğuk iklimde ısı kaybını artırır
      vent = 72;
    } else if (city.climateType === 'temperate_marine') {
      thermal = 84;
      vent = 93;
    }

    const totalScore = Math.round(
      thermal * 0.32 + daylight * 0.25 + vent * 0.25 + courtScore * 0.18
    );

    results.push({
      key: 'staggered_pavilion',
      name: 'Kademeli Geçirgen Pavyon & Meltem Avluları',
      tagline: 'Deniz meltemini tüm blokların arasından geçiren yüksek gözenekli sıcak-nemli iklim kurgusu',
      totalScore,
      thermalScore: thermal,
      daylightScore: daylight,
      ventilationScore: vent,
      courtyardComfortScore: courtScore,
      surfaceToVolumeRatio: stats.av,
      courtyardRatioHW: `H/W = ${((floors * fh) / Math.max(6, gapZ + 4)).toFixed(2)}`,
      recommendedOrientationDeg: recOrient,
      courtyardAreaM2: courtArea,
      footprintAreaM2: stats.footprint,
      totalBuiltAreaM2: stats.totalArea,
      taksRatio: Number((stats.footprint / parcelArea).toFixed(2)),
      kaksRatio: Number((stats.totalArea / parcelArea).toFixed(2)),
      rationale: [
        `Şaşırtmalı (staggered) 3 ayrı pavyon dizilimi Venturi etkisi yaratarak ${city.seasons.summer.windLabel} rüzgarını iç avlu sokaklarına hızlandırarak taşır.`,
        `Dar kütle kesiti (${blockDepth.toFixed(1)} m) nem birikimini önler ve tüm mekanlara %95 doğal günışığı otonomisi kazandırır.`,
        `Bloklar arasındaki yarı-açık peyzaj koridorları yağmur suyu süzülmesi ve gölgeli dolaşım sağlar.`,
      ],
      blocks,
    });
  }

  // =========================================================================
  // 4. KOMPAKT DÜŞÜK A/V PRİZMATİK KÜTLE (COMPACT PRISM + SOLAR ATRIUM)
  // =========================================================================
  {
    const targetFloors =
      city.climateType === 'cold_mountain'
        ? Math.max(3, Math.min(7, Math.round(Math.cbrt(targetAreaM2 / 18))))
        : Math.max(2, Math.min(7, Math.round(Math.cbrt(targetAreaM2 / 22))));
    const fpNeeded = Math.min(maxAllowedFootprint, targetAreaM2 / targetFloors);
    const compW = Math.min(buildW, Math.max(16, Math.sqrt(fpNeeded * 1.32)));
    const compD = Math.min(buildD, Math.max(14, fpNeeded / compW));

    const blocks: MassBlock[] = [
      createConfiguredBlock(
        {
          id: 'comp_core',
          label: 'Kompakt Ana Kütle (Minimum Isı Kaybı Kabuğu)',
          role: 'primary_living',
          x: 0,
          z: -2,
          width: compW,
          depth: compD * 0.76,
          floors: targetFloors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'comp_sunspace',
          label: 'Güney Çift Kabuklu Kış Bahçesi / Pasif Solar Tampon',
          role: 'social_atrium',
          x: 0,
          z: compD * 0.38 + compD * 0.12 - 2,
          width: compW * 0.88,
          depth: Math.max(5.5, compD * 0.24),
          floors: Math.max(1, targetFloors - 1),
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
    ];

    const stats = calcEnvelopeAV(blocks);

    let thermal = 82;
    let daylight = 76;
    let vent = 72;
    let courtScore = 75;

    if (city.climateType === 'cold_mountain') {
      thermal = 98;
      courtScore = 90; // Kapalı kış bahçesi soğuk iklimde açık avludan çok daha işlevsel!
      daylight = 84;
    } else if (city.climateType === 'temperate_continental') {
      thermal = 88;
      courtScore = 82;
    } else if (city.climateType === 'hot_humid') {
      thermal = 62;
      vent = 60;
    }

    const totalScore = Math.round(
      thermal * 0.38 + daylight * 0.24 + vent * 0.18 + courtScore * 0.2
    );

    results.push({
      key: 'compact_prism',
      name: 'Kompakt Düşük A/V Kütle + Güney Kış Bahçesi',
      tagline: 'Minimum dış kabuk alanı ile ısı kaybını en aza indiren sert iklim ve yüksek enerji verimliliği formu',
      totalScore,
      thermalScore: thermal,
      daylightScore: daylight,
      ventilationScore: vent,
      courtyardComfortScore: courtScore,
      surfaceToVolumeRatio: stats.av,
      courtyardRatioHW: 'Kapalı Solar Atrium',
      recommendedOrientationDeg: recOrient,
      courtyardAreaM2: Math.round(compW * 0.88 * Math.max(5.5, compD * 0.24)),
      footprintAreaM2: stats.footprint,
      totalBuiltAreaM2: stats.totalArea,
      taksRatio: Number((stats.footprint / parcelArea).toFixed(2)),
      kaksRatio: Number((stats.totalArea / parcelArea).toFixed(2)),
      rationale: [
        `Düşük Yüzey/Hacim oranı (A/V = ${stats.av} m⁻¹), parçalı kütlelere kıyasla kış ısı iletim kayıplarını %28–36 oranında azaltır.`,
        `Güney cephesine eklemlenen kış bahçesi (solar atrium), pasif sera etkisiyle taze havayı ön-ısıtarak iç mekanlara aktarır.`,
        `Kuzey çeperde minimum açıklık ve yoğun taşyünü/CLT kabuk ile ${city.heatingDegreeDays} HDD ısıtma yüküne karşı maksimum koruma sağlar.`,
      ],
      blocks,
    });
  }

  // =========================================================================
  // 5. L-TİPİ RÜZGAR KALKANI & KÖŞE AVLUSU (L-SHAPED WIND SHIELD)
  // =========================================================================
  {
    const wingDepth = Math.min(prog.idealMaxDepthM, 13.5);
    const lWidth = Math.min(buildW, Math.max(24, Math.sqrt(targetAreaM2 * 0.55)));
    const lDepth = Math.min(buildD, Math.max(22, lWidth * 0.85));
    const legD = Math.max(10, lDepth - wingDepth);
    const fp = lWidth * wingDepth + wingDepth * legD;
    const floors = Math.max(1, Math.min(8, Math.round(targetAreaM2 / Math.max(160, fp))));

    // Rüzgar doğudan mı batıdan mı daha baskın? Ona göre kalkan kolu konumlandır
    const winterWindFromEast =
      city.seasons.winter.windDirectionDeg > 15 && city.seasons.winter.windDirectionDeg < 165;
    const legX = winterWindFromEast ? lWidth / 2 - wingDepth / 2 : -(lWidth / 2 - wingDepth / 2);

    const blocks: MassBlock[] = [
      createConfiguredBlock(
        {
          id: 'l_ew_bar',
          label: 'Doğu-Batı Ana Kol (Güney Cepheli Ana Mekanlar)',
          role: 'primary_living',
          x: 0,
          z: -(lDepth / 2 - wingDepth / 2),
          width: lWidth,
          depth: wingDepth,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'l_ns_shield',
          label: `${winterWindFromEast ? 'Doğu' : 'Batı'} Rüzgar Kalkanı Kol (Stüdyo & Servis)`,
          role: 'north_daylight',
          x: legX,
          z: wingDepth / 2,
          width: wingDepth,
          depth: legD,
          floors: Math.max(1, floors - (floors >= 4 ? 1 : 0)),
          floorHeight: fh,
          ridgeDirection: 'NS',
        },
        city,
        funcKey
      ),
    ];

    const stats = calcEnvelopeAV(blocks);
    const courtArea = Math.round((lWidth - wingDepth) * legD);

    const thermal = city.climateType === 'temperate_marine' ? 88 : 83;
    const daylight = 90;
    const vent = 88;
    const courtScore = 86;

    const totalScore = Math.round(
      thermal * 0.3 + daylight * 0.28 + vent * 0.22 + courtScore * 0.2
    );

    results.push({
      key: 'l_shield',
      name: 'L-Tipi Rüzgar Kalkanı & Güneş Terası',
      tagline: 'Hakim kış rüzgarını keserken güney-güneydoğu yönünde ferah açık avlu bırakan esnek L-kütle',
      totalScore,
      thermalScore: thermal,
      daylightScore: daylight,
      ventilationScore: vent,
      courtyardComfortScore: courtScore,
      surfaceToVolumeRatio: stats.av,
      courtyardRatioHW: `Açık Köşe Avlu`,
      recommendedOrientationDeg: recOrient,
      courtyardAreaM2: courtArea,
      footprintAreaM2: stats.footprint,
      totalBuiltAreaM2: stats.totalArea,
      taksRatio: Number((stats.footprint / parcelArea).toFixed(2)),
      kaksRatio: Number((stats.totalArea / parcelArea).toFixed(2)),
      rationale: [
        `Kış hakim rüzgar yönüne (${city.seasons.winter.windLabel}) göre konumlandırılan yan kol, ${courtArea} m² büyüklüğünde rüzgarsız ve güneşli bir açık avlu oluşturur.`,
        `Kendi üzerine gölge düşürmeyen 90° birleşim detayı ile hem sabah hem öğle güneşinden yüksek verim alınır.`,
        `Arsa üzerinde gelecekteki büyüme etaplarına ve açık peyzaj entegrasyonuna en yüksek esnekliği tanır.`,
      ],
      blocks,
    });
  }

  // =========================================================================
  // 6. DOĞU-BATI EKSENLİ LİNEER SOLAR BLOK (ELONGATED E-W SLAB)
  // =========================================================================
  {
    const slabDepth = Math.min(prog.idealMaxDepthM, 14.2);
    const slabWidth = Math.min(buildW, Math.max(28, slabDepth * 2.6));
    const coreW = Math.min(12, slabWidth * 0.28);
    const fp = slabWidth * slabDepth + coreW * 5;
    const floors = Math.max(1, Math.min(8, Math.round(targetAreaM2 / Math.max(160, fp))));

    const blocks: MassBlock[] = [
      createConfiguredBlock(
        {
          id: 'lin_main',
          label: 'Doğu-Batı Ana Solar Blok (Maksimum Güney/Kuzey Cephe)',
          role: 'north_daylight',
          x: 0,
          z: 2,
          width: slabWidth,
          depth: slabDepth,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
      createConfiguredBlock(
        {
          id: 'lin_north_core',
          label: 'Kuzey Servis & Sirkülasyon Tampon Çekirdeği',
          role: 'service_buffer',
          x: 0,
          z: 2 - slabDepth / 2 - 2.8,
          width: coreW,
          depth: 5.6,
          floors,
          floorHeight: fh,
          ridgeDirection: 'EW',
        },
        city,
        funcKey
      ),
    ];

    const stats = calcEnvelopeAV(blocks);
    const frontPlaza = Math.round(slabWidth * Math.max(8, (buildD - slabDepth) * 0.45));

    let thermal = 84;
    let daylight = 93;
    let vent = 89;
    let courtScore = 76;

    if (funcKey === 'office' || funcKey === 'atelier' || funcKey === 'education') {
      daylight = 96;
      thermal += 3;
    }

    const totalScore = Math.round(
      thermal * 0.32 + daylight * 0.3 + vent * 0.22 + courtScore * 0.16
    );

    results.push({
      key: 'linear_ew',
      name: 'Doğu-Batı Ekseni Lineer Solar Kütle',
      tagline: 'Minimum doğu/batı cephesi, maksimum güney kontrolü ve kuzey günışığı sağlayan rasyonel blok',
      totalScore,
      thermalScore: thermal,
      daylightScore: daylight,
      ventilationScore: vent,
      courtyardComfortScore: courtScore,
      surfaceToVolumeRatio: stats.av,
      courtyardRatioHW: 'Güney Ön Meydan',
      recommendedOrientationDeg: recOrient,
      courtyardAreaM2: frontPlaza,
      footprintAreaM2: stats.footprint,
      totalBuiltAreaM2: stats.totalArea,
      taksRatio: Number((stats.footprint / parcelArea).toFixed(2)),
      kaksRatio: Number((stats.totalArea / parcelArea).toFixed(2)),
      rationale: [
        `Uzun eksenin Doğu-Batı yönünde kurgulanması (${(slabWidth / slabDepth).toFixed(1)}:1 en-boy oranı), kontrolü en zor olan alçak açılı doğu/batı güneş yükünü minimize eder.`,
        `Çatı tamamında kesintisiz testere dişi (sawtooth) veya tek eğimli fotovoltaik dizilim için en yüksek solar verimi üretir.`,
        `Kuzey cepheye takılan servis/çekirdek tamponu ana çalışma ve yaşam hollerini ısı kaybından korur.`,
      ],
      blocks,
    });
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}
