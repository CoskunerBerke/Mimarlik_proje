import React from 'react';
import { X } from 'lucide-react';

interface ArchitectureDocsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ArchitectureDocsModal: React.FC<ArchitectureDocsModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#161615] max-w-3xl w-full max-h-[86vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#161615] text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-stone-400">
              Sistem Mimarisi & Hesaplamalı Tasarım Metodolojisi
            </div>
            <h2 className="text-sm font-bold">
              İKLİMFORM Nasıl Çalışır? — Algoritmik Mimari Karar Destek Altyapısı
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs text-stone-700 leading-relaxed">
          <div className="border-l-2 border-[#C85A17] pl-3.5 space-y-1">
            <h3 className="font-bold text-[#161615] text-sm">
              01. Astronomik Güneş Yörüngesi, Gölge ve Mevsimsel Mikroklima Motoru
            </h3>
            <p>
              Sistem, seçilen enlem (φ), boylam (λ), yılın günü (n = 1..365) ve güneş saatine (ω)
              göre Spencer / NOAA denklemleriyle anlık güneş deklinasyonunu{' '}
              <code className="bg-stone-100 px-1 font-mono">δ = 23.45°·sin(360/365·(284+n))</code>,
              güneş yükseklik açısını (α) ve azimut açısını (γ) hesaplar. Open-Meteo ERA5 yeniden
              analiz API entegrasyonu sayesinde dünyanın herhangi bir koordinatından gerçek
              mevsimsel sıcaklık, hakim rüzgar yönü/hızı ve kısa dalga güneş ışınımı çekilir;
              Three.js <code className="bg-stone-100 px-1 font-mono">PCFSoftShadowMap</code> ile
              komşu yapılar dahil gerçek zamanlı gölge düşümü üretilir.
            </p>
          </div>

          <div className="border-l-2 border-[#161615] pl-3.5 space-y-1">
            <h3 className="font-bold text-[#161615] text-sm">
              02. Fonksiyon ve Metrekare Tabanlı Üretken (Generative) Kütle & Avlu Dağılımı
            </h3>
            <p>
              Girilen bina fonksiyonu (Konut, Eğitim, Ofis, Kültür/Müze, Sağlık, Karma, Atölye) ve
              toplam m² hedefi; alt mekanların günışığı faktörü (%DF) ve yönelim ihtiyaçlarına
              ayrıştırılır. Çok kriterli karar matrisi 6 temel mimari tipolojiyi (Merkezi Avlu,
              Güneye Açılan U-Avlu, Kademeli Meltem Pavyonları, Kompakt Düşük A/V Prizma, L-Rüzgar
              Kalkanı, Lineer Doğu-Batı Blok) Yüzey/Hacim oranı (A/V), Avlu H/W gölgelenme oranı,
              TAKS/KAKS uyumu ve çapraz havalandırma verimine göre puanlayarak 3D sahneye yerleştirir.
            </p>
          </div>

          <div className="border-l-2 border-sky-700 pl-3.5 space-y-1">
            <h3 className="font-bold text-[#161615] text-sm">
              03. Parametrik 3D Çatı & Günışığı Kesit Işın İzleme (Raytracing) Eklentisi
            </h3>
            <p>
              Her 3D kütle bağımsız seçilebilir, taşınabilir, boyutlandırılabilir ve çatı
              geometrisi prosedürel <code className="bg-stone-100 px-1 font-mono">ExtrudeGeometry</code>{' '}
              ile gerçek zamanlı üretilir. Örneğin stüdyo/sergi/atölye mekanlarında{' '}
              <strong>Testere Dişi (Sawtooth) Kuzey Işıklığı</strong> seçildiğinde; kuzey cam
              yüzeyi 21 Haziran yaz öğle güneşini (%98+) kesecek diklikte (85°–90°) tutulurken,
              güney eğimli yüzey enlem optimum açısında (<code className="bg-stone-100 px-1 font-mono">≈ 0.78·|φ| + 3°</code>)
              BIPV güneş paneli üretimi için ayarlanır. Güney saçak çıkması{' '}
              <code className="bg-stone-100 px-1 font-mono">L = H_pencere / tan(α_yaz)</code>{' '}
              formülüyle yaz güneşini kesip 21 Aralık kış güneşini mekanın derinliğine alır.
            </p>
          </div>

          <div className="border-l-2 border-[#15803D] pl-3.5 space-y-1">
            <h3 className="font-bold text-[#161615] text-sm">
              04. Yerel Malzeme Erişilebilirliği, Lojistik Mesafe ve Gömülü Karbon (LCA) Motoru
            </h3>
            <p>
              Türkiye’nin bölgesel hammadde havzaları (Karacadağ bazaltı, Kapadokya pomzası/bims,
              Karadeniz CLT yapısal ahşabı, Orta Karadeniz kenevir betonu, Ege/Eskişehir pişmiş
              toprak ve perlit yatakları vb.) koordinatlarıyla modellenmiştir. Haversine + karayolu
              kıvrım katsayısı ile arsa-ocak mesafesi (km), LEED &lt;500 km yerel malzeme kriteri,
              A1–A4 gömülü karbon (kgCO₂e/m²), TS 825 bölge sınır U-değeri ve termal faz kayması
              (saat) canlı olarak hesaplanır.
            </p>
          </div>

          <div className="bg-[#F8F7F3] border border-[#E2E0D8] p-3.5 space-y-1">
            <h4 className="font-bold text-[#161615]">
              BIM / CAD Entegrasyonu (Rhino, Grasshopper, Revit, SketchUp İş Akışı)
            </h4>
            <p>
              Üst bardaki <strong>3D .OBJ İndir</strong> butonu ile optimize edilmiş kütleler, avlu
              oranları ve parametrik çatı açıları doğrudan 3B mesh olarak dışa aktarılır ve Rhino,
              Blender, SketchUp veya ArchiCAD/Revit ortamına alınarak detay projeye devam edilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
