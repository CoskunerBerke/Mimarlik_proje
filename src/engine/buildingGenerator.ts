import {
  BuildingFunctionKey,
  CityClimateProfile,
  MassBlock,
  RoofTypeKey,
} from '../types/architecture';
import { recommendOptimalRoofForBlock } from './roofEngine';

export interface DesignPresetOption {
  id: string;
  label: string;
  promptText: string;
}

export const FUNCTION_DESIGN_PRESETS: Record<BuildingFunctionKey, DesignPresetOption[]> = {
  education: [
    {
      id: 'edu_u_gym',
      label: 'U-Avlulu + Kapalı Spor Salonlu Lise',
      promptText: '3 katlı, U şeklinde güneş avlulu, yanında kapalı spor salonu olan modern lise kampüsü',
    },
    {
      id: 'edu_courtyard',
      label: 'Merkezi İç Avlulu 4 Katlı Okul',
      promptText: '4 katlı, ortası geniş iç avlulu, ahşap güneş kırıcılı eğitim binası',
    },
    {
      id: 'edu_low_eco',
      label: '2 Katlı Yatay Ekokampüs',
      promptText: '2 katlı yatay yerleşimli, yeşil çatılı ve ahşap cepheli doğa dostu okul',
    },
    {
      id: 'edu_compact',
      label: 'Kompakt Kentsel Lise + Konferans',
      promptText: '4 katlı kompakt blok ve bitişiğinde konferans salonu olan taş cepheli lise',
    },
  ],
  religious: [
    {
      id: 'rel_classic_1',
      label: 'Kubbeli & Şadırvan Avlulu Cami',
      promptText: 'Merkezi kubbeli, revaklı şadırvan avlulu ve tek minareli taş cami',
    },
    {
      id: 'rel_classic_2',
      label: 'Çift Minareli Büyük Külliye Camisi',
      promptText: 'Büyük kubbeli, çift minareli, geniş revaklı avlulu ve kütüphaneli cami külliyesi',
    },
    {
      id: 'rel_modern',
      label: 'Modern Çağdaş Mimarili Cami',
      promptText: 'Modern prizmatik eğimli çatılı, tek zarif minareli, beyaz taş cepheli çağdaş cami',
    },
  ],
  villa: [
    {
      id: 'vil_pool_l',
      label: '2 Katlı L-Planlı & Havuzlu Villa',
      promptText: '2 katlı, L şeklinde, güney terasında yüzme havuzu ve pergolası olan modern villa',
    },
    {
      id: 'vil_stone_1',
      label: 'Tek Katlı Taş Kırsal Ev',
      promptText: 'Tek katlı, doğal taş cepheli, kiremit beşik çatılı ve verandalı müstakil ev',
    },
    {
      id: 'vil_modern_flat',
      label: 'Modern Teras Çatılı Cam Villa',
      promptText: '2 katlı, düz yeşil teras çatılı, geniş cam cepheli modern ev',
    },
  ],
  residential: [
    {
      id: 'res_court',
      label: 'İç Bahçeli Balkonlu Konut Sitesi',
      promptText: '4 katlı, balkonlu, ortasında ortak peyzaj avlusu olan konut blokları',
    },
    {
      id: 'res_mid',
      label: '6 Katlı Modern Apartman Bloğu',
      promptText: '6 katlı, geniş güney balkonlu ve zemin giriş saçaklı modern apartman',
    },
    {
      id: 'res_low',
      label: '3 Katlı Kiremit Çatılı Aile Konutu',
      promptText: '3 katlı, beşik çatılı, tuğla ve beyaz sıva cepheli sıcak konut yerleşimi',
    },
  ],
  healthcare: [
    {
      id: 'med_podium',
      label: 'Poliklinik Bazalı + Yatak Kuleli Hastane',
      promptText: '2 katlı poliklinik bazası üzerinde 5 katlı hasta yatak bloğu ve şifa avlusu olan hastane',
    },
    {
      id: 'med_low',
      label: '2 Katlı Yatay Rehabilitasyon Kliniği',
      promptText: '2 katlı, iç bahçeli, yeşil çatılı sakin poliklinik ve rehabilitasyon merkezi',
    },
  ],
  sports: [
    {
      id: 'spt_vault',
      label: 'Kemer Çatılı Kapalı Spor Salonu',
      promptText: 'Geniş açıklıklı tonoz kemer çatılı ana spor holü ve camlı giriş fuayesi',
    },
    {
      id: 'spt_pool',
      label: 'Olimpik Yüzme Havuzu & Spor Kompleksi',
      promptText: 'Tonoz çatılı kapalı yüzme havuzu, açık havuz terası ve fitness bloğu',
    },
  ],
  hotel: [
    {
      id: 'htl_resort',
      label: 'Avlulu & Havuzlu Butik Otel',
      promptText: '3 katlı balkonlu U şeklinde oda kanatları ve ortada açık yüzme havuzlu butik otel',
    },
    {
      id: 'htl_urban',
      label: '5 Katlı Şehir Oteli + Teras Restoran',
      promptText: '5 katlı modern cam cepheli şehir oteli ve zemin lobi bazası',
    },
  ],
  kindergarten: [
    {
      id: 'knd_u',
      label: 'Tek Katlı U-Oyun Avlulu Anaokulu',
      promptText: 'Tek katlı, ahşap cepheli, U şeklinde güvenli orta oyun bahçeli anaokulu',
    },
    {
      id: 'knd_2f',
      label: '2 Katlı Kış Bahçeli Kreş',
      promptText: '2 katlı, beşik çatılı ve aydınlık orta oyun avlulu kreş binası',
    },
  ],
  dormitory: [
    {
      id: 'drm_u',
      label: '4 Katlı U-Avlulu Öğrenci Yurdu',
      promptText: '4 katlı, U şeklinde sosyal avlulu, etüt salonlu ve yemekhaneli öğrenci yurdu',
    },
    {
      id: 'drm_blocks',
      label: '2 Bloklu Kampüs Yurdu + Sosyal Merkez',
      promptText: '5 katlı balkonlu yurt blokları ve ortada tek katlı sosyal yemekhane pavyonu',
    },
  ],
  library: [
    {
      id: 'lib_saw',
      label: 'Kuzey Işıklıklı Modern Kütüphane',
      promptText: '3 katlı, testere dişi kuzey çatı ışıklıklı, okuma avlulu modern kütüphane',
    },
    {
      id: 'lib_stone',
      label: 'Merkezi Avlulu Taş Medyatek',
      promptText: '2 katlı, merkezi sessiz okuma bahçeli, doğal taş cepheli kütüphane',
    },
  ],
  cultural: [
    {
      id: 'cul_museum',
      label: 'Testere Çatılı Müze + Oditoryum',
      promptText: 'Kuzey ışıklıklı sergi salonları, cam fuaye ve sağır konferans/oditoryum salonu olan kültür merkezi',
    },
    {
      id: 'cul_court',
      label: 'Etkinlik Avlulu Sanat Merkezi',
      promptText: '3 katlı, açık sergi avlulu ve geniş saçaklı çağdaş kültür merkezi',
    },
  ],
  office: [
    {
      id: 'off_atrium',
      label: '4 Katlı Atriumlu Teknokent Ofisi',
      promptText: '4 katlı, cam cepheli, güneş kırıcılı ve orta avlulu Ar-Ge ofis binası',
    },
    {
      id: 'off_tower',
      label: '7 Katlı Kentsel İş Merkezi',
      promptText: '7 katlı, yatay baza üzerinde yükselen modern ofis bloğu',
    },
  ],
  commercial: [
    {
      id: 'com_bazaar',
      label: '2 Katlı Revaklı Açık Çarşı & Gastronomi',
      promptText: '2 katlı, revaklı avlu etrafında dükkanlar ve gölgeli restoran terasları olan çarşı',
    },
  ],
  public_gov: [
    {
      id: 'gov_plaza',
      label: 'Meydan Avlulu + Meclis Salonlu Belediye',
      promptText: '4 katlı U-formlu hizmet binası ve önünde meclis/nikah salonu olan kamu yapısı',
    },
  ],
  transport: [
    {
      id: 'trp_term',
      label: 'Tonoz Çatılı Terminal + Peron Kanopisi',
      promptText: 'Geniş kemer çatılı yolcu holü ve önünde uzun güneş panelli peron saçakları olan otogar',
    },
  ],
  atelier: [
    {
      id: 'atl_shed',
      label: 'Kuzey Işıklıklı Tasarım & Üretim Kampüsü',
      promptText: 'Testere dişi çatılı yüksek üretim atölyesi ve önünde 2 katlı tasarım ofisi',
    },
  ],
  industrial: [
    {
      id: 'ind_hall',
      label: 'Geniş Açıklıklı Fabrika + İdari Ofis Bloğu',
      promptText: 'Yüksek tavanlı testere çatılı üretim holü ve güney cephede 2 katlı idari ofis bloğu',
    },
  ],
  agro: [
    {
      id: 'agr_winery',
      label: 'Taş Mahzenli & Avlulu Zeytinyağı/Şarap İşliği',
      promptText: 'Doğal taş cepheli üretim ve serin mahzen bloğu ile güneyde tadım terası olan tarım yapısı',
    },
  ],
  mixed: [
    {
      id: 'mix_podium',
      label: 'Zemin Çarşı Bazalı + Üst Konut/Ofis Blokları',
      promptText: 'Zeminde revaklı ticari çarşı avlusu, üstte 4 katlı balkonlu konut ve ofis blokları',
    },
  ],
  custom: [
    {
      id: 'cst_court',
      label: 'Avlulu Çok Amaçlı Kampüs',
      promptText: '3 katlı, U şeklinde iç avlulu, geniş saçaklı ve doğal taş/ahşap cepheli yapı',
    },
  ],
};

