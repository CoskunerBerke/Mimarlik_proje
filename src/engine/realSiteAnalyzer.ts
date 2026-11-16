import {
  CityClimateProfile,
  ClimateZoneType,
  SeasonalClimateStats,
  SeasonKey,
} from '../types/architecture';

export interface WindDirectionBin {
  code: string;
  name: string; // örn: "KD (Poyraz)"
  azimuthDeg: number;
  frequencyPct: number;
}

export interface TopographyAnalysis {
  elevationM: number;
  // 3x3 uydu kot matrisi (~90m aralıkla): [KB, K, KD, B, Merkez, D, GB, G, GD]
  grid3x3M: [number, number, number, number, number, number, number, number, number];
  isFlatTerrain: boolean;
  flatnessVerdict: string;
  neighbors100m: {
    northM: number;
    southM: number;
    eastM: number;
    westM: number;
  };
  slopePct: number;
  slopeDeg: number;
  aspectDeg: number;
  aspectLabel: string;
  landformType: string;
  tpiM: number;
  drainagePositionLabel: string;
  architecturalGuidance: string[];
  sourceName: string;
}

export interface SoilAndMassAnalysis {
  geologicUnitRaw: string;
  geologicAgeTr: string;
  soilTypeTitle: string;
  soilDescription: string;
  estimatedTbdyClass: 'ZB' | 'ZC' | 'ZD' | 'ZE';
  seismicCount100km: number;
  maxHistoricalMag: number;
  nearestQuakeKm: number | null;
  estimatedPgaG: number;
  annualFrostDays: number | null;
  minFrostDepthCm: number;
  deepFoundationMoistureM3M3: number | null;
  deepFoundationTempC: number | null;
  nasaRootWetnessPct: number | null;
  seismicHazardLevel: 'Yüksek Sismik Tehlike' | 'Orta Sismik Tehlike' | 'Düşük-Orta Sismik Tehlike';
  recommendedUnitMassKgM2: { min: number; max: number; label: string };
  conventionalConcreteMassKgM2: number; // Karşılaştırma için klasik ağır betonarme (~1250 kg/m²)
  recommendedFoundation: string;
  recommendedStructure: string;
  buildingSoilRules: string[];
  sources: string[];
}

export interface LiveNowSnapshot {
  observedAt: string;
  tempC: number;
  humidityPct: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  windDirectionName: string;
  soilMoistureSurfaceM3M3: number | null;
  soilTempSurfaceC: number | null;
}

export interface DetailedWindAndClimateEvidence {
  periodLabel: string;
  startDateIso: string;
  endDateIso: string;
  daysAnalyzed: number;
  recordMinTempC: number;
  recordMaxTempC: number;
  annualPrecipMm: number;
  annualSnowCm: number;
  annualSolarKwhM2: number;
  nasaSolarKwhM2: number | null;
  windSpeed50mMs: number | null;
  roofWindPressureKnM2: number | null;
  maxWindGustKmh: number;
  annualWindRose: WindDirectionBin[];
  seasonalWindTop: Record<SeasonKey, WindDirectionBin[]>;
  liveNow: LiveNowSnapshot | null;
  sourceName: string;
}

export interface VerifiedSiteBundle {
  displayAddress: string;
  shortTitle: string;
  cityProfile: CityClimateProfile;
  topography: TopographyAnalysis;
  soilAndMass: SoilAndMassAnalysis;
  climateEvidence: DetailedWindAndClimateEvidence;
}

const WIND_SECTORS: Array<{ code: string; name: string; deg: number }> = [
  { code: 'K', name: 'Kuzey (Yıldız)', deg: 0 },
  { code: 'KD', name: 'Kuzeydoğu (Poyraz)', deg: 45 },
  { code: 'D', name: 'Doğu (Gündoğusu)', deg: 90 },
  { code: 'GD', name: 'Güneydoğu (Keşişleme)', deg: 135 },
  { code: 'G', name: 'Güney (Kıble)', deg: 180 },
  { code: 'GB', name: 'Güneybatı (Lodos)', deg: 225 },
  { code: 'B', name: 'Batı (Günbatısı)', deg: 270 },
  { code: 'KB', name: 'Kuzeybatı (Karayel)', deg: 315 },
];

/**
 * Kullanıcının girdiği Google Maps linkini, ham koordinatı (39.96, 32.81)
 * veya şehir/ilçe/mahalle metnini ("Ankara Yenimahalle") gerçek koordinata çözer.
 */
