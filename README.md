# KimyasalÇizim

Tarayıcıda çalışan 2 boyutlu kimyasal yapı editörü. Fare ile molekül çizersiniz;
uygulama bunu canlı olarak SMILES/InChI'ye çevirir, özelliklerini hesaplar ve
görsel veya dosya olarak dışa aktarır.

## Kurulum

```bash
npm install     # RDKit WASM dosyalarını public/ altına da kopyalar
npm run dev     # http://localhost:5173
```

`npm test` testleri, `npm run build` üretim derlemesini çalıştırır.

## Telefona kurma (PWA)

Uygulama kurulabilir bir PWA'dır. Yayındaki adresi telefonda açıp tarayıcı
menüsünden **Ana ekrana ekle** deyin; ayrı bir uygulama gibi, adres çubuğu
olmadan açılır.

İlk ziyaretten sonra **çevrimdışı çalışır** — kimya motoru dahil. Uygulama
kabuğu (HTML/JS/CSS/ikonlar, ~417 KB) service worker kurulurken önbelleğe
alınır; RDKit'in 6,4 MB'lik WASM dosyası ise ilk kullanımda alınır. Kurulumu
6,4 MB'lık bir indirmenin arkasında bekletmemek için bilerek böyle:

| Katman | Strateji | Neden |
|---|---|---|
| Kabuk | Ön-önbellek | Küçük; anında ve eksiksiz olmalı |
| WASM | İlk kullanımda, önbellek öncelikli | Büyük; kurulumu geciktirmemeli |

WASM'ın önbellek adı RDKit sürümünü taşır (`rdkit-wasm-2025.3.2-1.0.0`).
`public/` altındaki dosyalar Vite'ın hash'li adlandırmasından yararlanamadığı
için gerekli: sürüm yükseltilince eski WASM sonsuza dek önbellekte kalmaz.

Yeni sürümler sessizce devralınır (`registerType: 'autoUpdate'`).