function makeBlk(
  partial: Partial<MassBlock> & {
    id: string;
    label: string;
    width: number;
    depth: number;
    floors: number;
    floorHeight: number;
  },
  city: CityClimateProfile,
  funcKey: BuildingFunctionKey
): MassBlock {
  const base: MassBlock = {
    id: partial.id,
    label: partial.label,
    role: partial.role ?? 'primary_living',
    x: partial.x ?? 0,
    z: partial.z ?? 0,
    width: Number(partial.width.toFixed(1)),
    depth: Number(partial.depth.toFixed(1)),
    floors: Math.max(1, Math.round(partial.floors)),
    floorHeight: partial.floorHeight,
    rotationDeg: partial.rotationDeg ?? 0,
    roofType: partial.roofType ?? 'gable',
    roofPitchDeg: partial.roofPitchDeg ?? 24,
    secondaryPitchDeg: partial.secondaryPitchDeg ?? 85,
    overhangSouthM: partial.overhangSouthM ?? 1.0,
    sawtoothCount: partial.sawtoothCount ?? 3,
    skylightRatio: partial.skylightRatio ?? 0.25,
    ridgeDirection: partial.ridgeDirection ?? (partial.width >= partial.depth ? 'EW' : 'NS'),
    hasPvPanels: partial.hasPvPanels ?? false,
    specialFeature: partial.specialFeature,
    glazingStyle: partial.glazingStyle ?? 'punched',
    customWallHex: partial.customWallHex,
    customRoofHex: partial.customRoofHex,
  };

  if (!partial.roofType) {
    const opt = recommendOptimalRoofForBlock(base, city, funcKey);
    base.roofType = opt.roofType;
    base.roofPitchDeg = opt.roofPitchDeg;
    base.overhangSouthM = opt.overhangSouthM;
  }
  return base;
}

