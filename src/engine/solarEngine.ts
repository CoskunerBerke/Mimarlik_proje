import { SeasonKey } from '../types/architecture';

export interface SolarPosition {
  altitudeDeg: number;
  azimuthDeg: number; // 0=Kuzey, 90=Doğu, 180=Güney, 270=Batı
  declinationDeg: number;
  isDaylight: boolean;
  sunriseHour: number;
  sunsetHour: number;
  dayLengthHours: number;
  shadowMultiplier: number; // H yüksekliğindeki kütlenin gölge boyu çarpanı (1 / tan(alt))
  // Three.js sahne birim vektörü (+X=Doğu, +Y=Yukarı, +Z=Güney, -Z=Kuzey)
  sunVector: { x: number; y: number; z: number };
}

export interface SeasonalSolarSummary {
  summerNoonAltDeg: number;
  equinoxNoonAltDeg: number;
  winterNoonAltDeg: number;
  optimalAnnualPvTiltDeg: number;
  optimalWinterPvTiltDeg: number;
  facadeDailyKwhM2: {
    south: number;
    north: number;
    east: number;
    west: number;
    horizontal: number;
  };
}

export const SEASON_REPRESENTATIVE_DOY: Record<SeasonKey, { doy: number; label: string; dateStr: string }> = {
  spring: { doy: 80, label: 'İlkbahar Ekinoksu', dateStr: '21 Mart' },
  summer: { doy: 172, label: 'Yaz Gündönümü', dateStr: '21 Haziran' },
  autumn: { doy: 266, label: 'Sonbahar Ekinoksu', dateStr: '23 Eylül' },
  winter: { doy: 355, label: 'Kış Gündönümü', dateStr: '21 Aralık' },
};

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function getSolarDeclinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin(DEG2RAD * ((360 / 365) * (284 + dayOfYear)));
}

export function calculateSolarPosition(
  latDeg: number,
  dayOfYear: number,
  solarHour: number
): SolarPosition {
  const phi = latDeg * DEG2RAD;
  const deltaDeg = getSolarDeclinationDeg(dayOfYear);
  const delta = deltaDeg * DEG2RAD;
  const omega = (solarHour - 12) * 15 * DEG2RAD;

  // Birim güneş vektörü (+X: Doğu, +Y: Yukarı, +Z: Güney, -Z: Kuzey)
  const sy = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
  const sx = -Math.cos(delta) * Math.sin(omega);
  const sz = Math.sin(phi) * Math.cos(delta) * Math.cos(omega) - Math.cos(phi) * Math.sin(delta);

  const clampedSy = Math.max(-1, Math.min(1, sy));
  const altitudeDeg = Math.asin(clampedSy) * RAD2DEG;

  let azimuthDeg = Math.atan2(sx, -sz) * RAD2DEG;
  if (azimuthDeg < 0) azimuthDeg += 360;

  // Gün doğumu ve batımı saat açısı: cos(omega_s) = -tan(phi)*tan(delta)
  const cosOmegaS = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)));
  const omegaSDeg = Math.acos(cosOmegaS) * RAD2DEG;
  const halfDayHours = omegaSDeg / 15;
  const sunriseHour = 12 - halfDayHours;
  const sunsetHour = 12 + halfDayHours;
  const dayLengthHours = halfDayHours * 2;

  const isDaylight = altitudeDeg > 0.5;
  const shadowMultiplier =
    altitudeDeg > 2 ? 1 / Math.tan(altitudeDeg * DEG2RAD) : altitudeDeg > 0 ? 28 : 0;

  return {
    altitudeDeg,
    azimuthDeg,
    declinationDeg: deltaDeg,
    isDaylight,
    sunriseHour,
    sunsetHour,
    dayLengthHours,
    shadowMultiplier,
    sunVector: { x: sx, y: sy, z: sz },
  };
}