> **Yayınlarken:** service worker yalnızca HTTPS üzerinde (ya da localhost'ta)
> çalışır. `dist/` klasörünün **içindekileri** statik olarak sunmanız yeterli;
> sunucu tarafı yok.
>
> **IIS (Windows hosting, `chemdraw.maege.tr`):** ek dosya gerekmez. Manifest
> bilerek `manifest.json` adıyla üretilir, çünkü IIS `.webmanifest` uzantısını
> tanımaz ve dosya dursa bile 404 verir. HTTPS yönlendirmesini Plesk'teki
> "HTTP'den HTTPS'e kalıcı yönlendirme" ayarından açın.
>
> ⚠️ `deploy/iis/web.config` dosyasını, site başka bir uygulamayla **aynı IIS
> uygulama havuzunu paylaşıyorsa yüklemeyin.** Paylaşılan havuzda yüklendiğinde
> `maege.tr` (Blazor Server) 503 ile çöktü; yalnız Blazor'u yeniden yayımlamak
> düzeltti. Dosya bu yüzden derlemeye girmiyor.
>
> **Apache (Bluehost vb.):** `dist/` içindeki `.htaccess` sıkıştırma, MIME türleri,
> HTTPS ve önbellek kurallarını getirir. Gizli dosya olduğu için yükleme aracında
> gizli dosyaları göster seçeneğini açın.

İkonlar `scripts/*.svg` dosyalarından üretilir ve depoya işlenir:

```bash
node scripts/make-icons.mjs
```

Dönüştürücü (`sharp`) `npx` ile geçici olarak çalışır; kalıcı bağımlılık değildir.

## Kullanım

| İşlem | Nasıl |
|---|---|
| Bağ çizme | Boş alandan veya bir atomdan **sürükleyin** |
| Serbest açı | Sürüklerken **Shift** (varsayılan: 30°'ye yakalanır) |
| Bağ derecesi | Bağa tıklayın (tekli → ikili → üçlü) |
| Element değiştirme | Paletten element seçip atoma tıklayın |
| **Tüm elementler** | Palette «Tümü…» → periyodik tablo (118 element). Seçtikleriniz palete kısayol olarak eklenir |
| **Fonksiyonel grup** | COOH/OH/NH₂/NO₂/C≡N/SO₃H/fenil… seçip bir atoma tıklayın |
| Halka ekleme | Halka seçin; boş alana, bir **atoma** (spiro) veya bir **bağa** (kaynaşır) tıklayın |
| Atom taşıma | «Seç ve taşı» ile sürükleyin; başka atomun üstüne bırakınca birleşir |
| **Çoklu seçim** | «Seç ve taşı» ile boş alanda sürükleyerek kutu çizin; seçimi topluca taşıyın |
| **Yakınlaştırma** | Fare tekerleği (imlecin altındaki nokta sabit kalır) |
| **Kaydırma** | Ctrl+sürükleme veya orta fare tuşu |
| **SMILES ya da isimden çizim** | Sağ paneldeki kutuya SMILES ya da ad yazıp «Çiz» — ayrıntı aşağıda |
| **Örnek galerisi** | Sağ panelde «Örnekler» — 24 hazır molekül (aspirin, kafein, glikoz…) |
| Yük / stereo | İlgili aracı seçip atoma ya da bağa tıklayın |
| **Zincir** | Zincir aracıyla sürükleyin: sürükledikçe uzayan zikzak karbon zinciri |
| **İzotop** | İzotop aracıyla atoma tıkladıkça ¹²C → ¹³C → ¹⁴C (H → D → T …) |
| **Karbonları göster** | «Görünüm» → «C Göster»: her karbon hidrojenleriyle yazılır (CH₃, CH₂, CH); kapalıyken iskelet gösterim |
| **Döndür / aynala** | «Dönüştür» bölümü: seçimi, seçim yoksa tüm yapıyı. Aynalama stereokimyayı korur |
| **Paylaş** | «Bağlantı» düğmesi yapıyı açan bir adres üretir (`#smiles=…`) |
| Düzenle | Koordinatları RDKit'e yeniden ürettirir |
| Geri / ileri | Ctrl+Z, Ctrl+Y |

**Klavye — küçük harf araç, BÜYÜK harf element:**

- `b` bağ · `c` zincir · `a` atom · `s` seç · `e` sil · `t` halka · `g` grup · `w` kama · `h` kesikli
- `C`, `N`, `O`, `S`, `W`… element simgeleri; iki harfliler hızlıca yazılır (`C` `l` → Cl, `N` `a` → Na)
- `Ctrl+A` tümünü seç · `Ctrl+C`/`Ctrl+V` kopyala-yapıştır · `Delete` seçimi sil · `Esc` bırak

Bu ayrım zorunlu: `w` kama aracı ama `W` tungsten; aynı çakışma `b`/`B`, `s`/`S`,
`h`/`H` için de geçerli.

### Telefon ve tablet

Dar ekranda (≤820px) yerleşim tek sütuna döner: tuval tam genişlik alır, araç
şeridi başparmak menzilinde alta iner, bilgi paneli başlıktaki **Bilgi**
düğmesiyle açılır. Dokunma hedefleri 42px'e büyür.

| Jest | Etki |
|---|---|
| Tek parmak | Seçili araçla çizim |
| İki parmak — açma/kapama | Yakınlaştırma |
| İki parmak — kaydırma | Tuvali gezdirme |

İkinci parmak indiği anda süren çizim iptal edilir, yani yakınlaştırırken
tuvale kazara çizgi atılmaz.

### Değerlik ve elementler

Ana grup elementlerinin değerliği biliniyor, hidrojenleri otomatik hesaplanıyor.
**Geçiş metallerinde hesaplanmıyor** — değerlikleri değişken olduğu için hidrojen
uydurmak yanıltıcı olurdu; organometalik yapılarda istenen davranış budur.

Çizim **tarayıcıda otomatik saklanır** — sekmeyi kapatıp geri dönünce kaldığınız yerden devam edersiniz.

### İsimden yapı

Sağ paneldeki kutu üç tür girdiyi anlar ve şu sırayla dener:

1. **Türkçe ad** (kafein, glikoz, asetilen…): galeri ve alıştırmalardaki ~40
   molekül yerel listeden, **internetsiz** ve anında bulunur.
2. **SMILES** (`CCO`, `c1ccccc1`…)
3. **PubChem'de ad** (morphine, serotonin, acetic acid…). PubChem yalnız
   İngilizce adları tanır: "morfin" bulunmaz, "morphine" bulunur. Bulunan
   yapının PubChem sayfasına bağlantı verilir.

Yalnız üçüncü adımda ağa çıkılır ve yalnız aranan ad NCBI'ye (ABD) gönderilir.
Çevrimdışıyken yerel adlar ve SMILES çalışmaya devam eder.

### Molekülü anlamak

Bilgi paneli molekülde bulunan **fonksiyonel grupları** listeler (karboksilik asit,
ester, amid, aldehit, keton, alkol, fenol, eter, amin, nitril, nitro, halojenür,
tiyol, alken, alkin, aromatik halka). Bir gruba tıklayınca atomları tuvalde o
grubun rengiyle vurgulanır.

**Değerliği aşılmış** atomlar (beş bağlı karbon gibi) tuvalde kırmızı kesikli
halkayla, panelde adı ve bağ sayısıyla gösterilir.

### Alıştırma modu

Başlıktaki **🎓 Alıştırma** düğmesi kolaydan zora 18 "şunu çizin" görevi açar.
Çizip **Kontrol et**'e basın. Değerlendirme InChIKey ile yapılır ve yalnız
doğru/yanlış değil, *neden* yanlış olduğunu da söyler:

| Durum | Geri bildirim |
|---|---|
| Aynı molekül | Doğru |
| İskelet aynı, stereokimya farklı | Kama/kesikli bağları kontrol edin |
| İskelet aynı, yük farklı | Yükleri kontrol edin (asetik asit ↔ asetat) |
| Formül aynı, bağlanma farklı | Bu bir izomer (etanol ↔ dimetil eter) |

Belirli bir görevi bağlantıyla paylaşabilirsiniz: `maege.tr/#gorev=aspirin`.

### Görünüm

**Tema** Otomatik (sistem tercihi) / Açık / Koyu arasında değişir. Dışa aktarılan
SVG ve PNG ekranda hangi tema açık olursa olsun **her zaman açık temadır** —
belgeye beyaz zemin, koyu mürekkep gider. **⌬ Daire** aromatik halkaları bir
atlamalı ikili bağlar yerine içte daireyle gösterir.

### Stereokimya

Kama/kesikli bağ çizdiğinizde stereo merkezin yanına CIP etiketi belirir: *(R)*, *(S)*,
çift bağlarda *(E)* / *(Z)*. Stereokimyası **belirsiz** bir merkez kırmızı *(?)* ile
işaretlenir — yani orada kama veya kesikli bağ eksik.

## Mimari

Çizim geometrisi bizim, kimya bilgisi RDKit'in. İkisi arasındaki **tek köprü
MDL Molfile (V2000)** — SMILES'i hiçbir yerde kendimiz üretmiyoruz.

```
fare olayları → Molecule (src/model) → SVG (src/render)
                     ↓ toMolfile()
                  RDKit WASM → SMILES / InChI / formül / kütle / LogP
                     ↑ fromMolfile()   (clean-up ve .mol içe aktarımı)
```

Bu ayrım sayesinde halka algılama, aromatiklik, kanonikleştirme ve stereo
yorumu gibi zor işler olgun bir kimya motoruna devredilmiş olur.

| Dizin | Sorumluluk |
|---|---|
| `src/model` | Saf veri modeli: atom/bağ işlemleri, valans, geometri, molfile, halka ve grup şablonları |
| `src/render` | Molekülü SVG'ye çizen saf görünüm bileşenleri |
| `src/editor` | Reducer (undo/redo), tuval jestleri, görünüm penceresi, kalıcılık |
| `src/rdkit` | WASM köprüsü ve React hook'ları |
| `src/panels` | Araç çubuğu, bilgi paneli, dışa aktarma |

Model katmanı tarayıcıdan tamamen bağımsız ve saf olduğu için testlerin çoğu orada:
geometri, valans, molfile gidiş-dönüşü, grup kimyası, görünüm matematiği.

### RDKit belleği

`JSMol` nesneleri WASM yığınında yaşar ve çöp toplayıcı tarafından
temizlenmez. Bu yüzden RDKit'e tek erişim yolu `withMol()`'dür; `try/finally`
içinde `delete()` çağırır. Canlı SMILES her çizim değişikliğinde hesaplandığı
için çıplak bir `get_mol()` çağrısı hızla sızıntıya döner.

### RDKit'in yüklenmesi

`@rdkit/rdkit`'in ESM importu Vite altında sorunlu olduğundan `dist` dosyaları
`postinstall` ile `public/` altına kopyalanır ve `index.html`'den `<script>`
etiketiyle yüklenir. WASM ~8 MB olduğu için başlatma tembeldir: tuval motor
gelmeden de çizilebilir, yalnızca hesaplanan alanlar bekler.