/**
 * Her bina türü için GERÇEKÇİ mimari oranlara, yüksekliğe ve özel elemanlara (kubbe, minare,
 * şadırvan, spor salonu tonozu, hastane bazası, villa verandası, apartman balkonu vb.) sahip
 * 3D kütle grubu ve kullanıcının yazdığı Türkçe açıklamaya göre özelleştirme üretir.
 */
export function buildRealisticArchitecturalMassing(
  funcKey: BuildingFunctionKey,
  city: CityClimateProfile,
  targetAreaM2: number,
  userPrompt: string
): {
  blocks: MassBlock[];
  courtyardAreaM2: number;
  orientationDeg: number;
  appliedNotes: string[];
} {
  const p = userPrompt.toLowerCase();
  const appliedNotes: string[] = [];

  // 1. Kullanıcı metninden kat adedi yakalama ("4 katlı", "tek katlı", "iki katlı" vb.)
  let promptFloors: number | null = null;
  const numFloorMatch = p.match(/(\d+)\s*kat/);
  if (numFloorMatch) {
    promptFloors = Math.max(1, Math.min(12, Number(numFloorMatch[1])));
  } else if (p.includes('tek kat')) {
    promptFloors = 1;
  } else if (p.includes('iki kat')) {
    promptFloors = 2;
  } else if (p.includes('üç kat')) {
    promptFloors = 3;
  } else if (p.includes('dört kat')) {
    promptFloors = 4;
  } else if (p.includes('beş kat')) {
    promptFloors = 5;
  }
  if (promptFloors !== null) {
    appliedNotes.push(`Kat yüksekliği isteğinize göre ${promptFloors} kat olarak ayarlandı.`);
  }

  // 2. Kullanıcı metninden cephe malzemesi / renk yakalama
  let wallHexOverride: string | undefined;
  let roofHexOverride: string | undefined;
  if (p.includes('tuğla') || p.includes('terrakotta') || p.includes('kırmızı')) {
    wallHexOverride = '#B65E45';
    appliedNotes.push('Dış cephede pişmiş toprak / tuğla dokusu uygulandı.');
  } else if (p.includes('ahşap')) {
    wallHexOverride = '#C19363';
    appliedNotes.push('Dış cephede doğal yapısal ahşap / güneş kırıcı dokusu uygulandı.');
  } else if (p.includes('taş') || p.includes('bazalt') || p.includes('kalker')) {
    wallHexOverride = p.includes('bazalt') ? '#57534E' : '#DDD6C5';
    appliedNotes.push('Dış cephede yerel doğal taş dokusu uygulandı.');
  } else if (p.includes('beyaz')) {
    wallHexOverride = '#F5F4F0';
    appliedNotes.push('Yüksek güneş yansıtıcılıklı beyaz mimari cephe uygulandı.');
  } else if (/(?:^|[\s,])(?:cam|camlı)(?:\s+cephe|[\s,]|$)|giydirme/.test(p)) {
    wallHexOverride = '#CBD5E1';
    appliedNotes.push('Şeffaf modern giydirme cam cephe dili uygulandı.');
  }

  if (p.includes('kiremit')) {
    roofHexOverride = '#A94A2E';
    appliedNotes.push('Çatı kaplamasında geleneksel kiremit tonu seçildi.');
  } else if (p.includes('kurşun') || p.includes('bakır')) {
    roofHexOverride = '#475569';
  }

  // 3. Kullanıcı metninden çatı tercihi yakalama
  let promptRoof: RoofTypeKey | null = null;
  if (p.includes('yeşil çatı') || p.includes('bahçe çatı')) {
    promptRoof = 'flat_green';
    appliedNotes.push('İsteğinize göre ekstansif yeşil teras çatı uygulandı.');
  } else if (p.includes('düz çatı') || p.includes('teras çatı')) {
    promptRoof = 'flat_green';
    appliedNotes.push('Düz teras çatı ve parapet detayı uygulandı.');
  } else if (p.includes('beşik çatı') || p.includes('kiremit çatı')) {
    promptRoof = 'gable';
    appliedNotes.push('Eğimli beşik çatı formu uygulandı.');
  } else if (p.includes('testere')) {
    promptRoof = 'sawtooth';
    appliedNotes.push('Testere dişi kuzey ışıklığı çatısı uygulandı.');
  } else if (p.includes('tonoz') || p.includes('kemer')) {
    promptRoof = 'barrel_vault';
    appliedNotes.push('Geniş açıklıklı kemer/tonoz çatı örtüsü uygulandı.');
  } else if (p.includes('tek eğim')) {
    promptRoof = 'mono_pitch';
    appliedNotes.push('Tek eğimli solar çatı uygulandı.');
  }

  const wantsPool = p.includes('havuz');
  const wantsGym = p.includes('spor salon') || p.includes('kapalı spor') || p.includes('jimnastik');
  const wantsAuditorium = p.includes('konferans') || p.includes('oditoryum') || p.includes('tiyatro');
  const wantsTwinMinaret = p.includes('çift minare') || p.includes('iki minare') || p.includes('2 minare');
  const wantsNoMinaret = p.includes('minaresiz');
  const wantsModernMosque = p.includes('modern cami') || p.includes('çağdaş cami') || p.includes('kubbesiz');

  let blocks: MassBlock[] = [];
  let courtyardAreaM2 = 240;
  let orientationDeg = city.climateType === 'hot_humid' ? -6 : 10;

  // =========================================================================
  // TİP 1: CAMİ / İBADETHANE / KÜLLİYE (GERÇEK CAMİ ORANLARI, KUBBE, ŞADIRVAN, MİNARE)
  // =========================================================================
  if (funcKey === 'religious') {
    // Türkiye için Kıble (Güney-Güneydoğu ~15°–22°) yönelimi
    orientationDeg = Math.round(Math.max(8, Math.min(28, (39.8 - city.lng) * -0.9 + 16)));
    const harimSide = Math.max(14, Math.min(30, Math.sqrt(targetAreaM2 * 0.48)));
    const harimH = Math.max(9.5, Math.min(14.5, harimSide * 0.54));
    const courtDepth = Math.max(12, harimSide * 0.85);
    const revakW = 4.2;

    // Ana Harim Kütlesi (Güney/Kıble tarafında)
    blocks.push(
      makeBlk(
        {
          id: 'mosque_harim',
          label: 'Harim (Ana İbadet Salonu)',
          role: 'primary_living',
          x: 0,
          z: courtDepth / 2 + 1,
          width: harimSide,
          depth: harimSide,
          floors: 1,
          floorHeight: harimH,
          roofType: wantsModernMosque ? 'mono_pitch' : 'dome',
          roofPitchDeg: wantsModernMosque ? 22 : 36,
          overhangSouthM: 0.8,
          glazingStyle: wantsModernMosque ? 'curtain_wall' : 'arched_classic',
          customWallHex: wallHexOverride ?? '#EAE3D2',
          customRoofHex: roofHexOverride ?? '#4B5563',
        },
        city,
        funcKey
      )
    );

    // Son Cemaat Yeri & Kuzey-Doğu-Batı Revaklı Şadırvan Avlusu
    const totalCourtW = harimSide + revakW * 0.5;
    blocks.push(
      makeBlk(
        {
          id: 'mosque_north_portico',
          label: 'Kuzey Avlu Giriş Revakı & Derslik/Kütüphane',
          role: 'north_daylight',
          x: 0,
          z: -(courtDepth / 2 + revakW / 2 - 1),
          width: totalCourtW,
          depth: revakW + 1.2,
          floors: 1,
          floorHeight: 4.4,
          roofType: 'flat_green',
          specialFeature: 'arcade',
          glazingStyle: 'arched_classic',
          customWallHex: wallHexOverride ?? '#E6DFCE',
          customRoofHex: '#64748B',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'mosque_east_portico',
          label: 'Doğu Avlu Revakı',
          role: 'social_atrium',
          x: totalCourtW / 2 - revakW / 2,
          z: 1 - harimSide * 0.22,
          width: revakW,
          depth: courtDepth,
          floors: 1,
          floorHeight: 4.2,
          roofType: 'flat_green',
          specialFeature: 'arcade',
          glazingStyle: 'arched_classic',
          customWallHex: wallHexOverride ?? '#E6DFCE',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'mosque_west_portico',
          label: 'Batı Avlu Revakı & Abdesthane',
          role: 'service_buffer',
          x: -(totalCourtW / 2 - revakW / 2),
          z: 1 - harimSide * 0.22,
          width: revakW,
          depth: courtDepth,
          floors: 1,
          floorHeight: 4.2,
          roofType: 'flat_green',
          specialFeature: 'arcade',
          glazingStyle: 'arched_classic',
          customWallHex: wallHexOverride ?? '#E6DFCE',
        },
        city,
        funcKey
      ),
      // Avlu Ortasında Şadırvan
      makeBlk(
        {
          id: 'mosque_sadirvan',
          label: 'Merkezi Avlu Şadırvanı',
          role: 'social_atrium',
          x: 0,
          z: 1 - harimSide * 0.22,
          width: 4.8,
          depth: 4.8,
          floors: 1,
          floorHeight: 3.4,
          roofType: 'dome',
          specialFeature: 'sadirvan',
          customWallHex: '#DED6C4',
          customRoofHex: '#4B5563',
        },
        city,
        funcKey
      )
    );

    // Minare(ler)
    if (!wantsNoMinaret) {
      const minH = Math.max(22, harimH * 2.15);
      blocks.push(
        makeBlk(
          {
            id: 'mosque_minaret_1',
            label: 'Sağ Minare',
            role: 'circulation_core',
            x: -(harimSide / 2 + 1.9),
            z: courtDepth / 2 - harimSide / 2 + 2.2,
            width: 2.8,
            depth: 2.8,
            floors: 1,
            floorHeight: minH,
            roofType: 'dome',
            specialFeature: 'minaret',
            customWallHex: wallHexOverride ?? '#EAE3D2',
            customRoofHex: '#334155',
          },
          city,
          funcKey
        )
      );

      if (wantsTwinMinaret || targetAreaM2 >= 2600) {
        blocks.push(
          makeBlk(
            {
              id: 'mosque_minaret_2',
              label: 'Sol Minare',
              role: 'circulation_core',
              x: harimSide / 2 + 1.9,
              z: courtDepth / 2 - harimSide / 2 + 2.2,
              width: 2.8,
              depth: 2.8,
              floors: 1,
              floorHeight: minH,
              roofType: 'dome',
              specialFeature: 'minaret',
              customWallHex: wallHexOverride ?? '#EAE3D2',
              customRoofHex: '#334155',
            },
            city,
            funcKey
          )
        );
        if (wantsTwinMinaret) {
          appliedNotes.push('İsteğinize göre harimin iki yanına çift minare yerleştirildi.');
        }
      }
    }

    courtyardAreaM2 = Math.round((totalCourtW - revakW * 2) * courtDepth);
  }

  // =========================================================================
  // TİP 2: MÜSTAKİL VİLLA / EV (1-2 KATLI GERÇEK EV ÖLÇEĞİ + VERANDA + HAVUZ)
  // =========================================================================
  else if (funcKey === 'villa') {
    const fl = promptFloors ?? (targetAreaM2 <= 220 ? 1 : 2);
    const scaledArea = Math.min(1200, Math.max(140, targetAreaM2));
    const mainW = Math.max(10, Math.min(20, Math.sqrt((scaledArea / fl) * 1.15)));
    const mainD = Math.max(7.5, Math.min(12, mainW * 0.68));
    const defRoof: RoofTypeKey =
      promptRoof ?? (city.climateType === 'hot_arid' ? 'flat_green' : 'gable');

    blocks.push(
      makeBlk(
        {
          id: 'villa_main',
          label: 'Ana Yaşam & Yatak Evi Kütlesi',
          role: 'primary_living',
          x: -2,
          z: -4,
          width: mainW,
          depth: mainD,
          floors: fl,
          floorHeight: 3.2,
          roofType: defRoof,
          roofPitchDeg: defRoof === 'gable' ? 25 : 6,
          overhangSouthM: 1.3,
          specialFeature: fl >= 2 ? 'balconies' : undefined,
          customWallHex: wallHexOverride ?? '#F2EFE9',
          customRoofHex: roofHexOverride ?? '#9A462D',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'villa_wing',
          label: 'Misafir / Çalışma Yan Kanadı',
          role: 'north_daylight',
          x: mainW / 2 - 2,
          z: mainD / 2 + 1,
          width: Math.max(6.5, mainD * 0.8),
          depth: Math.max(7, mainD * 0.9),
          floors: Math.max(1, fl - 1),
          floorHeight: 3.2,
          roofType: defRoof,
          roofPitchDeg: defRoof === 'gable' ? 25 : 6,
          overhangSouthM: 1.1,
          customWallHex: wallHexOverride ?? '#E6DFD3',
          customRoofHex: roofHexOverride ?? '#9A462D',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'villa_veranda',
          label: 'Güney Bahçe Verandası (Pergola)',
          role: 'social_atrium',
          x: -3.5,
          z: mainD / 2 + 0.5,
          width: mainW * 0.65,
          depth: 4.2,
          floors: 1,
          floorHeight: 3.0,
          roofType: 'louver_canopy',
          roofPitchDeg: 20,
          customWallHex: '#8C6239',
          customRoofHex: '#78502B',
        },
        city,
        funcKey
      )
    );

    if (wantsPool || city.climateType === 'hot_humid') {
      blocks.push(
        makeBlk(
          {
            id: 'villa_pool',
            label: 'Açık Yüzme Havuzu & Güneşlenme Terası',
            role: 'social_atrium',
            x: -3.5,
            z: mainD / 2 + 7.2,
            width: Math.max(8, mainW * 0.6),
            depth: 4.5,
            floors: 1,
            floorHeight: 0.4,
            roofType: 'flat_green',
            specialFeature: 'outdoor_pool',
          },
          city,
          funcKey
        )
      );
    }
    courtyardAreaM2 = Math.round(mainW * 10);
  }

  // =========================================================================
  // TİP 3: OKUL / LİSE / ÜNİVERSİTE / ANAOKULU KAMPÜSÜ
  // =========================================================================
  else if (funcKey === 'education' || funcKey === 'kindergarten') {
    const defaultFl = funcKey === 'kindergarten' ? (targetAreaM2 > 1800 ? 2 : 1) : 3;
    const fl = promptFloors ?? defaultFl;
    const fh = funcKey === 'kindergarten' ? 3.5 : 3.8;
    const isLShape = p.includes('l şek') || p.includes('l tip') || p.includes('l plan');
    const isClosedCourt =
      p.includes('iç avlu') || p.includes('merkezi avlu') || p.includes('ortası');
    const isCompact = p.includes('kompakt') || p.includes('tek blok');
    const wingW = Math.max(22, Math.min(44, Math.sqrt((targetAreaM2 / fl) * 0.95)));
    const wingD = funcKey === 'kindergarten' ? 10.5 : 12.5;
    const clsRoof: RoofTypeKey =
      promptRoof ?? (city.annualSnowLoadKnM2 >= 0.9 ? 'gable' : 'mono_pitch');

    if (isCompact) {
      blocks.push(
        makeBlk(
          {
            id: 'edu_compact_main',
            label: 'Ana Eğitim & Derslik Bloğu',
            role: 'primary_living',
            x: -6,
            z: 0,
            width: wingW,
            depth: wingD + 4,
            floors: fl,
            floorHeight: fh,
            roofType: clsRoof,
            overhangSouthM: 1.2,
            specialFeature: 'entrance_canopy',
            customWallHex: wallHexOverride ?? '#EFECE4',
            customRoofHex: roofHexOverride ?? '#475569',
          },
          city,
          funcKey
        )
      );
      appliedNotes.push('Kompakt tekil eğitim bloğu şeması oluşturuldu.');
    } else if (isLShape) {
      blocks.push(
        makeBlk(
          {
            id: 'edu_l_south',
            label: 'Güney Derslik Kanadı',
            role: 'primary_living',
            x: -4,
            z: -8,
            width: wingW,
            depth: wingD,
            floors: fl,
            floorHeight: fh,
            roofType: clsRoof,
            overhangSouthM: 1.2,
            customWallHex: wallHexOverride ?? '#EFECE4',
            customRoofHex: roofHexOverride ?? '#475569',
          },
          city,
          funcKey
        ),
        makeBlk(
          {
            id: 'edu_l_west',
            label: 'Laboratuvar & İdari Kanat',
            role: 'north_daylight',
            x: -(wingW / 2 - wingD / 2) - 4,
            z: 6,
            width: wingD,
            depth: 18,
            floors: fl,
            floorHeight: fh,
            roofType: promptRoof ?? 'sawtooth',
            customWallHex: wallHexOverride ?? '#E5E0D5',
            customRoofHex: roofHexOverride ?? '#475569',
          },
          city,
          funcKey
        )
      );
      appliedNotes.push('İsteğinize göre L-planlı eğitim avlusu kurgulandı.');
    } else {
      // Varsayılan U-Avlulu Kampüs (Derslik Kanatları + Camlı Giriş Omurgası)
      blocks.push(
        makeBlk(
          {
            id: 'edu_north_wing',
            label: 'Kuzey Ana Derslik & Stüdyo Bloğu',
            role: 'primary_living',
            x: -5,
            z: -11,
            width: wingW,
            depth: wingD,
            floors: fl,
            floorHeight: fh,
            roofType: clsRoof,
            overhangSouthM: 1.2,
            customWallHex: wallHexOverride ?? '#EFECE4',
            customRoofHex: roofHexOverride ?? '#475569',
          },
          city,
          funcKey
        ),
        makeBlk(
          {
            id: 'edu_west_wing',
            label: 'Batı Laboratuvar & İdari Kanadı',
            role: 'service_buffer',
            x: -(wingW / 2 - wingD / 2) - 5,
            z: 3,
            width: wingD * 0.9,
            depth: 16,
            floors: Math.max(1, fl - 1),
            floorHeight: fh,
            roofType: clsRoof,
            customWallHex: wallHexOverride ?? '#E4DFD3',
            customRoofHex: roofHexOverride ?? '#475569',
          },
          city,
          funcKey
        ),
        makeBlk(
          {
            id: 'edu_spine',
            label: 'Camlı Giriş Fuayesi & Kantin Omurgası',
            role: 'social_atrium',
            x: wingW / 2 - wingD * 0.45 - 5,
            z: 2,
            width: wingD * 0.85,
            depth: 14,
            floors: Math.max(1, fl - 1),
            floorHeight: fh,
            roofType: 'flat_green',
            glazingStyle: 'curtain_wall',
            specialFeature: 'entrance_canopy',
            customWallHex: '#CBD5E1',
          },
          city,
          funcKey
        )
      );

      if (isClosedCourt) {
        blocks.push(
          makeBlk(
            {
              id: 'edu_south_wing',
              label: 'Güney Kütüphane & Sosyal Avlu Kanadı',
              role: 'primary_living',
              x: -5,
              z: 13,
              width: wingW,
              depth: 10.5,
              floors: Math.max(1, fl - 1),
              floorHeight: fh,
              roofType: clsRoof,
              specialFeature: 'arcade',
              customWallHex: wallHexOverride ?? '#EFECE4',
              customRoofHex: roofHexOverride ?? '#475569',
            },
            city,
            funcKey
          )
        );
        appliedNotes.push('4 kanatlı merkezi iç avlulu okul şeması oluşturuldu.');
      }
    }

    // Lise / Okul için Kapalı Spor Salonu veya Konferans Salonu Ekleme
    if ((funcKey === 'education' && !isClosedCourt) || wantsGym || wantsAuditorium) {
      blocks.push(
        makeBlk(
          {
            id: 'edu_gym_hall',
            label: wantsAuditorium && !wantsGym ? 'Konferans & Çok Amaçlı Salon' : 'Kapalı Spor & Çok Amaçlı Salon',
            role: 'north_daylight',
            x: wingW / 2 + 8,
            z: -2,
            width: 17,
            depth: 24,
            floors: 1,
            floorHeight: 8.2,
            roofType: 'barrel_vault',
            ridgeDirection: 'NS',
            glazingStyle: 'minimal_hall',
            customWallHex: wallHexOverride ?? '#DFDBD0',
            customRoofHex: '#334155',
          },
          city,
          funcKey
        )
      );
      if (wantsGym || wantsAuditorium) {
        appliedNotes.push('Kampüse geniş açıklıklı tonoz çatılı Spor/Konferans Salonu bloğu eklendi.');
      }
    }

    if (wantsPool) {
      blocks.push(
        makeBlk(
          {
            id: 'edu_pool',
            label: 'Yüzme Havuzu',
            role: 'social_atrium',
            x: -5,
            z: 14,
            width: 16,
            depth: 9,
            floors: 1,
            floorHeight: 0.5,
            roofType: 'flat_green',
            specialFeature: 'outdoor_pool',
          },
          city,
          funcKey
        )
      );
      appliedNotes.push('Kampüs avlusuna yüzme havuzu eklendi.');
    }

    courtyardAreaM2 = Math.round(wingW * 13);
  }

  // =========================================================================
  // TİP 4: HASTANE / POLİKLİNİK (2 KATLI BAZA + YATAK KULESİ + ACİL SAÇAĞI)
  // =========================================================================
  else if (funcKey === 'healthcare') {
    const towerFl = promptFloors ?? Math.max(3, Math.min(7, Math.round(targetAreaM2 / 950)));
    const podW = Math.max(26, Math.min(46, Math.sqrt(targetAreaM2 * 0.35)));
    const podD = Math.max(18, podW * 0.72);

    blocks.push(
      makeBlk(
        {
          id: 'med_podium',
          label: 'Poliklinik, Teşhis & Acil Giriş Bazası',
          role: 'social_atrium',
          x: 0,
          z: 5,
          width: podW,
          depth: podD,
          floors: Math.min(2, towerFl),
          floorHeight: 4.0,
          roofType: 'flat_green',
          specialFeature: 'entrance_canopy',
          glazingStyle: 'curtain_wall',
          customWallHex: wallHexOverride ?? '#F1EFEA',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'med_ward_tower',
          label: 'Hasta Yatak Servisleri Bloğu (Güney Şifa Cephesi)',
          role: 'primary_living',
          x: 0,
          z: -podD * 0.25,
          width: podW * 0.86,
          depth: 13.5,
          floors: towerFl,
          floorHeight: 3.8,
          roofType: promptRoof ?? 'flat_green',
          overhangSouthM: 1.1,
          customWallHex: wallHexOverride ?? '#FAFAF8',
          customRoofHex: roofHexOverride ?? '#475569',
        },
        city,
        funcKey
      )
    );
    courtyardAreaM2 = Math.round(podW * 9);
  }

  // =========================================================================
  // TİP 5: SPOR SALONU / OTOGAR TERMİNALİ (GENİŞ AÇIKLIKLI KEMER/TONOZ ÇATI)
  // =========================================================================
  else if (funcKey === 'sports' || funcKey === 'transport') {
    const hallW = Math.max(24, Math.min(48, Math.sqrt(targetAreaM2 * 0.9)));
    const hallD = Math.max(18, hallW * 0.72);

    blocks.push(
      makeBlk(
        {
          id: 'wide_arena',
          label: funcKey === 'sports' ? 'Ana Spor Sahası / Havuz Holü' : 'Ana Yolcu Terminal Holü',
          role: 'north_daylight',
          x: 0,
          z: -3,
          width: hallW,
          depth: hallD,
          floors: 1,
          floorHeight: funcKey === 'sports' ? 9.2 : 7.5,
          roofType: promptRoof ?? 'barrel_vault',
          ridgeDirection: 'EW',
          glazingStyle: 'minimal_hall',
          customWallHex: wallHexOverride ?? '#E5E2DC',
          customRoofHex: roofHexOverride ?? '#334155',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'wide_foyer',
          label: funcKey === 'sports' ? 'Giriş Fuayesi & Soyunma Bloğu' : 'Bilet Gişeleri & Peron Saçağı',
          role: 'social_atrium',
          x: 0,
          z: hallD / 2 + 4,
          width: hallW * 0.85,
          depth: 8,
          floors: 1,
          floorHeight: 4.4,
          roofType: funcKey === 'transport' ? 'louver_canopy' : 'flat_green',
          specialFeature: 'entrance_canopy',
          glazingStyle: 'curtain_wall',
          customWallHex: '#CBD5E1',
        },
        city,
        funcKey
      )
    );

    if (wantsPool) {
      blocks.push(
        makeBlk(
          {
            id: 'spt_out_pool',
            label: 'Açık Antrenman Havuzu',
            role: 'social_atrium',
            x: 0,
            z: hallD / 2 + 13,
            width: 20,
            depth: 10,
            floors: 1,
            floorHeight: 0.5,
            roofType: 'flat_green',
            specialFeature: 'outdoor_pool',
          },
          city,
          funcKey
        )
      );
    }
    courtyardAreaM2 = Math.round(hallW * 8);
  }

  // =========================================================================
  // TİP 6: TOPLU KONUT / APARTMAN / YURT / OTEL (BALKONLU GERÇEKÇİ BLOKLAR)
  // =========================================================================
  else if (
    funcKey === 'residential' ||
    funcKey === 'dormitory' ||
    funcKey === 'hotel'
  ) {
    const fl = promptFloors ?? Math.max(3, Math.min(7, Math.round(targetAreaM2 / 750)));
    const barW = Math.max(20, Math.min(38, Math.sqrt((targetAreaM2 / fl) * 0.9)));
    const barD = 12.2;
    const rType: RoofTypeKey =
      promptRoof ?? (city.annualSnowLoadKnM2 >= 0.85 ? 'gable' : 'flat_green');

    blocks.push(
      makeBlk(
        {
          id: 'res_north_bar',
          label: funcKey === 'hotel' ? 'Kuzey Konuk Odaları Bloğu (Güney Balkonlu)' : 'A Blok (Güney Cepheli Yaşam Daireleri)',
          role: 'primary_living',
          x: 0,
          z: -10,
          width: barW,
          depth: barD,
          floors: fl,
          floorHeight: 3.15,
          roofType: rType,
          roofPitchDeg: rType === 'gable' ? 24 : 5,
          overhangSouthM: 1.2,
          specialFeature: 'balconies',
          customWallHex: wallHexOverride ?? '#F2EFE9',
          customRoofHex: roofHexOverride ?? '#7C4A36',
        },
        city,
        funcKey
      )
    );

    if (targetAreaM2 >= 1800 || p.includes('avlu') || p.includes('u şek') || funcKey === 'hotel') {
      blocks.push(
        makeBlk(
          {
            id: 'res_east_bar',
            label: funcKey === 'hotel' ? 'Doğu Süit Kanadı' : 'B Blok (Doğu Sabah Güneşi Kanadı)',
            role: 'primary_living',
            x: barW / 2 - 5.5,
            z: 4,
            width: 11,
            depth: 16,
            floors: Math.max(2, fl - 1),
            floorHeight: 3.15,
            roofType: rType,
            roofPitchDeg: rType === 'gable' ? 24 : 5,
            specialFeature: 'balconies',
            customWallHex: wallHexOverride ?? '#EAE5DC',
            customRoofHex: roofHexOverride ?? '#7C4A36',
          },
          city,
          funcKey
        ),
        makeBlk(
          {
            id: 'res_lounge',
            label: funcKey === 'hotel' ? 'Lobi & Restoran Pavyonu' : 'Sosyal Tesis / Giriş Bloğu',
            role: 'social_atrium',
            x: -(barW / 2 - 6),
            z: 3,
            width: 12,
            depth: 12,
            floors: 1,
            floorHeight: 4.0,
            roofType: 'flat_green',
            specialFeature: 'entrance_canopy',
            glazingStyle: 'curtain_wall',
            customWallHex: '#CBD5E1',
          },
          city,
          funcKey
        )
      );
    }

    if (wantsPool || funcKey === 'hotel') {
      blocks.push(
        makeBlk(
          {
            id: 'res_pool',
            label: 'Avlu Yüzme Havuzu',
            role: 'social_atrium',
            x: 0,
            z: 4,
            width: 13,
            depth: 7,
            floors: 1,
            floorHeight: 0.45,
            roofType: 'flat_green',
            specialFeature: 'outdoor_pool',
          },
          city,
          funcKey
        )
      );
    }
    courtyardAreaM2 = Math.round(barW * 12);
  }

  // =========================================================================
  // TİP 7: FABRİKA / ATÖLYE / TARIMSAL İŞLİK (KUZEY IŞIKLIĞI HOL + İDARİ OFİS)
  // =========================================================================
  else if (funcKey === 'industrial' || funcKey === 'atelier' || funcKey === 'agro') {
    const hallW = Math.max(22, Math.min(46, Math.sqrt(targetAreaM2 * 0.85)));
    const hallD = Math.max(16, hallW * 0.68);

    blocks.push(
      makeBlk(
        {
          id: 'ind_main_hall',
          label: funcKey === 'agro' ? 'Üretim & Mahzen Holü' : 'Ana Üretim & Atölye Holü',
          role: 'north_daylight',
          x: 0,
          z: -4,
          width: hallW,
          depth: hallD,
          floors: 1,
          floorHeight: funcKey === 'industrial' ? 7.2 : 5.5,
          roofType: promptRoof ?? (funcKey === 'agro' ? 'gable' : 'sawtooth'),
          sawtoothCount: 4,
          hasPvPanels: true,
          glazingStyle: 'minimal_hall',
          customWallHex: wallHexOverride ?? (funcKey === 'agro' ? '#D9CFC1' : '#E2E4E8'),
          customRoofHex: roofHexOverride ?? '#334155',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'ind_office_front',
          label: funcKey === 'agro' ? 'Tadım, Satış & İdari Pavyon' : 'Güney Tasarım & İdari Ofis Bloğu',
          role: 'primary_living',
          x: 0,
          z: hallD / 2 + 4.5,
          width: hallW * 0.65,
          depth: 9,
          floors: promptFloors ?? 2,
          floorHeight: 3.6,
          roofType: 'flat_green',
          specialFeature: funcKey === 'agro' ? 'arcade' : 'entrance_canopy',
          glazingStyle: funcKey === 'agro' ? 'punched' : 'curtain_wall',
          customWallHex: wallHexOverride ?? '#F3F1EC',
        },
        city,
        funcKey
      )
    );
    courtyardAreaM2 = Math.round(hallW * 8);
  }

  // =========================================================================
  // TİP 8: KÜLTÜR / KÜTÜPHANE / OFİS / BELEDİYE / ÇARŞI / KARMA / ÖZEL
  // =========================================================================
  else {
    const fl = promptFloors ?? Math.max(2, Math.min(6, Math.round(targetAreaM2 / 850)));
    const wMain = Math.max(22, Math.min(40, Math.sqrt((targetAreaM2 / fl) * 0.9)));
    const dMain = 13.5;
    const isCurtain = funcKey === 'office' || funcKey === 'public_gov' || funcKey === 'mixed';
    const hasArcade = funcKey === 'commercial' || funcKey === 'mixed';

    blocks.push(
      makeBlk(
        {
          id: 'gen_north',
          label:
            funcKey === 'cultural' || funcKey === 'library'
              ? 'Kuzey Sergi / Okuma Salonu'
              : 'Ana Kuzey Kütle Bloğu',
          role: 'north_daylight',
          x: 0,
          z: -10,
          width: wMain,
          depth: dMain,
          floors: fl,
          floorHeight: funcKey === 'cultural' ? 4.6 : 3.8,
          roofType:
            promptRoof ??
            (funcKey === 'cultural' || funcKey === 'library' ? 'sawtooth' : 'flat_green'),
          glazingStyle: isCurtain ? 'curtain_wall' : 'punched',
          specialFeature: hasArcade ? 'arcade' : undefined,
          customWallHex: wallHexOverride ?? '#EFECE6',
          customRoofHex: roofHexOverride ?? '#475569',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'gen_east',
          label: 'Doğu Kanat & Giriş Fuayesi',
          role: 'social_atrium',
          x: wMain / 2 - 6,
          z: 3,
          width: 12,
          depth: 14,
          floors: Math.max(1, fl - 1),
          floorHeight: 3.8,
          roofType: promptRoof ?? 'flat_green',
          specialFeature: 'entrance_canopy',
          glazingStyle: 'curtain_wall',
          customWallHex: wallHexOverride ?? '#E2E8F0',
        },
        city,
        funcKey
      ),
      makeBlk(
        {
          id: 'gen_west',
          label:
            funcKey === 'cultural' || wantsAuditorium
              ? 'Oditoryum / Konferans Salonu'
              : 'Batı Servis & Çalışma Kanadı',
          role: 'service_buffer',
          x: -(wMain / 2 - 6),
          z: 3,
          width: 12,
          depth: 14,
          floors: funcKey === 'cultural' ? Math.max(1, fl - 1) : fl,
          floorHeight: 3.8,
          roofType: promptRoof ?? 'mono_pitch',
          glazingStyle: funcKey === 'cultural' ? 'minimal_hall' : 'punched',
          customWallHex: wallHexOverride ?? '#E6E2D8',
        },
        city,
        funcKey
      )
    );
    courtyardAreaM2 = Math.round((wMain - 12) * 14);
  }

  return {
    blocks,
    courtyardAreaM2,
    orientationDeg,
    appliedNotes,
  };
}
