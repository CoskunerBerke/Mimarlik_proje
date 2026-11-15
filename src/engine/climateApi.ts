import {
  CityClimateProfile,
  ClimateZoneType,
  SeasonalClimateStats,
  SeasonKey,
} from '../types/architecture';

function degToTurkishWindLabel(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return 'Yıldız (Kuzey)';
  if (norm < 67.5) return 'Poyraz (KD)';
  if (norm < 112.5) return 'Gündoğusu (Doğu)';
  if (norm < 157.5) return 'Keşişleme (GD)';
  if (norm < 202.5) return 'Kıble (Güney)';
  if (norm < 247.5) return 'Lodos (GB)';
  if (norm < 292.5) return 'Günbatısı (Batı)';
  return 'Karayel (KB)';
}

function circularMeanDeg(angles: number[]): number {
  if (!angles.length) return 45;
  let sumSin = 0;
  let sumCos = 0;
  for (const a of angles) {
    const rad = (a * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  let mean = (Math.atan2(sumSin / angles.length, sumCos / angles.length) * 180) / Math.PI;
  if (mean < 0) mean += 360;
  return Math.round(mean);
}

export interface GeocodingResult {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation?: number;
}

export async function searchLocationByName(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed
  )}&count=6&language=tr&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Konum arama servisine ulaşılamadı.');
  const data = await res.json();
  return (data.results || []) as GeocodingResult[];
}

