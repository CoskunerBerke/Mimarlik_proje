# İKLİMFORM — İklim Duyarlı Mimari Kütle, Avlu, 3D Solar Çatı ve Yerel Malzeme Stüdyosu

Mimarlar ve mimarlık öğrencileri için geliştirilmiş; **mevsimsel güneş, gölge ve rüzgar analizlerini** gerçekleştirerek **bina fonksiyonuna ve metrekaresine uygun optimal kütle/avlu dağılımı**, **3D parametrik solar çatı açısı optimizasyonu** ve **lokasyona duyarlı sürdürülebilir yerel malzeme** önerileri üreten etkileşimli web tabanlı hesaplamalı tasarım (computational design) platformu.

## Temel Modüller

1. **01 İklim & Mevsimsel Arazi Analizi**
   - Türkiye’nin tüm TS 825 ısı yalıtım bölgelerini (1–5. Bölge) ve Köppen-Geiger iklim sınıflarını kapsayan hazır istasyonlar + **Open-Meteo ERA5 API** üzerinden dünyanın her koordinatı için canlı meteorolojik veri çekimi.
   - Spencer/NOAA denklemleriyle yılın 365 günü ve günün her saati için gerçek astronomik güneş yüksekliği ($\alpha$), azimut ($\gamma$), gölge boyu çarpanı, 3D güneş yörüngesi yayları (21 Haziran, 21 Mart/Eylül, 21 Aralık) ve komşu yapılar dahil gerçek zamanlı gölge simülasyonu.
   - Mevsimsel rüzgar gülü ve 3D sahne üzerinde animasyonlu hakim rüzgar akış vektörleri.

2. **02 Bina Fonksiyonu, Metrekare ve Optimal Kütle & Avlu Üretici**
   - Konut, Eğitim, Ofis, Kültür/Müze, Sağlık, Karma Kullanım ve Üretim/Atölye programları için alt mekan metrekare dağılımı, ideal yönelim ve hedef günışığı faktörü (%DF) hesabı.
   - 6 farklı mimari kütle/avlu tipolojisinin (Merkezi Avlulu, Güneye Açılan U-Avlu, Kademeli Meltem Pavyonları, Kompakt Düşük A/V Prizma, L-Tipi Rüzgar Kalkanı, Lineer Doğu-Batı Blok) ısıl denge, günışığı, doğal havalandırma ve avlu H/W oranına göre sıralanması.

3. **03 3D Kütle Düzenleme & Parametrik Solar Çatı Eklentisi**
   - Sahneye yeni 3D kütle ekleme, kopyalama, taşıma, döndürme ve kat/boyut düzenleme.
   - Güneş açılarına göre otomatik kalibre edilen **Testere Dişi Kuzey Işıklığı (Sawtooth)**, **Tek Eğimli Solar Clerestory**, **Asimetrik Beşik**, **Simetrik Beşik**, **Kelebek (V-Kesit)**, **Ekstansif Yeşil Çatı + Fener** ve **Biyoklimatik Solar Kanopi** modelleri.
   - Canlı **2D Mimari Kesit (Kuzey-Güney)** üzerinde 21 Haziran yaz güneşinin saçaktan kesilmesi ve 21 Aralık kış güneşinin mekana giriş derinliğinin (m) anlık ışın izleme (raytracing) gösterimi + yıllık BIPV elektrik ve yağmur suyu hasadı hesabı.

4. **04 Lokasyona Uygun Yerel Malzeme, Erişilebilirlik & Sürdürülebilirlik (LCA)**
   - Arsa koordinatından bölgesel hammadde ocak/üretim havzalarına karayolu mesafesi (km), LEED `< 500 km` yerel tedarik analizi ve usta erişilebilirliği.
   - TS 825 bölge sınır U-değeri kontrolü, termal faz kayması (saat) ve A1–A4 gömülü karbon ($\text{kgCO}_2\text{e}/\text{m}^2$) hesabı.

5. **CAD / BIM Dışa Aktarım**
   - Tek tıkla **3D `.OBJ` Model İndirme** (Rhino, SketchUp, Blender, Revit, ArchiCAD uyumlu) ve **Markdown Teknik Analiz Raporu** çıktısı.

## Kurulum & Vercel Dağıtımı

```bash
npm install
npm run dev
npm run build
```

Proje Vite + React + TypeScript + Three.js altyapısıyla hazırlanmış olup `vercel.json` yapılandırması sayesinde doğrudan Vercel üzerinde sıfır ek ayarla yayımlanmaya hazırdır.