export function generateSunPathArc(
  latDeg: number,
  dayOfYear: number,
  radius: number
): Array<{ x: number; y: number; z: number; hour: number }> {
  const points: Array<{ x: number; y: number; z: number; hour: number }> = [];
  for (let h = 4.5; h <= 19.5; h += 0.25) {
    const pos = calculateSolarPosition(latDeg, dayOfYear, h);
    if (pos.altitudeDeg >= 0) {
      points.push({
        x: pos.sunVector.x * radius,
        y: pos.sunVector.y * radius,
        z: pos.sunVector.z * radius,
        hour: h,
      });
    }
  }
  return points;
}

export function getSeasonalSolarSummary(
  latDeg: number,
  season: SeasonKey,
  directWm2: number,
  diffuseWm2: number
): SeasonalSolarSummary {
  const summerNoon = calculateSolarPosition(latDeg, 172, 12);
  const equinoxNoon = calculateSolarPosition(latDeg, 80, 12);
  const winterNoon = calculateSolarPosition(latDeg, 355, 12);

  const doy = SEASON_REPRESENTATIVE_DOY[season].doy;
  let southWh = 0;
  let northWh = 0;
  let eastWh = 0;
  let westWh = 0;
  let horizWh = 0;

  // Saatlik entegrasyon (05:00 - 19:00)
  for (let h = 5; h <= 19; h += 0.5) {
    const pos = calculateSolarPosition(latDeg, doy, h);
    if (!pos.isDaylight) continue;

    // Sinüzoidal gün içi ışınım zarfı
    const sinAlt = Math.max(0, pos.sunVector.y);
    const beam = directWm2 * Math.pow(sinAlt, 0.35);
    const diff = diffuseWm2 * (0.5 + 0.5 * sinAlt);

    // Yüzey normalleri (+Z=Güney, -Z=Kuzey, +X=Doğu, -X=Batı, +Y=Yatay Çatı)
    const cosSouth = Math.max(0, pos.sunVector.z);
    const cosNorth = Math.max(0, -pos.sunVector.z);
    const cosEast = Math.max(0, pos.sunVector.x);
    const cosWest = Math.max(0, -pos.sunVector.x);

    const dt = 0.5;
    southWh += (beam * cosSouth + diff * 0.5) * dt;
    northWh += (beam * cosNorth + diff * 0.5) * dt;
    eastWh += (beam * cosEast + diff * 0.5) * dt;
    westWh += (beam * cosWest + diff * 0.5) * dt;
    horizWh += (beam * sinAlt + diff) * dt;
  }

  const absLat = Math.abs(latDeg);
  const optimalAnnualPvTiltDeg = Math.round(absLat * 0.76 + 3.1);
  const optimalWinterPvTiltDeg = Math.min(65, Math.round(absLat + 14));

  return {
    summerNoonAltDeg: Number(summerNoon.altitudeDeg.toFixed(1)),
    equinoxNoonAltDeg: Number(equinoxNoon.altitudeDeg.toFixed(1)),
    winterNoonAltDeg: Number(winterNoon.altitudeDeg.toFixed(1)),
    optimalAnnualPvTiltDeg,
    optimalWinterPvTiltDeg,
    facadeDailyKwhM2: {
      south: Number((southWh / 1000).toFixed(2)),
      north: Number((northWh / 1000).toFixed(2)),
      east: Number((eastWh / 1000).toFixed(2)),
      west: Number((westWh / 1000).toFixed(2)),
      horizontal: Number((horizWh / 1000).toFixed(2)),
    },
  };
}

export function doyToTurkishDate(doy: number): string {
  const monthDays = [
    { name: 'Ocak', days: 31 },
    { name: 'Şubat', days: 28 },
    { name: 'Mart', days: 31 },
    { name: 'Nisan', days: 30 },
    { name: 'Mayıs', days: 31 },
    { name: 'Haziran', days: 30 },
    { name: 'Temmuz', days: 31 },
    { name: 'Ağustos', days: 31 },
    { name: 'Eylül', days: 30 },
    { name: 'Ekim', days: 31 },
    { name: 'Kasım', days: 30 },
    { name: 'Aralık', days: 31 },
  ];
  let rem = Math.max(1, Math.min(365, Math.round(doy)));
  for (const m of monthDays) {
    if (rem <= m.days) {
      return `${rem} ${m.name}`;
    }
    rem -= m.days;
  }
  return '31 Aralık';
}