export async function fetchLiveClimateProfile(
  name: string,
  region: string,
  country: string,
  lat: number,
  lng: number,
  elevationFallback = 120
): Promise<CityClimateProfile> {
  // Tam bir referans meteoroloji yılı (ERA5 yeniden analiz verisi)
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&start_date=2023-01-01&end_date=2023-12-31` +
    `&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Canlı iklim verisi çekilemedi.');
  }
  const data = await res.json();
  const elevationM = Math.round(data.elevation ?? elevationFallback);
  const daily = data.daily;

  const buckets: Record<
    SeasonKey,
    {
      tMean: number[];
      tMin: number[];
      tMax: number[];
      precip: number[];
      windSpd: number[];
      windDir: number[];
      radMj: number[];
    }
  > = {
    spring: { tMean: [], tMin: [], tMax: [], precip: [], windSpd: [], windDir: [], radMj: [] },
    summer: { tMean: [], tMin: [], tMax: [], precip: [], windSpd: [], windDir: [], radMj: [] },
    autumn: { tMean: [], tMin: [], tMax: [], precip: [], windSpd: [], windDir: [], radMj: [] },
    winter: { tMean: [], tMin: [], tMax: [], precip: [], windSpd: [], windDir: [], radMj: [] },
  };

  let hdd = 0;
  let cdd = 0;

  const times: string[] = daily.time || [];
  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7));
    const season: SeasonKey =
      month >= 3 && month <= 5
        ? 'spring'
        : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
        ? 'autumn'
        : 'winter';

    const tm = daily.temperature_2m_mean?.[i] ?? 15;
    const tmn = daily.temperature_2m_min?.[i] ?? 10;
    const tmx = daily.temperature_2m_max?.[i] ?? 20;
    const pr = daily.precipitation_sum?.[i] ?? 0;
    // Open-Meteo wind_speed_10m_max km/h döner -> ortalama m/s tahmini
    const wsKmh = daily.wind_speed_10m_max?.[i] ?? 14;
    const wsMs = (wsKmh / 3.6) * 0.58;
    const wd = daily.wind_direction_10m_dominant?.[i] ?? 45;
    const rad = daily.shortwave_radiation_sum?.[i] ?? 16; // MJ/m²/gün

    if (tm < 15) hdd += 18 - tm;
    if (tm > 22) cdd += tm - 22;

    buckets[season].tMean.push(tm);
    buckets[season].tMin.push(tmn);
    buckets[season].tMax.push(tmx);
    buckets[season].precip.push(pr);
    buckets[season].windSpd.push(wsMs);
    buckets[season].windDir.push(wd);
    buckets[season].radMj.push(rad);
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const buildSeason = (s: SeasonKey): SeasonalClimateStats => {
    const b = buckets[s];
    const avgT = Number(avg(b.tMean).toFixed(1));
    const minT = Number(avg(b.tMin).toFixed(1));
    const maxT = Number(avg(b.tMax).toFixed(1));
    const precip = Math.round(sum(b.precip));
    const windDir = circularMeanDeg(b.windDir);
    const windSpd = Number(Math.max(1.8, avg(b.windSpd)).toFixed(1));
    const avgMj = avg(b.radMj);
    // MJ/m²/gün -> öğle tepe doğrudan ve yayılı ışınım tahmini (W/m²)
    const totalPeakWm2 = Math.round(Math.min(960, Math.max(220, avgMj * 34)));
    const cloudFactor = Math.min(0.55, Math.max(0.15, precip / 650));
    const diffuseWm2 = Math.round(totalPeakWm2 * (0.16 + cloudFactor * 0.38));
    const directWm2 = Math.round(totalPeakWm2 - diffuseWm2 * 0.55);
    const diurnalRange = Math.max(4, maxT - minT);
    const estHumidity = Math.round(
      Math.min(86, Math.max(24, 82 - (diurnalRange - 5) * 3.6 + precip * 0.03))
    );

    return {
      avgTempC: avgT,
      minTempC: minT,
      maxTempC: maxT,
      humidityPct: estHumidity,
      windSpeedMs: windSpd,
      windDirectionDeg: windDir,
      windLabel: degToTurkishWindLabel(windDir),
      directRadiationWm2: directWm2,
      diffuseRadiationWm2: diffuseWm2,
      precipitationMm: precip,
    };
  };

  const seasons: Record<SeasonKey, SeasonalClimateStats> = {
    spring: buildSeason('spring'),
    summer: buildSeason('summer'),
    autumn: buildSeason('autumn'),
    winter: buildSeason('winter'),
  };

  const totalPrecip =
    seasons.spring.precipitationMm +
    seasons.summer.precipitationMm +
    seasons.autumn.precipitationMm +
    seasons.winter.precipitationMm;

  let climateType: ClimateZoneType = 'temperate_continental';
  let koppen = 'Csa';
  let koppenDesc = 'Ilıman İklim Kuşağı (ERA5 Canlı Analiz)';

  if (seasons.winter.avgTempC < -2 || hdd > 3600) {
    climateType = 'cold_mountain';
    koppen = 'Dfb';
    koppenDesc = 'Soğuk Karasal / Yüksek İrtifa İklimi (Canlı ERA5)';
  } else if (seasons.summer.avgTempC >= 26 && seasons.summer.humidityPct < 42 && totalPrecip < 520) {
    climateType = 'hot_arid';
    koppen = 'BSh / BSk';
    koppenDesc = 'Sıcak-Kurak / Yarı Kurak İklim (Canlı ERA5)';
  } else if (seasons.summer.avgTempC >= 25.5 && seasons.winter.avgTempC >= 8) {
    climateType = 'hot_humid';
    koppen = 'Csa';
    koppenDesc = 'Sıcak-Nemli Akdeniz / Kıyı İklimi (Canlı ERA5)';
  } else if (seasons.summer.humidityPct >= 66 || totalPrecip >= 750) {
    climateType = 'temperate_marine';
    koppen = 'Cfb / Cfa';
    koppenDesc = 'Nemli Denizel / Geçiş İklimi (Canlı ERA5)';
  } else {
    climateType = 'temperate_continental';
    koppen = 'BSk / Csb';
    koppenDesc = 'Ilıman Karasal İklim (Canlı ERA5)';
  }

  const ts825Zone: 1 | 2 | 3 | 4 | 5 =
    hdd < 1400 ? 1 : hdd < 2200 ? 2 : hdd < 3100 ? 3 : hdd < 4000 ? 4 : 5;

  const snowLoad =
    ts825Zone === 5 ? 1.6 : ts825Zone === 4 ? 1.15 : ts825Zone === 3 ? 0.9 : ts825Zone === 2 ? 0.75 : 0.5;

  const passiveStrategies: string[] = [
    `Yaz hakim rüzgarı (${seasons.summer.windLabel}, ${seasons.summer.windSpeedMs} m/s) yönünde doğal çapraz havalandırma`,
    `Kış ısıtma yükü (${Math.round(hdd)} HDD) için TS 825 ${ts825Zone}. Bölge standartlarında ısı köprüsüz kabuk`,
    climateType === 'hot_arid'
      ? 'Yüksek gündüz-gece farkını dengeleyen gölgeli iç avlu ve yüksek ısıl kütle'
      : climateType === 'cold_mountain'
      ? 'Düşük A/V oranlı kompakt form ve güney yönelimli pasif güneş kazancı'
      : 'Güney cephede mevsimsel saçak kontrolü ve kuzeyden kamaşmasız günışığı',
  ];

  return {
    id: `live_${lat.toFixed(2)}_${lng.toFixed(2)}`,
    name,
    region: region || 'Özel Koordinat',
    country: country || '',
    lat,
    lng,
    elevationM,
    koppen,
    koppenDesc,
    ts825Zone,
    climateType,
    heatingDegreeDays: Math.round(hdd),
    coolingDegreeDays: Math.round(cdd),
    annualSnowLoadKnM2: snowLoad,
    seasons,
    passiveStrategies,
    isCustomLive: true,
  };
}