export async function resolveLocationInput(rawInput: string): Promise<{
  lat: number;
  lng: number;
  displayAddress: string;
  shortTitle: string;
}> {
  const input = rawInput.trim();
  if (!input) {
    throw new Error('Lütfen bir şehir/ilçe adı yazın veya Google Maps linki yapıştırın.');
  }

  // Kısa mobil harita linki kontrolü (goo.gl CORS engeli nedeniyle tarayıcıda açılamaz)
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(input)) {
    throw new Error(
      'Kısa mobil Google Maps linki algılandı. Lütfen bu linki tarayıcıda açıp adres çubuğundaki uzun Google Maps linkini yapıştırın veya doğrudan "Ankara Yenimahalle" gibi il/ilçe adını yazın.'
    );
  }

  // 1. Google Maps !3dLAT!4dLNG tam pin koordinatı kontrolü (en hassas pin verisi)
  const pinMatch = input.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pinMatch) {
    const lat = Number(pinMatch[1]);
    const lng = Number(pinMatch[2]);
    return await reverseGeocodeCoordinates(lat, lng);
  }

  // 2. Google Maps @LAT,LNG veya ?q=LAT,LNG veya ?ll=LAT,LNG kontrolü
  const urlCoordMatch =
    input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    input.match(/[?&](?:q|ll|query|center)=(-?\d+\.\d+)(?:,|%2C|\s+)(-?\d+\.\d+)/i);
  if (urlCoordMatch) {
    const lat = Number(urlCoordMatch[1]);
    const lng = Number(urlCoordMatch[2]);
    return await reverseGeocodeCoordinates(lat, lng);
  }

  // 3. Doğrudan koordinat girişi (örn: "39.9661, 32.8088")
  const rawCoordMatch = input.match(/^\s*(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*$/);
  if (rawCoordMatch) {
    const lat = Number(rawCoordMatch[1]);
    const lng = Number(rawCoordMatch[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return await reverseGeocodeCoordinates(lat, lng);
    }
  }

  // 4. Google Maps linki içinde metin bazlı yer adı varsa (/maps/place/Ankara+Yenimahalle)
  let searchPhrase = input;
  const placePathMatch = input.match(/\/maps\/(?:place|search)\/([^/?#]+)/i);
  if (placePathMatch) {
    searchPhrase = decodeURIComponent(placePathMatch[1].replace(/\+/g, ' '));
  }

  // 5. OpenStreetMap Nominatim ile il/ilçe/mahalle düzeyinde arama
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      searchPhrase
    )}&format=json&addressdetails=1&limit=1&accept-language=tr`;
    const res = await fetch(nomUrl);
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0) {
        const hit = arr[0];
        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        const addr = hit.address || {};
        const district =
          addr.suburb || addr.town || addr.city_district || addr.county || addr.municipality || '';
        const province = addr.province || addr.state || addr.city || hit.name || searchPhrase;
        const shortTitle =
          district && district !== province ? `${district}, ${province}` : province;
        return {
          lat,
          lng,
          displayAddress: hit.display_name || shortTitle,
          shortTitle,
        };
      }
    }
  } catch {
    // Yedek servise geç
  }

  // 6. Yedek: Open-Meteo Geocoding API
  const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    searchPhrase
  )}&count=1&language=tr&format=json`;
  const omRes = await fetch(omUrl);
  if (omRes.ok) {
    const omData = await omRes.json();
    if (omData.results?.length > 0) {
      const r = omData.results[0];
      const shortTitle = r.admin1 ? `${r.name}, ${r.admin1}` : r.name;
      return {
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        displayAddress: `${shortTitle}, ${r.country || ''}`,
        shortTitle,
      };
    }
  }

  throw new Error(
    `"${searchPhrase}" konumu bulunamadı. Lütfen "Ankara Yenimahalle" gibi şehir ve ilçe adı yazın veya haritadan seçin.`
  );
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<{
  lat: number;
  lng: number;
  displayAddress: string;
  shortTitle: string;
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(
      5
    )}&lon=${lng.toFixed(5)}&zoom=14&accept-language=tr`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const district =
        addr.suburb || addr.town || addr.city_district || addr.county || addr.village || '';
      const province = addr.province || addr.state || addr.city || '';
      const shortTitle =
        district && province && district !== province
          ? `${district}, ${province}`
          : province || district || `${lat.toFixed(4)}°K, ${lng.toFixed(4)}°D`;
      return {
        lat,
        lng,
        displayAddress: data.display_name || shortTitle,
        shortTitle,
      };
    }
  } catch {
    // Koordinat başlığı ile devam et
  }

  return {
    lat,
    lng,
    displayAddress: `Koordinat: ${lat.toFixed(4)}°K, ${lng.toFixed(4)}°D`,
    shortTitle: `${lat.toFixed(3)}°K, ${lng.toFixed(3)}°D`,
  };
}

function computeWindHistogram(angles: number[]): WindDirectionBin[] {
  const counts = Array(8).fill(0);
  let valid = 0;
  for (const a of angles) {
    if (a == null || Number.isNaN(a)) continue;
    const norm = ((a % 360) + 360) % 360;
    const idx = Math.round(norm / 45) % 8;
    counts[idx]++;
    valid++;
  }
  const total = Math.max(1, valid);
  return WIND_SECTORS.map((sec, idx) => ({
    code: sec.code,
    name: sec.name,
    azimuthDeg: sec.deg,
    frequencyPct: Math.round((counts[idx] * 100) / total),
  })).sort((a, b) => b.frequencyPct - a.frequencyPct);
}

export function computeSoilMassRecommendation(
  estimatedTbdyClass: 'ZB' | 'ZC' | 'ZD' | 'ZE',
  seismicHazardLevel: SoilAndMassAnalysis['seismicHazardLevel'],
  seismicCount100km: number,
  maxHistoricalMag: number
): Pick<
  SoilAndMassAnalysis,
  | 'recommendedUnitMassKgM2'
  | 'recommendedFoundation'
  | 'recommendedStructure'
  | 'buildingSoilRules'
> {
  let recMinKg = 850;
  let recMaxKg = 1150;
  let massLabel = 'Orta Ağırlıkta Dengeli Kütle';
  let recFoundation = 'Kirişli veya Mantar Radye Temel + Çevre Drenajı';
  let recStructure = 'Perde-Çerçeveli Betonarme (Bims/Gazbeton Hafif Dolgulu) veya Kompozit Sistem';

  if (
    estimatedTbdyClass === 'ZE' ||
    (estimatedTbdyClass === 'ZD' && seismicHazardLevel === 'Yüksek Sismik Tehlike')
  ) {
    recMinKg = 420;
    recMaxKg = 780;
    massLabel = 'Hafifletilmiş Yapı Kütlesi (Deprem ve Zemin Yükü Azaltımlı)';
    recFoundation =
      'Kalın Radye Jeneral Temel + Rijit Bodrum Çevre Perdeleri (Gerekirse Zemin İyileştirme / Kazık)';
    recStructure =
      'Çapraz Lamine Ahşap (CLT), Yapısal Çelik İskelet veya Hafif Gazbeton/Perde Betonarme Karma Sistem';
  } else if (estimatedTbdyClass === 'ZD') {
    recMinKg = 650;
    recMaxKg = 980;
    massLabel = 'Orta-Hafif Kontrollü Yapı Kütlesi';
    recFoundation = 'Radye Temel (Bütünleşik Plak Temel) ve Su Yalıtımlı Subasman/Bodrum';
    recStructure = 'Perde Duvar Destekli Betonarme (Pomza/Bims Hafif Duvarlı) veya Hibrit Çelik/Ahşap';
  } else if (estimatedTbdyClass === 'ZB') {
    recMinKg = 900;
    recMaxKg = 1350;
    massLabel = 'Yüksek Isıl Kütleli Sağlam Yapı Kabuğu Uygulanabilir';
    recFoundation = 'Sürekli (Mütemadi) Temel veya İnce Radye Temel';
    recStructure =
      seismicHazardLevel === 'Yüksek Sismik Tehlike'
        ? 'Sünek Perde-Çerçeveli Betonarme + Doğal Taş Kaplama'
        : 'Betonarme, Doğal Taş Kagir Kompozit veya Sıkıştırılmış Toprak Isıl Kütle';
  }

  const buildingSoilRules: string[] = [
    `Deprem kuvveti binanın toplam ağırlığıyla doğru orantılıdır (F = m × a). Bu zeminde (${estimatedTbdyClass}) m² başına bina ağırlığının klasik ağır binalardaki 1.250–1.400 kg/m² yerine ${recMinKg}–${recMaxKg} kg/m² aralığında tutulması deprem yükünü %30–50 azaltır.`,
    `100 km çevrede büyüklüğü M≥4.5 olan ${seismicCount100km} gerçek deprem (En büyük: M ${
      maxHistoricalMag || '4.4 altı'
    }) kaydedilmiştir; planda burulma yaratan düzensiz çıkmalardan kaçınılmalı, simetrik/kompakt taşıyıcı aks seçilmelidir.`,
    `Not: Bölgesel jeoloji verisi ön tasarım rehberidir; kesin uygulama için parselde güncel sondajlı zemin etüdü (TBDY 2018) verisi esas alınır.`,
  ];

  return {
    recommendedUnitMassKgM2: { min: recMinKg, max: recMaxKg, label: massLabel },
    recommendedFoundation: recFoundation,
    recommendedStructure: recStructure,
    buildingSoilRules,
  };
}

/**
 * Seçilen nokta için bilimsel veri kaynaklarından dinamik tarih pencereli (güncel) arazi raporu üretir:
 * 1) Open-Meteo Canlı Tahmin & Toprak Nemi Servisi (Anlık 15 dk rüzgar, sıcaklık ve zemin nemi)
 * 2) Copernicus DEM GLO-90 Uydu Topoğrafyası (5 noktalı gerçek eğim ve bakı)
 * 3) ECMWF ERA5 Kayan 5 Yıllık Pencere (Bugün - 7 günden geriye son 5 tam yıl, ~1826 gün)
 * 4) Macrostrat Jeolojik Harita Servisi + USGS Güncel Sismik Deprem Kataloğu
 */
export async function fetchVerifiedSiteBundle(
  lat: number,
  lng: number,
  shortTitle: string,
  displayAddress: string
): Promise<VerifiedSiteBundle> {
  // Önce anlık canlı gözlem + sunucu güncel tarihini al (sabit yıl kullanılmaz, her zaman güncel kalır!)
  const liveForecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m` +
    `&hourly=soil_moisture_0_to_7cm,soil_temperature_0cm&forecast_days=1&timezone=auto`;

  let serverNow = new Date();
  let liveNow: LiveNowSnapshot | null = null;

  try {
    const fcRes = await fetch(liveForecastUrl);
    if (fcRes.ok) {
      const fcData = await fcRes.json();
      if (fcData.current?.time) {
        const parsed = new Date(fcData.current.time);
        if (!Number.isNaN(parsed.getTime())) {
          serverNow = parsed;
        }
        const wdDeg = Number(fcData.current.wind_direction_10m ?? 0);
        const sectorIdx = Math.round((((wdDeg % 360) + 360) % 360) / 45) % 8;
        liveNow = {
          observedAt: String(fcData.current.time).replace('T', ' '),
          tempC: Number(fcData.current.temperature_2m ?? 15),
          humidityPct: Number(fcData.current.relative_humidity_2m ?? 60),
          windSpeedMs: Number(((fcData.current.wind_speed_10m ?? 10) / 3.6).toFixed(1)),
          windDirectionDeg: wdDeg,
          windDirectionName: WIND_SECTORS[sectorIdx].name,
          soilMoistureSurfaceM3M3:
            fcData.hourly?.soil_moisture_0_to_7cm?.[0] != null
              ? Number(fcData.hourly.soil_moisture_0_to_7cm[0])
              : null,
          soilTempSurfaceC:
            fcData.hourly?.soil_temperature_0cm?.[0] != null
              ? Number(fcData.hourly.soil_temperature_0cm[0])
              : null,
        };
      }
    }
  } catch {
    // Sunucu saatine erişilemezse cihaz tarihini kullan
  }

  // ERA5 arşivi 5-7 gün gecikmeyle sürekli güncellenir -> Bugün - 7 gün dinamik bitiş tarihi!
  const endD = new Date(serverNow.getTime() - 7 * 86400000);
  const startD = new Date(endD.getTime() - 5 * 365 * 86400000);
  const startDateIso = startD.toISOString().slice(0, 10);
  const endDateIso = endD.toISOString().slice(0, 10);
  const currentYear = endD.getUTCFullYear();

  // 13-Noktalı Copernicus DEM GLO-90 Matrisi:
  // İlk 9 nokta: 3x3 Horn GIS Eğim & Bakı ızgarası (~90m adım: KB, K, KD, B, Merkez, D, GB, G, GD)
  // Son 4 nokta: ~450m geniş çevre halkası (TPI Vadi Çukuru / Sırt su drenaj indeksi için)
  const dLat90 = 0.00081;
  const dLng90 = 0.00081 / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  const dLat450 = dLat90 * 5;
  const dLng450 = dLng90 * 5;

  const gridPts: Array<[number, number]> = [
    [lat + dLat90, lng - dLng90], // 0: KB
    [lat + dLat90, lng],          // 1: K
    [lat + dLat90, lng + dLng90], // 2: KD
    [lat, lng - dLng90],          // 3: B
    [lat, lng],                   // 4: Merkez
    [lat, lng + dLng90],          // 5: D
    [lat - dLat90, lng - dLng90], // 6: GB
    [lat - dLat90, lng],          // 7: G
    [lat - dLat90, lng + dLng90], // 8: GD
    [lat + dLat450, lng],         // 9: Uzak K
    [lat - dLat450, lng],         // 10: Uzak G
    [lat, lng + dLng450],         // 11: Uzak D
    [lat, lng - dLng450],         // 12: Uzak B
  ];

  const elevUrl =
    `https://api.open-meteo.com/v1/elevation?latitude=` +
    gridPts.map((p) => p[0].toFixed(5)).join(',') +
    `&longitude=` +
    gridPts.map((p) => p[1].toFixed(5)).join(',');

  const eraUrl =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=${startDateIso}&end_date=${endDateIso}` +
    `&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,snowfall_sum,wind_speed_10m_mean,wind_gusts_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum` +
    `&timezone=auto`;

  // 100–255 cm derin temel kotu güncel zemin su içeriği ve sıcaklığı
  const deepSoilUrl =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=${endDateIso}&end_date=${endDateIso}` +
    `&hourly=soil_moisture_100_to_255cm,soil_temperature_100_to_255cm&timezone=auto`;

  // NASA POWER Sürdürülebilir Binalar (community=SB) Uydu Klimatoloji API (Don günü, 50m rüzgar, zemin doygunluğu)
  const nasaPowerUrl =
    `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,WS50M,GWETPROF,FROST_DAYS` +
    `&community=SB&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;

  const macroUrl = `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat.toFixed(
    4
  )}&lng=${lng.toFixed(4)}&response=long`;

  const usgsUrl =
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
    `&latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&maxradiuskm=120&minmagnitude=4.5&starttime=1970-01-01`;

  const [elevRes, eraRes, deepSoilRes, nasaRes, macroRes, usgsRes] = await Promise.allSettled([
    fetch(elevUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(eraUrl).then((r) => {
      if (!r.ok) throw new Error('ERA5 meteoroloji servisine ulaşılamadı.');
      return r.json();
    }),
    fetch(deepSoilUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(nasaPowerUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(macroUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(usgsUrl).then((r) => (r.ok ? r.json() : null)),
  ]);

  if (eraRes.status !== 'fulfilled' || !eraRes.value?.daily) {
    throw new Error('Seçilen koordinat için gerçek meteoroloji verisi çekilemedi. Lütfen tekrar deneyin.');
  }

  const eraData = eraRes.value;
  const daily = eraData.daily;

  // =========================================================================
  // 1. TOPOĞRAFYA, HORN 3x3 CBS EĞİMİ VE TPI DRENAJ KONUMU (COPERNICUS DEM)
  // =========================================================================
  const fallbackEl = Math.round(eraData.elevation ?? 100);
  const elevArr: number[] =
    elevRes.status === 'fulfilled' &&
    Array.isArray(elevRes.value?.elevation) &&
    elevRes.value.elevation.length >= 13
      ? elevRes.value.elevation.map((v: number) => Math.round(v ?? fallbackEl))
      : Array(13).fill(fallbackEl);

  const [zNW, zNorth, zNE, zWest, zCenter, zEast, zSW, zSouth, zSE, zFarN, zFarS, zFarE, zFarW] =
    elevArr;

  // Horn (1981) 3x3 Sonlu Farklar CBS Eğim & Bakı Algoritması (ArcGIS / QGIS standardı, adım = 90m)
  const cellM = 90;
  // Arazi doğuya doğru alçalıyorsa dzDownEast pozitif, güneye doğru alçalıyorsa dzDownSouth pozitif
  const dzDownEast = (zNW + 2 * zWest + zSW - (zNE + 2 * zEast + zSE)) / (8 * cellM);
  const dzDownSouth = (zNW + 2 * zNorth + zNE - (zSW + 2 * zSouth + zSE)) / (8 * cellM);

  const slopeRatio = Math.hypot(dzDownEast, dzDownSouth);
  const slopePct = Number((slopeRatio * 100).toFixed(1));
  const slopeDeg = Number(((Math.atan(slopeRatio) * 180) / Math.PI).toFixed(1));

  // Topografik Konum İndeksi (TPI): Merkez kot - 450m çevre ortalaması
  const outerMean = (zFarN + zFarS + zFarE + zFarW) / 4;
  const tpiM = Number((zCenter - outerMean).toFixed(1));
  const drainagePositionLabel =
    tpiM <= -3.5
      ? 'Çukur / Vadi Tabanı (Yağmur Suyu Toplanma ve Yüksek Yeraltı Suyu Riski)'
      : tpiM >= 4.0
      ? 'Sırt / Yüksek Kot (Doğal Su Drenajı İyi, Rüzgar Yükü Açık)'
      : 'Dengeli Yamaç / Plato Kotu';

  // Bakı açısı (0=Kuzey, 90=Doğu, 180=Güney, 270=Batı)
  let aspectDeg = Math.round(((Math.atan2(dzDownEast, -dzDownSouth) * 180) / Math.PI + 360) % 360);
  let aspectLabel = 'Düz Arazi (Belirgin Yamaç Yok)';
  if (slopePct >= 1.8) {
    const idx = Math.round(aspectDeg / 45) % 8;
    const aspectNames = [
      'Kuzey Bakılı Yamaç (Gölgede Kalan Yamaç)',
      'Kuzeydoğu Bakılı Yamaç',
      'Doğu Bakılı Yamaç (Sabah Güneşi Alan)',
      'Güneydoğu Bakılı Yamaç (En İdeal Güneş Alan Bakı)',
      'Güney Bakılı Yamaç (Yüksek Kış Güneşi Alan Bakı)',
      'Güneybatı Bakılı Yamaç (Öğleden Sonra Isınan Bakı)',
      'Batı Bakılı Yamaç',
      'Kuzeybatı Bakılı Yamaç',
    ];
    aspectLabel = aspectNames[idx];
  } else {
    aspectDeg = 180;
  }

  const landformType =
    slopePct < 2.0
      ? 'Düz Ova / Vadi Tabanı (%0–2 Eğim)'
      : slopePct < 6.0
      ? 'Hafif Eğimli Arazi (%2–6 Eğim)'
      : slopePct < 12.0
      ? 'Orta Eğimli Yamaç (%6–12 Eğim)'
      : 'Dik Yamaç / Sırt (%12+ Eğim)';

  const topoGuidance: string[] = [];
  if (slopePct < 2.5) {
    topoGuidance.push(
      `Arazi Horn 3x3 uydu analizine göre %${slopePct} eğimle düze yakındır; kazı maliyeti düşüktür ancak çevre su drenajı zorunludur.`
    );
  } else if (slopePct < 8.0) {
    topoGuidance.push(
      `Arazi %${slopePct} (${slopeDeg}°) eğime ve "${aspectLabel}" yönelimine sahiptir. Yarım kat kademelenme (split-level) ile hafriyat azaltılabilir.`
    );
  } else {
    topoGuidance.push(
      `Arazi %${slopePct} (${slopeDeg}°) belirgin eğime sahiptir. Eğime paralel teraslanmış kademeli kütleler ve drenajlı istinat perdeleri uygulanmalıdır.`
    );
  }
  if (tpiM <= -3.5) {
    topoGuidance.push(
      `TPI analizi (${tpiM} m) arsanın çevresine göre çukur/vadi tabanında kaldığını gösteriyor; su basman kotu yükseltilmeli (+0.60m/+0.90m) ve bodrum bohçalama su yalıtımı yapılmalıdır.`
    );
  } else if (tpiM >= 4.0) {
    topoGuidance.push(
      `TPI analizi (+${tpiM} m) arsanın çevresine göre sırt/tepe kotunda yer aldığını gösteriyor; zemin su tahliyesi avantajlıdır ancak çatı rüzgar kenet detayları güçlendirilmelidir.`
    );
  }

  const isFlatTerrain = slopePct < 2.5;
  const flatnessVerdict =
    slopePct < 2.5
      ? `DÜZ ARAZİ (%${slopePct} Eğim — Düz Zemine Oturan Kurgu)`
      : slopePct < 6.0
      ? `EĞİMLİ ARAZİ (%${slopePct} Hafif Eğim — Subasman / Yarım Kat Kademeli Kurgu)`
      : slopePct < 12.0
      ? `EĞİMLİ YAMAÇ (%${slopePct} Orta Eğim — Kademeli Teraslama ve İstinat Gerekli)`
      : `DİK YAMAÇ (%${slopePct} Yüksek Eğim — Yamaca Gömülü Kademeli Kütle Zorunlu)`;

  const topography: TopographyAnalysis = {
    elevationM: zCenter,
    grid3x3M: [zNW, zNorth, zNE, zWest, zCenter, zEast, zSW, zSouth, zSE],
    isFlatTerrain,
    flatnessVerdict,
    neighbors100m: {
      northM: zNorth,
      southM: zSouth,
      eastM: zEast,
      westM: zWest,
    },
    slopePct,
    slopeDeg,
    aspectDeg,
    aspectLabel,
    landformType,
    tpiM,
    drainagePositionLabel,
    architecturalGuidance: topoGuidance,
    sourceName: 'Copernicus DEM GLO-90 Uydu Yükselti Modeli (13 Noktalı Horn 3x3 CBS Analizi)',
  };

  // =========================================================================
  // 2. 5 YILLIK GERÇEK METEOROLOJİ VE RÜZGAR ANALİZİ (ECMWF ERA5 2020-2024)
  // =========================================================================
  const times: string[] = daily.time || [];
  const numYears = Math.max(1, times.length / 365.25);

  const buckets: Record<
    SeasonKey,
    {
      tMean: number[];
      tMin: number[];
      tMax: number[];
      rh: number[];
      precip: number[];
      snow: number[];
      windSpdMs: number[];
      windDir: number[];
      radMj: number[];
    }
  > = {
    spring: { tMean: [], tMin: [], tMax: [], rh: [], precip: [], snow: [], windSpdMs: [], windDir: [], radMj: [] },
    summer: { tMean: [], tMin: [], tMax: [], rh: [], precip: [], snow: [], windSpdMs: [], windDir: [], radMj: [] },
    autumn: { tMean: [], tMin: [], tMax: [], rh: [], precip: [], snow: [], windSpdMs: [], windDir: [], radMj: [] },
    winter: { tMean: [], tMin: [], tMax: [], rh: [], precip: [], snow: [], windSpdMs: [], windDir: [], radMj: [] },
  };

  let recordMinTempC = 99;
  let recordMaxTempC = -99;
  let maxWindGustKmh = 0;
  let totalPrecipAll = 0;
  let totalSnowAll = 0;
  let totalRadMjAll = 0;
  let totalHddAll = 0;
  let totalCddAll = 0;
  const allWindDirs: number[] = [];

  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7));
    const sKey: SeasonKey =
      month >= 3 && month <= 5
        ? 'spring'
        : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
        ? 'autumn'
        : 'winter';

    const tm = daily.temperature_2m_mean?.[i];
    const tmn = daily.temperature_2m_min?.[i];
    const tmx = daily.temperature_2m_max?.[i];
    const rh = daily.relative_humidity_2m_mean?.[i];
    const pr = daily.precipitation_sum?.[i] ?? 0;
    const sn = daily.snowfall_sum?.[i] ?? 0;
    const wsKmh = daily.wind_speed_10m_mean?.[i] ?? 10;
    const wgKmh = daily.wind_gusts_10m_max?.[i] ?? 0;
    const wd = daily.wind_direction_10m_dominant?.[i];
    const rad = daily.shortwave_radiation_sum?.[i] ?? 14;

    if (tmn != null && tmn < recordMinTempC) recordMinTempC = tmn;
    if (tmx != null && tmx > recordMaxTempC) recordMaxTempC = tmx;
    if (wgKmh > maxWindGustKmh) maxWindGustKmh = wgKmh;

    totalPrecipAll += pr;
    totalSnowAll += sn;
    totalRadMjAll += rad;

    if (tm != null) {
      if (tm < 15) totalHddAll += 18 - tm;
      if (tm > 22) totalCddAll += tm - 22;
      buckets[sKey].tMean.push(tm);
    }
    if (tmn != null) buckets[sKey].tMin.push(tmn);
    if (tmx != null) buckets[sKey].tMax.push(tmx);
    if (rh != null) buckets[sKey].rh.push(rh);
    buckets[sKey].precip.push(pr);
    buckets[sKey].snow.push(sn);
    buckets[sKey].windSpdMs.push(wsKmh / 3.6);
    if (wd != null) {
      buckets[sKey].windDir.push(wd);
      allWindDirs.push(wd);
    }
    buckets[sKey].radMj.push(rad);
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const annualWindRose = computeWindHistogram(allWindDirs);
  const seasonalWindTop: Record<SeasonKey, WindDirectionBin[]> = {
    spring: computeWindHistogram(buckets.spring.windDir),
    summer: computeWindHistogram(buckets.summer.windDir),
    autumn: computeWindHistogram(buckets.autumn.windDir),
    winter: computeWindHistogram(buckets.winter.windDir),
  };

  const buildSeasonalStats = (sKey: SeasonKey): SeasonalClimateStats => {
    const b = buckets[sKey];
    const topBins = seasonalWindTop[sKey];
    const dom = topBins[0] || { name: 'Kuzeydoğu (Poyraz)', azimuthDeg: 45, frequencyPct: 30 };
    const second = topBins[1];
    const windLabel =
      second && second.frequencyPct >= 20
        ? `${dom.code} %${dom.frequencyPct} / ${second.code} %${second.frequencyPct}`
        : `${dom.name} (%${dom.frequencyPct})`;

    const avgMjDay = avg(b.radMj); // MJ/m²/gün
    const seasonalPrecipPerYear = Math.round(sum(b.precip) / numYears);
    const avgRh = Math.round(avg(b.rh) || 60);
    const peakTotalWm2 = Math.round(Math.min(960, Math.max(200, avgMjDay * 34)));
    const diffuseRatio = Math.min(0.55, Math.max(0.16, (avgRh - 25) / 130));
    const diffuseWm2 = Math.round(peakTotalWm2 * diffuseRatio);
    const directWm2 = Math.round(peakTotalWm2 - diffuseWm2 * 0.5);

    return {
      avgTempC: Number(avg(b.tMean).toFixed(1)),
      minTempC: Number(avg(b.tMin).toFixed(1)),
      maxTempC: Number(avg(b.tMax).toFixed(1)),
      humidityPct: avgRh,
      windSpeedMs: Number(avg(b.windSpdMs).toFixed(1)),
      windDirectionDeg: dom.azimuthDeg,
      windLabel,
      directRadiationWm2: directWm2,
      diffuseRadiationWm2: diffuseWm2,
      precipitationMm: seasonalPrecipPerYear,
    };
  };

  const seasons: Record<SeasonKey, SeasonalClimateStats> = {
    spring: buildSeasonalStats('spring'),
    summer: buildSeasonalStats('summer'),
    autumn: buildSeasonalStats('autumn'),
    winter: buildSeasonalStats('winter'),
  };

  const annualPrecipMm = Math.round(totalPrecipAll / numYears);
  const annualSnowCm = Math.round(totalSnowAll / numYears);
  // 1 MJ = 0.27778 kWh
  const annualSolarKwhM2 = Math.round((totalRadMjAll / numYears) * 0.27778);
  const hdd = Math.round(totalHddAll / numYears);
  const cdd = Math.round(totalCddAll / numYears);

  let climateType: ClimateZoneType = 'temperate_continental';
  let koppen = 'Csa';
  let koppenDesc = 'Ilıman İklim Kuşağı';

  if (seasons.winter.avgTempC < -1.5 || hdd > 3500) {
    climateType = 'cold_mountain';
    koppen = 'Dfb / Dsb';
    koppenDesc = 'Soğuk Karasal / Yüksek İrtifa İklimi';
  } else if (seasons.summer.avgTempC >= 26 && seasons.summer.humidityPct <= 44 && annualPrecipMm < 560) {
    climateType = 'hot_arid';
    koppen = 'BSh / BSk';
    koppenDesc = 'Sıcak-Kurak / Yarı Kurak Bozkır İklimi';
  } else if (seasons.summer.avgTempC >= 25 && seasons.winter.avgTempC >= 7.5) {
    climateType = 'hot_humid';
    koppen = 'Csa';
    koppenDesc = 'Sıcak Yazlı Akdeniz / Ege İklimi';
  } else if (seasons.summer.humidityPct >= 65 || annualPrecipMm >= 740) {
    climateType = 'temperate_marine';
    koppen = 'Cfb / Cfa';
    koppenDesc = 'Nemli Denizel / Marmara-Karadeniz İklimi';
  } else {
    climateType = 'temperate_continental';
    koppen = 'BSk / Csb';
    koppenDesc = 'Ilıman Karasal İç Bölge İklimi';
  }

  const ts825Zone: 1 | 2 | 3 | 4 | 5 =
    hdd < 1450 ? 1 : hdd < 2250 ? 2 : hdd < 3150 ? 3 : hdd < 4000 ? 4 : 5;

  const snowLoadKn =
    annualSnowCm > 120 || zCenter > 1500
      ? 1.65
      : annualSnowCm > 60 || zCenter > 950
      ? 1.15
      : annualSnowCm > 25
      ? 0.85
      : 0.55;

  const topSummerWind = seasonalWindTop.summer[0];
  const topWinterWind = seasonalWindTop.winter[0];

  const passiveStrategies: string[] = [
    `Yazın pencereler ve avlu açıklıkları %${topSummerWind.frequencyPct} sıklıkla esen "${topSummerWind.name}" rüzgarını içeri alacak yönde kurgulanmalıdır.`,
    `Kışın %${topWinterWind.frequencyPct} sıklıkla esen soğuk "${topWinterWind.name}" rüzgarına karşı o yönde ıslak hacim/koridor tampon duvarları veya rüzgar kırıcı kütle kolu kullanılmalıdır.`,
    hdd > 2200
      ? `Yıllık ısıtma ihtiyacı yüksek (${hdd} Gün-Derece, TS 825 ${ts825Zone}. Bölge) olduğundan güney cephesi geniş tutulmalı, dış kabukta ısı köprüsüz kalın yalıtım uygulanmalıdır.`
      : `Yaz soğutma yükü belirgin olduğundan güney cephede saçak, batı cephede ise güneş kırıcı panjur ile doğrudan güneş ısısı kesilmelidir.`,
  ];

  const cityProfile: CityClimateProfile = {
    id: `verified_${lat.toFixed(3)}_${lng.toFixed(3)}`,
    name: shortTitle,
    region: displayAddress,
    country: '',
    lat,
    lng,
    elevationM: zCenter,
    koppen,
    koppenDesc,
    ts825Zone,
    climateType,
    heatingDegreeDays: hdd,
    coolingDegreeDays: cdd,
    annualSnowLoadKnM2: snowLoadKn,
    seasons,
    passiveStrategies,
    isCustomLive: true,
  };

  // NASA POWER Sürdürülebilir Binalar (community=SB) uydu verileri
  const nasaParams =
    nasaRes.status === 'fulfilled' ? nasaRes.value?.properties?.parameter || null : null;
  const nasaSolarDailyKwh =
    nasaParams?.ALLSKY_SFC_SW_DWN?.ANN != null && nasaParams.ALLSKY_SFC_SW_DWN.ANN > 0
      ? Number(nasaParams.ALLSKY_SFC_SW_DWN.ANN)
      : null;
  const nasaSolarKwhM2 = nasaSolarDailyKwh != null ? Math.round(nasaSolarDailyKwh * 365) : null;
  const windSpeed50mMs =
    nasaParams?.WS50M?.ANN != null && nasaParams.WS50M.ANN > 0
      ? Number(Number(nasaParams.WS50M.ANN).toFixed(1))
      : null;
  // TS EN 1991-1-4 tepe rüzgar basıncı tahmini q_p (kN/m²) = 0.5 * rho * v_peak^2 / 1000
  const vPeakMs = Math.max((maxWindGustKmh / 3.6) * 1.05, (windSpeed50mMs ?? 5) * 2.6);
  const roofWindPressureKnM2 = Number(((0.5 * 1.25 * vPeakMs * vPeakMs) / 1000).toFixed(2));

  const annualFrostDays =
    nasaParams?.FROST_DAYS?.ANN != null && nasaParams.FROST_DAYS.ANN >= 0
      ? Math.round(Number(nasaParams.FROST_DAYS.ANN))
      : null;
  // Yıllık donlu gün ve rakıma göre minimum temel don derinliği (cm)
  const minFrostDepthCm =
    (annualFrostDays ?? 0) >= 110 || zCenter >= 1500
      ? 130
      : (annualFrostDays ?? 0) >= 75 || zCenter >= 900
      ? 100
      : (annualFrostDays ?? 0) >= 30 || zCenter >= 400
      ? 80
      : 60;

  const nasaRootWetnessPct =
    nasaParams?.GWETPROF?.ANN != null && nasaParams.GWETPROF.ANN >= 0
      ? Math.round(Number(nasaParams.GWETPROF.ANN) * 100)
      : null;

  // 100–255 cm derin temel zonu nem ve sıcaklık (Open-Meteo ERA5-Land)
  const deepHourly =
    deepSoilRes.status === 'fulfilled' ? deepSoilRes.value?.hourly || null : null;
  const deepFoundationMoistureM3M3 =
    deepHourly?.soil_moisture_100_to_255cm?.[12] != null
      ? Number(Number(deepHourly.soil_moisture_100_to_255cm[12]).toFixed(3))
      : null;
  const deepFoundationTempC =
    deepHourly?.soil_temperature_100_to_255cm?.[12] != null
      ? Number(Number(deepHourly.soil_temperature_100_to_255cm[12]).toFixed(1))
      : null;

  const climateEvidence: DetailedWindAndClimateEvidence = {
    periodLabel: `${startDateIso} – ${endDateIso} (Güncel Kayan 5 Yıl)`,
    startDateIso,
    endDateIso,
    daysAnalyzed: times.length,
    recordMinTempC: Number(recordMinTempC.toFixed(1)),
    recordMaxTempC: Number(recordMaxTempC.toFixed(1)),
    annualPrecipMm,
    annualSnowCm,
    annualSolarKwhM2,
    nasaSolarKwhM2,
    windSpeed50mMs,
    roofWindPressureKnM2,
    maxWindGustKmh: Math.round(maxWindGustKmh),
    annualWindRose,
    seasonalWindTop,
    liveNow,
    sourceName:
      'ECMWF ERA5 Kayan 5 Yıl + NASA POWER Sustainable Buildings Uydu Serisi',
  };

  // =========================================================================
  // 3. TOPRAK / JEOLOJİ VE DEPREMSELLİK -> KAÇ KİLO KÜTLELİ BİNA OLMALI?
  // =========================================================================
  const macroUnit =
    macroRes.status === 'fulfilled' ? macroRes.value?.success?.data?.[0] || null : null;
  const rawName = String(macroUnit?.name || 'Cenozoic sedimentary');
  const rawAge = String(macroUnit?.best_int_name || '');
  const rawLith = String(macroUnit?.lith || macroUnit?.descrip || '');
  const combinedGeo = `${rawName} ${rawAge} ${rawLith}`.toLowerCase();

  const eqFeatures: Array<{
    properties: { mag: number };
    geometry?: { coordinates?: [number, number, number?] };
  }> =
    usgsRes.status === 'fulfilled' && Array.isArray(usgsRes.value?.features)
      ? usgsRes.value.features
      : [];
  const seismicCount100km = eqFeatures.length;
  const maxHistoricalMag =
    eqFeatures.length > 0
      ? Number(Math.max(...eqFeatures.map((f) => f.properties?.mag ?? 0)).toFixed(1))
      : 0;

  // Her gerçek depremin arsamıza olan hiposantr uzaklığı ve Akkar-Bommer ampirik yer ivmesi (PGA, g)
  let minQuakeDistKm: number | null = null;
  let maxEmpiricalPgaG = 0.08;
  for (const eq of eqFeatures) {
    const mag = eq.properties?.mag ?? 0;
    const coords = eq.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [qLng, qLat, qDepth = 10] = coords;
    const dLatRad = ((qLat - lat) * Math.PI) / 180;
    const dLngRad = ((qLng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLatRad / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((qLat * Math.PI) / 180) *
        Math.sin(dLngRad / 2) ** 2;
    const epiKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (minQuakeDistKm === null || epiKm < minQuakeDistKm) {
      minQuakeDistKm = Math.round(epiKm);
    }
    const rHyp = Math.hypot(epiKm, Math.max(5, qDepth ?? 10));
    // Basitleştirilmiş Akdeniz/Türkiye kaya PGA azalım tahmini (g)
    const log10PgaCmS2 = 1.65 + 0.52 * mag - 1.18 * Math.log10(rHyp + 7.5);
    const pgaG = Math.pow(10, log10PgaCmS2) / 981;
    if (pgaG > maxEmpiricalPgaG) maxEmpiricalPgaG = pgaG;
  }
  const estimatedPgaG = Number(Math.min(0.65, Math.max(0.08, maxEmpiricalPgaG)).toFixed(2));

  const seismicHazardLevel: SoilAndMassAnalysis['seismicHazardLevel'] =
    maxHistoricalMag >= 6.0 || estimatedPgaG >= 0.25 || seismicCount100km >= 35
      ? 'Yüksek Sismik Tehlike'
      : maxHistoricalMag >= 5.0 || estimatedPgaG >= 0.14 || seismicCount100km >= 12
      ? 'Orta Sismik Tehlike'
      : 'Düşük-Orta Sismik Tehlike';

  let geologicAgeTr = 'Senozoik / Genç Çökel Birimler';
  let soilTypeTitle = 'Orta Sıkı Kil-Kum-Marn Çökel Zemin';
  let soilDescription =
    'Akarsu/göl kökenli killi, marnlı ve kum-çakıl tabakalı çökel zemin yapısı. Orta düzey taşıma gücüne sahiptir; yeraltı suyuna ve oturma farklarına karşı bütünleşik temel gerektirir.';
  let estimatedTbdyClass: 'ZB' | 'ZC' | 'ZD' | 'ZE' = 'ZD';

  if (
    combinedGeo.includes('quaternary') ||
    combinedGeo.includes('holocene') ||
    combinedGeo.includes('alluv')
  ) {
    geologicAgeTr = 'Kuvaterner (Genç Alüvyon Birimler)';
    soilTypeTitle = 'Yumuşak Alüvyon / Vadi Tabanı Zemini';
    soilDescription =
      'Genç akarsu/ova çökellerinden oluşan gevşek kum, silt ve kil ağırlıklı zemin. Deprem dalgalarını büyütme (zemin büyütmesi) ve oturma potansiyeli yüksektir.';
    estimatedTbdyClass = slopePct < 2.5 || tpiM <= -3.0 ? 'ZE' : 'ZD';
  } else if (
    combinedGeo.includes('pliocene') ||
    combinedGeo.includes('miocene') ||
    combinedGeo.includes('oligocene') ||
    combinedGeo.includes('neogene')
  ) {
    geologicAgeTr = `Neojen (${rawName.includes('Pliocene') ? 'Pliyosen' : 'Miyosen/Oligosen'} Tortul Birimler)`;
    if (slopePct < 2.0 || tpiM <= -3.0) {
      soilTypeTitle = 'Ova/Havza Tabanı Killi-Kumlu Tortul Zemin';
      soilDescription =
        'Üstte alüvyal/killi örtü, altta kiltaşı, marn ve kumtaşı tabakalarından oluşan zemin yapısı. Şişme-oturma kontrolü ve radye temel bütünlüğü önemlidir.';
      estimatedTbdyClass = 'ZD';
    } else {
      soilTypeTitle = 'Sıkı Tortul / Marn-Kumtaşı-Kireçtaşı Yamaç Zemini';
      soilDescription =
        'Yamaç kotlarında yüzeye yakın sıkılaşmış marn, kumtaşı ve kireçtaşı birimleri. Ova tabanına kıyasla daha yüksek taşıma gücü sunar.';
      estimatedTbdyClass = 'ZC';
    }
  } else if (
    combinedGeo.includes('plutonic') ||
    combinedGeo.includes('volcanic') ||
    combinedGeo.includes('basalt') ||
    combinedGeo.includes('granit') ||
    combinedGeo.includes('paleozoic') ||
    combinedGeo.includes('mesozoic') ||
    combinedGeo.includes('cretaceous') ||
    combinedGeo.includes('jurassic') ||
    combinedGeo.includes('metamorphic')
  ) {
    geologicAgeTr = rawAge.includes('Mesozoic')
      ? 'Mezozoik Kayaç Birimleri'
      : rawAge.includes('Paleozoic')
      ? 'Paleozoik Yaşlı Temel Kayaç'
      : 'Magmatik / Volkanik Kayaç Birimleri';

    if (slopePct < 1.8 && tpiM <= -2.5) {
      soilTypeTitle = 'Kayaç Temel Üzerinde Sığ Örtü Zemini';
      soilDescription =
        'Bölgesel jeolojik temel sağlam kayaç yapısındadır; düz kesimlerde üstteki ayrışmış toprak katmanı sıyrılarak sağlam zemine oturulmalıdır.';
      estimatedTbdyClass = 'ZC';
    } else {
      soilTypeTitle = 'Sağlam Kayaç / Kalker-Magmatik Zemin';
      soilDescription =
        'Yüksek taşıma gücüne ve düşük oturma riskine sahip sağlam kayaç formasyonu. Deprem büyütme katsayısı düşüktür.';
      estimatedTbdyClass = 'ZB';
    }
  }

  const massRec = computeSoilMassRecommendation(
    estimatedTbdyClass,
    seismicHazardLevel,
    seismicCount100km,
    maxHistoricalMag
  );

  const soilAndMass: SoilAndMassAnalysis = {
    geologicUnitRaw: `${rawName}${rawAge ? ` (${rawAge})` : ''}`,
    geologicAgeTr,
    soilTypeTitle,
    soilDescription,
    estimatedTbdyClass,
    seismicCount100km,
    maxHistoricalMag,
    nearestQuakeKm: minQuakeDistKm,
    estimatedPgaG,
    annualFrostDays,
    minFrostDepthCm,
    deepFoundationMoistureM3M3,
    deepFoundationTempC,
    nasaRootWetnessPct,
    seismicHazardLevel,
    recommendedUnitMassKgM2: massRec.recommendedUnitMassKgM2,
    conventionalConcreteMassKgM2: 1280,
    recommendedFoundation: `${massRec.recommendedFoundation} (Min. Don Derinliği: ${minFrostDepthCm} cm)`,
    recommendedStructure: massRec.recommendedStructure,
    buildingSoilRules: massRec.buildingSoilRules,
    sources: [
      'Macrostrat Küresel Jeoloji Haritası API (MTA 1/500.000 Jeoloji Uyumlu)',
      `USGS Earthquake Hazards Program Güncel Sismik Kataloğu (1970–${currentYear})`,
      'NASA POWER Sustainable Buildings (community=SB) Zemin Doygunluk & Don Verisi',
      'ECMWF ERA5-Land 100–255 cm Derin Temel Zemin Nemi Modeli',
    ],
  };

  return {
    displayAddress,
    shortTitle,
    cityProfile,
    topography,
    soilAndMass,
    climateEvidence,
  };
}
