# Geleceğin Fikri Platformu — Ayrıntılı Proje Planı

> Belge sürümü: 1.0  
> Tarih: 16 Eylül 2026  
> Durum: Planlama ve gereksinim mutabakatı  
> Kaynak belge: `Fikir Platformu 11.08.2026.pdf`  
> Bu plan, kaynak PDF ile yapılan görüşmelerde alınan güncel kararların birleştirilmiş hâlidir. Çelişki durumunda bu plandaki “Kesinleşen kararlar” bölümü esas alınır.

---

## 1. Belgenin amacı

Bu belge, Geleceğin Fikri Platformu'nun fikir aşamasından üretim ortamına alınmasına kadar izlenecek işlevsel ve teknik planı tanımlar.

Belgenin amaçları şunlardır:

- Ürün kapsamını ve kapsam dışı maddeleri kesinleştirmek.
- Öğrenci, İl AR-GE ve Bakanlık süreçlerini uçtan uca tanımlamak.
- İl bazlı veri ayrımını ve yetkilendirme modelini belirlemek.
- Değerlendirme, adaylık ve üç aylık Bakanlık seçimi süreçlerini tarif etmek.
- Kullanılacak teknoloji yığınını ve mimari ilkeleri belirlemek.
- Sistemin Netlify'dan YEĞİTEK sunucularına taşınabilir olmasını garanti altına alacak kuralları koymak.
- Ücretli veya sağlayıcıya bağımlı hizmetleri mümkün olduğunca ortadan kaldırmak.
- Güvenlik, erişilebilirlik, test, yedekleme ve işletim gereksinimlerini planlamak.
- Henüz kesinleşmeyen kararları görünür hâle getirmek.

---

## 2. Ürün vizyonu

Geleceğin Fikri Platformu; öğrencilerin fikirlerini paylaşabildiği, bu fikirlerin öğrencinin seçtiği ildeki İl AR-GE birimi tarafından değerlendirildiği ve belirli puan eşiğini geçen fikirlerin Bakanlık değerlendirmesine gönderildiği ulusal bir fikir platformudur.

Platformun temel amaçları:

- Öğrencilerin özgün fikirlerini güvenli ve erişilebilir biçimde toplamak.
- Fikirleri belirlenmiş, şeffaf ve denetlenebilir kriterlere göre puanlamak.
- İl AR-GE birimlerine yalnızca kendi illerindeki başvuruları yönetebilecekleri ortak bir panel sağlamak.
- Bakanlığa 81 ilden onaylanmış adayları tek ekranda değerlendirme imkânı sunmak.
- Her üç aylık dönemde her kategoriden bir fikir seçmek.
- Seçilen fikirleri ana sayfada yayımlamak ve süresi dolanları kalıcı arşive aktarmak.
- Planlamaya alınan ve hayata geçirilen fikirlerin uygulama süreçlerini kayıt altında tutmak.
- Dezavantajlı gruplar dâhil bütün kullanıcılar için erişilebilir bir deneyim sunmak.

---

## 3. Kesinleşen kararlar

### 3.1. Ürün kararları

- EBA ile giriş yapılmayacaktır.
- EBA ile ilgili hiçbir servis, bildirim, profil bilgisi veya sertifika entegrasyonu kullanılmayacaktır.
- Öğrenciler platform üzerinde normal kullanıcı hesabı oluşturacaktır.
- Öğrenci profilinde ilini kendisi seçecektir.
- Öğrencinin gönderdiği fikir, profilinde seçili olan ilin İl AR-GE paneline düşecektir.
- Fikir metni en fazla **1.500 karakter** olacaktır.
- Küfür ve uygunsuz kelime filtresi kesinlikle bulunacaktır.
- Küfür filtresinde yapay zekâ veya semantik LLM analizi kullanılmayacaktır.
- AI ile puanlama, içerik üretimi, fikir iyileştirme, yönlendirme veya moderasyon yapılmayacaktır.
- “Yapay Zekâ” bir fikir kategorisi olarak kalabilir; kaldırılan unsur AI tabanlı platform özelliğidir.
- “Fikrini Farklılaştırmayı Dene” işlemi ve durumu kaldırılacaktır.
- İl AR-GE panelinde başvurunun yanında `Değerlendir` düğmesi bulunacaktır.
- Değerlendirme ekranında önceden belirlenen kriterler gösterilecek ve puan otomatik hesaplanacaktır.
- Belirlenen puan eşiğinin üzerindeki fikirler `Ayın Fikri Adayları` sekmesine aktarılacaktır.
- İl AR-GE sorumlusu adayları inceleyip Bakanlığa gönderilmesini onaylayacaktır.
- Bakanlık için İl AR-GE panelinden ayrı bir yönetim paneli bulunacaktır.
- İl AR-GE paneli bütün iller için aynı yazılım olacaktır; giriş yapan personel yalnızca yetkili olduğu ili görecektir.
- Bakanlık paneli 81 ilden gönderilen onaylı adayları görecektir.
- Bakanlık seçimi her **üç ayda bir** yapılacaktır.
- Bakanlık her üç aylık dönemde her kategoriden bir fikir seçebilecektir.
- Seçilen fikirler üç ay boyunca ana sayfadaki mevcut kart/kaydırıcı yapısında gösterilecektir.
- Önceki dönemlerin seçilen fikirleri kalıcı olarak `Ayın Fikri Arşivi` bölümüne eklenecektir.
- “Hayata Geçirildi” seçildiğinde ilişkili proje bilgilerinin girileceği zorunlu bir pencere açılacaktır.
- Seçilen öğrenci için oluşturulan sertifika okul müdürlüğüne iletilecektir.
- Sağ taraftaki erişilebilirlik paneli korunacak ve geliştirilecektir.
- Gelen başvurular e-posta gelen kutusuna benzer şekilde yeni/okundu durumlarıyla yönetilecektir.

### 3.2. Teknik kararlar

- Frontend: React + TypeScript + Vite
- Backend: C# + ASP.NET Core 10 Web API
- Başlangıç veritabanı: PostgreSQL 18
- Veri erişimi: Entity Framework Core
- Kimlik yönetimi: ASP.NET Core Identity
- Mimari yaklaşım: Modüler monolit + katmanlı/temiz mimari
- Mevcut Netlify yayını yalnızca statik frontend ve prototip amacıyla kullanılacaktır.
- Netlify Functions, Netlify Database, Netlify Identity ve Netlify Blobs çekirdek sistem bağımlılığı olmayacaktır.
- Üretim ortamı daha sonra YEĞİTEK tarafından sağlanacaktır.
- Uygulama Linux, Windows, konteynerli veya konteynersiz ortamda çalışabilecek şekilde hazırlanacaktır.
- Ücretli üçüncü taraf servisler zorunlu bağımlılık hâline getirilmeyecektir.
- Teknoloji veya sunucu değişiminde iş kurallarının yeniden yazılmasını gerektirmeyecek taşınabilir bir tasarım uygulanacaktır.

---

## 4. Kapsam dışı özellikler

İlk sürümde aşağıdaki özellikler bulunmayacaktır:

- EBA ile giriş
- EBA kullanıcı bilgisi senkronizasyonu
- EBA bildirimi
- EBA uyumlu sertifika entegrasyonu
- AI/LLM tabanlı küfür veya içerik analizi
- AI ile fikir puanlama
- AI ile fikir geliştirme veya öneri üretme
- “Fikrini Farklılaştırmayı Dene” durumu
- Ücretli SMS doğrulaması
- Ücretli CAPTCHA zorunluluğu
- Ücretli PDF/Excel üretim servisi
- Ücretli bulut veritabanına zorunlu bağımlılık
- Netlify'a özgü backend iş mantığı
- İlk sürümde yerel mobil uygulama

---

## 5. Değişmez mimari ilkesi: taşınabilirlik

Projenin temel teknik ilkesi şudur:

> Uygulamanın iş kuralları hiçbir sunucuya, işletim sistemine, veritabanına, bulut hizmetine veya barındırma sağlayıcısına bağımlı olmayacaktır.

Bu ilkenin uygulamadaki karşılığı:

- İş kuralları veritabanı sorgularının içinde yazılmayacaktır.
- Domain ve Application katmanları ASP.NET, PostgreSQL, SMTP veya dosya sistemini bilmeyecektir.
- Veritabanına özel kodlar Infrastructure katmanında tutulacaktır.
- Ham SQL kullanımı zorunlu durumlarla sınırlı ve izole olacaktır.
- İl bazlı güvenlik yalnızca PostgreSQL Row-Level Security özelliğine bırakılmayacaktır.
- PostgreSQL RLS kullanılabilirse ek savunma katmanı olarak uygulanacaktır.
- PostgreSQL yerine SQL Server veya kurumun onayladığı başka bir sistem verilirse veri erişim katmanı değiştirilebilecektir.
- E-posta gönderimi bir arayüz üzerinden yapılacak ve SMTP sağlayıcısı ayardan değiştirilebilecektir.
- Dosya saklama bir arayüz üzerinden yapılacak; yerel disk, ağ diski veya nesne depolama kullanılabilecektir.
- PDF üretimi bir arayüz üzerinden yapılacak; sunucunun izin verdiği ücretsiz uygulama seçilebilecektir.
- React uygulamasının API adresi ortam ayarıyla değiştirilecektir.
- Konteyner kullanımı desteklenecek ama zorunlu olmayacaktır.
- ASP.NET Core uygulaması Linux `systemd`, Windows IIS veya konteyner üzerinde çalışabilecektir.
- Frontend önceden derleneceği için üretim sunucusunda Node.js zorunlu olmayacaktır.
- Ayarlar kaynak kodda tutulmayacak; ortam değişkenleri veya güvenli yapılandırma dosyaları kullanılacaktır.

---

## 6. Sistem aktörleri ve roller

### 6.1. Öğrenci

Yetkileri:

- Kayıt olma ve giriş yapma
- E-posta doğrulama
- Profil bilgilerini oluşturma ve güncelleme
- İl seçme
- Fikir oluşturma ve taslak kaydetme
- Fikir gönderme
- Gönderdiği fikirlerin durumunu takip etme
- Uygun durumdaki fikirlerini silme
- Takım üyesi ekleme/davet etme özelliği kesinleşirse ekip fikri oluşturma
- Kendisine ait bildirimleri görme

Kısıtları:

- Başka öğrencilerin özel başvurularını göremez.
- Gönderimden sonra fikrin il kaydı değişmez.
- Değerlendirmeye alınmış, planlamaya alınmış, hayata geçirilmiş veya seçilmiş fikirler silinemez.
- İl AR-GE veya Bakanlık puanlarını değiştiremez.

### 6.2. İl AR-GE değerlendiricisi

Yetkileri:

- Yalnızca kendi ilindeki başvuruları görme
- Yeni/okundu durumlarını yönetme
- Kendisine atanmış veya rolünün izin verdiği fikirleri değerlendirme
- Değerlendirme kriterlerini doldurma
- Açıklama ve değerlendirme notu ekleme
- Puanlamayı tamamlayıp gönderme

Kısıtları:

- Başka illerin fikirlerini göremez.
- Bakanlığa doğrudan aday gönderemez; İl AR-GE sorumlusu onayı gerekir.
- Yayındaki değerlendirme şablonunu değiştiremez.

### 6.3. İl AR-GE sorumlusu

Yetkileri:

- Yalnızca kendi ilindeki bütün başvuruları görme
- Başvuruları değerlendiricilere atama
- Değerlendirme sonuçlarını ve puanlarını görme
- Eksik değerlendirmeyi yeniden değerlendirmeye gönderme
- Eşik üstü fikirleri aday havuzunda görme
- Ayın Fikri adaylarını Bakanlığa gönderilmek üzere onaylama
- Planlamaya alınan ve hayata geçirilen fikirleri yönetme
- İl düzeyinde raporlama ve dışa aktarma
- Gerekli durumlarda nihai yönlendirme kararı verme

Kritik kural:

- İl AR-GE sorumlusu puan veya sonuç üzerinde değişiklik yaparsa zorunlu gerekçe girmeli ve işlem denetim kaydına alınmalıdır.

### 6.4. Bakanlık yetkilisi/komisyonu

Yetkileri:

- 81 ilden gönderilen onaylı adayları görme
- İl, ilçe, okul, kategori, dönem, puan ve durum filtrelerini kullanma
- Üç aylık seçim dönemlerini açma ve kapatma
- Her kategoriden bir fikir seçme
- Seçimi yayımlama veya geri çekme
- Ana sayfada görünecek seçilmiş fikirleri yönetme
- Arşivi yönetme
- Sertifika oluşturma ve okul müdürlüğüne gönderme
- Kriter şablonlarını, puanları ve adaylık eşiğini yönetme
- Küfür filtresi kelime listesini yönetme
- Ulusal raporları görüntüleme ve dışa aktarma

### 6.5. Sistem yöneticisi

Yetkileri:

- İl AR-GE ve Bakanlık kullanıcılarını oluşturma
- Rol ve il yetkisi atama
- Sistem ayarlarını yönetme
- Teknik logları ve sağlık durumunu izleme
- Başvuru içeriğini yalnızca görev gereği ve yetki dâhilinde görme
- Yedekleme ve geri yükleme işlemlerini yönetme

### 6.6. Okul müdürlüğü

İlk sürümde zorunlu bir okul müdürlüğü paneli planlanmamaktadır.

Okul müdürlüğü:

- Bakanlık tarafından oluşturulan sertifikanın e-posta alıcısı olacaktır.
- Gerekirse daha sonraki sürümde ayrı rol ve panel tanımlanabilir.

---

## 7. Uçtan uca temel iş akışı

```text
Öğrenci kayıt olur
        ↓
E-posta adresini doğrular
        ↓
Profil bilgilerini doldurur ve ilini seçer
        ↓
Kategori seçer, en fazla 1.500 karakterlik fikrini yazar
        ↓
Küfür/uygunsuz kelime filtresi çalışır
        ↓
Fikir seçilen ilin İl AR-GE gelen kutusuna düşer
        ↓
İl AR-GE başvuruyu okur ve değerlendirir/değerlendiriciye atar
        ↓
Kriterler doldurulur ve toplam puan hesaplanır
        ↓
Puan adaylık eşiğinin altında mı?
   ├── Evet → Değerlendirme tamamlandı
   └── Hayır → Ayın Fikri Adayları
                         ↓
                İl AR-GE sorumlusu onayı
                         ↓
                    Bakanlık havuzu
                         ↓
             Üç aylık kategori bazlı seçim
                         ↓
                  Ana sayfada yayın
                         ↓
               Dönem sonunda arşiv
                         ↓
           Sertifika → Okul müdürlüğü
```

---

## 8. Öğrenci kayıt ve profil sistemi

### 8.1. Kayıt alanları

Başlangıç için önerilen alanlar:

- Ad
- Soyad
- E-posta adresi
- Şifre
- İl
- İlçe
- Okul
- Sınıf/kademe
- Okul numarası
- KVKK aydınlatma metni onayı
- Kullanım koşulları onayı

### 8.2. İl seçimi

- Öğrenci profilinde ilini doğrudan seçer.
- İl listesi sistemde tanımlı 81 ilden oluşur.
- Öğrenci her fikir girişinde yeniden il seçmez; profilindeki il kullanılır.
- Fikir gönderildiği anda `province_id` fikir kaydına kopyalanır.
- Öğrenci sonradan profilindeki ili değiştirirse eski başvurular başka ile taşınmaz.
- İl değişikliğinin serbest mi yoksa onaylı mı olacağı “Açık kararlar” bölümünde kesinleştirilecektir.

### 8.3. Hesap doğrulama

- Başlangıç yöntemi e-posta doğrulamasıdır.
- Ücretli SMS hizmeti zorunlu olmayacaktır.
- Doğrulama bağlantıları tek kullanımlık ve süreli olacaktır.
- Şifre sıfırlama e-posta üzerinden yapılacaktır.
- Çok sayıda başarısız girişte hesap geçici olarak kilitlenecektir.

### 8.4. Profil güvenliği

- Şifreler düz metin tutulmayacaktır.
- Şifre hash işlemi ASP.NET Core Identity tarafından yönetilecektir.
- Kimlik doğrulama bilgileri tarayıcı `localStorage` alanında tutulmayacaktır.
- Üretimde Secure, HttpOnly ve uygun SameSite ayarlı çerezler kullanılacaktır.

---

## 9. Fikir oluşturma ve gönderme

### 9.1. Fikir kategorileri

Başlangıç kategori listesi:

1. Kültür ve Sanat
2. Spor ve Sağlıklı Yaşam
3. Bilim ve Teknoloji
4. Yapay Zekâ
5. Çevre ve Sürdürülebilirlik
6. Sosyal Sorumluluk
7. Girişimcilik
8. Afet Farkındalığı ve Güvenli Yaşam
9. Değerler Eğitimi
10. Yerli ve Millî Üretim – Millî Savunma

Kategori listesi kod içine sabitlenmeyecek; Bakanlık yetkisiyle aktif/pasif yapılabilecek yönetilebilir veri olacaktır.

### 9.2. Fikir metni

- En fazla 1.500 karakter kabul edilir.
- Boşluklar ve noktalama işaretleri sayaca dâhildir.
- Ekranda canlı sayaç gösterilir: `842 / 1.500 karakter`.
- Frontend sınırı kullanıcı deneyimi sağlar; gerçek güvenlik kontrolü backend üzerinde tekrar yapılır.
- Sadece boşluklardan oluşan veya anlamsız derecede kısa giriş kabul edilmez.
- Minimum uzunluk ürün kararıyla belirlenecektir.
- Girişler Unicode/UTF-8 olarak saklanır.
- HTML çalıştırılmaz; metin XSS saldırılarına karşı güvenli biçimde işlenir.

### 9.3. Taslak kaydetme

- Giriş yapmış öğrencinin taslakları sunucuda saklanır.
- Tarayıcı `localStorage` yalnızca geçici kullanıcı kolaylığı için kullanılabilir; tek kayıt kaynağı değildir.
- Taslaklar İl AR-GE panelinde görünmez.
- Gönderim tamamlandığında ayrı ve değiştirilemez bir gönderim zamanı kaydedilir.

### 9.4. Ekip olarak katılım

Kaynak PDF ve mevcut prototipte ekip özelliği bulunduğu için mimaride yeri ayrılacaktır.

Önerilen model:

- Bir fikir sahibi/başvuru sahibi bulunur.
- Diğer kayıtlı öğrenciler ekip üyesi olarak davet edilebilir.
- Davet kabul edilmeden ekip üyeliği kesinleşmez.
- Fikrin yönlendirileceği il, ana başvuru sahibinin gönderim anındaki ilidir.

Bu özelliğin ilk sürümde aktif olup olmayacağı açık karardır.

### 9.5. Silme kuralları

Öğrenci:

- Taslağını silebilir.
- Henüz değerlendirmeye başlanmamış gönderimini belirlenen süre içinde silebilir.
- Değerlendirmeye alınmış, aday olmuş, Bakanlığa gönderilmiş, planlamaya alınmış, hayata geçirilmiş veya seçilmiş fikri silemez.
- Silme işlemleri denetim kaydına alınır.

---

## 10. Küfür ve uygunsuz kelime filtresi

### 10.1. Genel yaklaşım

- AI veya LLM kullanılmayacaktır.
- İnternette bulunan Türkçe kelime listeleri başlangıç şablonu olarak incelenebilir.
- İnternetten alınan liste doğrudan üretime aktarılmayacaktır.
- Liste yanlış pozitifler, bağlam sorunları ve hatalı kelimeler için insan tarafından temizlenecektir.
- Nihai kelime listesi sistem veritabanında tutulacaktır.
- Bakanlık yetkilisi kelime ekleyebilecek, düzenleyebilecek, pasifleştirebilecek ve önem seviyesi belirleyebilecektir.

### 10.2. Normalleştirme

Kontrol öncesinde ayrı bir kopya üzerinde:

- Türkçe büyük/küçük harf dönüşümü yapılır.
- Gereksiz tekrar boşlukları sadeleştirilir.
- Harfler arasına nokta, tire veya boşluk koyma girişimleri değerlendirilir.
- Aşırı harf tekrarları normalize edilir.
- Basit rakam/harf değiştirmeleri için kurallar uygulanabilir.
- Kelime sınırları dikkate alınır.
- Asıl öğrenci metni değiştirilmeden saklanır; normalleştirilmiş metin sadece kontrol için kullanılır.

### 10.3. Filtre seviyeleri

Önerilen iki seviye:

- `Engelle`: Fikir gönderilemez; öğrenci metni düzeltmelidir.
- `İşaretle`: Fikir alınır ancak İl AR-GE ekranında inceleme uyarısı gösterilir.

İlk sürümde yalnızca `Engelle` kullanılacaksa veri modeli yine iki seviyeyi destekleyecek şekilde hazırlanabilir.

### 10.4. Kullanıcı mesajı

Uygunsuz kelime tespit edildiğinde:

- Kullanıcıya saldırgan kelime tekrar gösterilmez.
- “Metninizde uygun olmayan bir ifade tespit edildi. Lütfen metninizi gözden geçiriniz.” mesajı gösterilir.
- Deneme sayıları kötüye kullanım tespiti amacıyla sınırlı süreli güvenlik loguna yazılabilir.

### 10.5. Yönetim ve denetim

- Kelime listesindeki her değişiklik audit loguna yazılır.
- Değişikliği yapan kullanıcı, tarih ve önceki/yeni değer kaydedilir.
- Liste dışa aktarılabilir ve sürümlenebilir olmalıdır.
- Filtrenin yanlış pozitifleri raporlanabilmelidir.

---

## 11. İl AR-GE paneli

### 11.1. İl bazlı veri sınırı

- Her İl AR-GE personeline bir `province_id` atanır.
- Personelin göreceği il, tarayıcıdan gelen parametreyle belirlenmez.
- API her istekte oturumdaki kullanıcının rolünü ve ilini kontrol eder.
- Bütün liste, detay, arama, rapor ve dışa aktarma işlemleri bu il filtresine tabi olur.
- Başka ile ait bir kayıt ID'si bilinse dahi erişim reddedilir.
- PostgreSQL kullanılıyorsa Row-Level Security ek koruma olarak değerlendirilebilir.
- Bakanlık rolü yetkisi doğrultusunda bütün illeri görebilir.

### 11.2. Gösterge paneli

İl AR-GE ana ekranında:

- Toplam fikir
- Yeni gelen fikir
- Okunmamış fikir
- Değerlendirme bekleyen
- Değerlendirilen
- Adaylık eşiğini geçen
- İl AR-GE sorumlusu onayı bekleyen
- Bakanlığa gönderilen
- Planlamaya alınan
- Hayata geçirilen

sayıları gösterilir.

### 11.3. Gelen fikirler ekranı

Tablo alanları:

- Başvuru ID
- Yeni/okundu göstergesi
- Öğrenci adı ve soyadı
- İlçe
- Okul
- Sınıf/kademe
- Kategori
- Fikir özeti
- Gönderim tarihi
- Atanan değerlendirici
- Değerlendirme durumu
- `Değerlendir` veya `Değerlendiriciye Ata` işlemi

### 11.4. Okundu bilgisi

- Okundu bilgisi kullanıcı bazında tutulur.
- Bir değerlendiricinin okuduğu kayıt diğer değerlendirici için otomatik okundu sayılmaz.
- Detay ekranı açılınca otomatik okundu olarak işaretlenebilir.
- Yetkili kullanıcı manuel olarak okundu/okunmadı işaretleyebilir.
- Toplu okundu işlemi yetkiye bağlı olarak sağlanabilir.

### 11.5. Filtreler

- Yeni/okundu
- Başvuru ID
- Öğrenci adı
- İlçe
- Okul
- Sınıf/kademe
- Kategori
- Tarih aralığı
- Atanmış değerlendirici
- Atanmamış başvurular
- Değerlendirme durumu
- Puan aralığı
- Adaylık durumu
- Planlama/uygulama durumu

### 11.6. Değerlendiriciye atama

- İl AR-GE sorumlusu bir veya birden fazla değerlendirici atayabilir.
- Atama zamanı ve atayan kullanıcı kaydedilir.
- Değerlendiriciye platform içi bildirim ve gerekiyorsa e-posta gönderilir.
- Atama geri alınabilir veya başka değerlendiriciye devredilebilir.
- Bütün atama değişiklikleri audit loguna yazılır.

---

## 12. Değerlendirme sistemi

### 12.1. Değerlendir düğmesi

Başvurunun yanındaki `Değerlendir` düğmesi:

- Modal, sağ çekmece veya ayrı bir detay ekranı açar.
- Fikir metnini ve gerekli öğrenci/okul bilgilerini gösterir.
- Aktif değerlendirme şablonundaki kriterleri yükler.
- Kriterlerin tamamlanmasını zorunlu tutar.
- Toplam puanı anlık hesaplar.
- Değerlendirme notu eklenmesine izin verir.
- Tamamlanmamış değerlendirmeyi taslak olarak saklayabilir.

### 12.2. Başlangıç rubriği

Kaynak PDF'deki önerilen başlangıç rubriği:

| Kriter | Minimum | Maksimum |
|---|---:|---:|
| Özgünlük | 1 | 4 |
| Uygulanabilirlik | 1 | 4 |
| Toplumsal/eğitsel etki | 1 | 4 |
| Sürdürülebilirlik | 1 | 4 |
| İfade açıklığı | 1 | 4 |
| Toplam | 5 | 20 |

Bu kriterler başlangıç önerisidir; kesin kriterler ve adaylık eşiği ayrıca onaylanacaktır.

### 12.3. Yapılandırılabilir kriter modeli

Her kriter için:

- Ad
- Açıklama
- Yardım metni
- Giriş türü (`1–4 puan`, `evet/hayır`, `seçim`, gerekirse ağırlıklı puan)
- Minimum puan
- Maksimum puan
- Ağırlık
- Zorunluluk
- Sıra
- Aktif/pasif durumu

tutulur.

### 12.4. Şablon sürümleme

- Değerlendirme kriterleri şablon olarak sürümlenir.
- Yeni kriter seti eski değerlendirmeleri değiştirmez.
- Her değerlendirme kullanılan şablonun bir kopyasına/sürümüne bağlıdır.
- Dönem başladıktan sonra şablon değişikliği kontrollü yapılır.

### 12.5. Puan ve adaylık

- Toplam puan backend tarafından hesaplanır.
- Frontend hesaplaması yalnızca kullanıcı deneyimi içindir.
- Bakanlık tarafından yapılandırılan eşik puanını geçen fikir otomatik olarak `İl Aday Havuzu`na girer.
- Eşik altındaki fikir `Değerlendirme Tamamlandı` durumuna geçer.
- Eşik üstü olmak tek başına Bakanlığa gönderilmek anlamına gelmez.
- Bakanlığa gönderim için İl AR-GE sorumlusu onayı gerekir.

### 12.6. Birden fazla değerlendirici

Sistem bir veya birden fazla değerlendiriciyi destekleyecektir.

- Değerlendiriciler birbirlerinin puanlarını değerlendirme tamamlanmadan görmeyebilir.
- Ortalama, medyan veya sorumlu tarafından belirlenen nihai puan modeli yapılandırılabilir.
- Kaynak PDF'deki “iki puan arasında 6'dan fazla fark varsa üçüncü değerlendirici” kuralı isteğe bağlı sistem kuralı olarak desteklenebilir.
- Bu kuralın aktif olup olmayacağı kesinleştirilecektir.

### 12.7. İl AR-GE sorumlusu onayı

İl AR-GE sorumlusu aday ekranında:

- Fikir detayını görür.
- Bütün değerlendirici puanlarını görür.
- Kriter bazlı puan dağılımını görür.
- Değerlendirici notlarını görür.
- Bakanlığa gönderimi onaylar veya yeniden değerlendirmeye gönderir.
- Puanı/kararı değiştirirse zorunlu gerekçe girer.

---

## 13. İş akışı durumları

Tek bir durum alanı yerine bağımsız süreç alanları kullanılacaktır. Böylece bir fikir aynı anda hem hayata geçirilmiş hem Bakanlığa aday olabilir.

### 13.1. Başvuru durumu

- `Draft`
- `Submitted`
- `InEvaluation`
- `EvaluationCompleted`
- `Locked`
- `Deleted`

### 13.2. Gelen kutusu durumu

- `Unread`
- `Read`
- `Assigned`

Okunma bilgisi kullanıcı bazında ayrı tabloda tutulur.

### 13.3. Adaylık ve Bakanlık durumu

- `NotCandidate`
- `ProvinceCandidate`
- `ProvinceApprovalPending`
- `ProvinceApproved`
- `SentToMinistry`
- `MinistryReview`
- `Selected`
- `NotSelected`

### 13.4. Uygulama durumu

- `None`
- `Planned`
- `Implemented`

### 13.5. Yayın durumu

- `NotPublished`
- `Scheduled`
- `Published`
- `Archived`
- `Unpublished`

Her durum değişimi ayrı geçmiş kaydı üretir.

---

## 14. Planlamaya alınan ve hayata geçirilen fikirler

### 14.1. Planlamaya alındı

Önerilen alanlar:

- Planlama açıklaması
- Sorumlu kurum/birim
- Hedef başlangıç tarihi
- Hedef bitiş tarihi
- Notlar
- Durumu değiştiren kullanıcı
- Değişiklik tarihi

### 14.2. Hayata geçirildi

`Hayata Geçirildi` seçildiğinde zorunlu modal açılır.

Zorunlu alanlar:

- İlişkilendirilen proje/program adı
- İlişki açıklaması
- Uygulayan okul/kurum
- Uygulama tarihi
- Sorumlu birim

İsteğe bağlı alanlar:

- Uygulama sonucu
- Yararlanıcı sayısı
- Kanıt belge/fotoğraf
- İlgili bağlantı
- Ek açıklama

Örnek ilişki açıklaması:

> “Bu fikir, X Projesi kapsamında Y okulunda uygulanmıştır.”

### 14.3. Bağımsızlık

- `Implemented` durumu adaylığı otomatik iptal etmez.
- Hayata geçirilen fikir Bakanlığa aday olarak gönderilebilir.
- Bakanlık raporlarında hem seçim hem uygulama durumu birlikte filtrelenebilir.

---

## 15. Bakanlık paneli

### 15.1. Genel görünüm

Bakanlık panelinde:

- 81 ilden gelen aday sayısı
- İl bazlı dağılım
- Kategori bazlı dağılım
- Dönem bazlı dağılım
- Ortalama puanlar
- Bakanlık incelemesi bekleyenler
- Seçilen fikirler
- Planlamaya alınanlar
- Hayata geçirilenler
- Sertifika gönderim durumu

gösterilir.

### 15.2. Aday havuzu

Bakanlık yalnızca İl AR-GE sorumlusu tarafından onaylanıp gönderilmiş adayları görür.

Filtreler:

- Üç aylık seçim dönemi
- İl
- İlçe
- Okul
- Sınıf/kademe
- Kategori
- Puan aralığı
- Uygulama durumu
- Sertifika durumu
- Gönderim tarihi

### 15.3. Bakanlık değerlendirmesi

Bakanlık:

- İl değerlendirmelerini görür.
- Gerekirse Bakanlık değerlendirme notu ekler.
- Kategoriye göre adayları karşılaştırır.
- Her kategori için bir fikir seçer.
- Yeterli aday yoksa ilgili kategoriyi boş bırakabilmelidir.
- Seçim kararını yayımlamadan önce önizleyebilir.
- Seçim değişikliğini gerekçe ile ve audit log kaydıyla yapabilir.

---

## 16. Üç aylık seçim dönemleri

### 16.1. Dönem yapısı

Başlangıç takvimi:

- 1. dönem: Ocak–Mart
- 2. dönem: Nisan–Haziran
- 3. dönem: Temmuz–Eylül
- 4. dönem: Ekim–Aralık

Dönemler veritabanında kayıt olarak tutulacak ve kod içine sabitlenmeyecektir.

Her dönem için:

- Dönem adı
- Başlangıç tarihi
- Bitiş tarihi
- Aday kabul başlangıç/bitiş tarihi
- Bakanlık değerlendirme başlangıç/bitiş tarihi
- Yayın başlangıcı
- Yayın bitişi
- Durum (`Hazırlık`, `Açık`, `Değerlendirmede`, `Yayınlandı`, `Arşivlendi`)

tutulur.

### 16.2. Kategori kotası

- Her üç aylık dönemde her kategoriden en fazla bir Bakanlık seçimi yapılır.
- Aynı fikir aynı dönemde birden fazla kategorinin kazananı olamaz.
- Kategori sayısı değişirse dönem kuralları buna uyum sağlar.
- İl başına kategori bazlı kaç aday gönderilebileceği açık karardır.

### 16.3. “Ayın Fikri” adı

Seçim üç ayda bir yapılmasına rağmen kullanıcı arayüzünde mevcut `Ayın Fikri` adı korunacaktır. İleride `Dönemin Fikri` adlandırmasına geçilmek istenirse veri modelini değiştirmeden yalnızca metinler güncellenebilir.

---

## 17. Ana sayfa ve Ayın Fikri Arşivi

### 17.1. Ana sayfa

Mevcut ana sayfadaki görsel kart/kaydırıcı yapısı korunarak dinamik veriye bağlanacaktır.

Ana sayfada aktif dönemin seçilmiş fikirleri gösterilir:

- Kategori
- Öğrenci adı veya KVKK kararına göre maskelenmiş adı
- İl
- Okul bilgisi yayımlanacaksa okul
- Fikir özeti
- Seçim dönemi
- Kategori simgesi

### 17.2. Yayın kuralları

- Bakanlık seçimi yayımladığında kayıt `Published` durumuna geçer.
- `published_from` ve `published_until` tarihleri tutulur.
- Sadece aktif tarih aralığındaki seçilmiş fikirler ana sayfada görünür.
- Veriler JavaScript dosyasına sabit yazılmaz.
- Ana sayfa API üzerinden yalnızca yayıma uygun, kişisel verileri sınırlandırılmış veri alır.

### 17.3. Arşiv

- Yayın dönemi biten fikir silinmez.
- Otomatik işlem yayını `Archived` durumuna geçirir.
- Arşiv dönem, yıl, kategori ve il bazında filtrelenebilir.
- Arşiv kayıtları kalıcı bağlantıya sahip olabilir.
- Bakanlık gerekli durumda bir yayını kaldırabilir; kaldırma gerekçesi loglanır.

### 17.4. Otomatik dönem işlemi

Arka plan görevi:

1. Yayın bitiş tarihi geçen fikirleri bulur.
2. Ana sayfa aktif listesinden çıkarır.
3. Arşiv durumuna geçirir.
4. Yeni aktif dönemin seçilmiş fikirlerini yayımlar.
5. Başarı/hata kaydı üretir.

İşlem zaman dilimi `Europe/Istanbul` olarak yapılandırılır.

---

## 18. Sertifika sistemi

### 18.1. Tetikleme

- Bakanlık tarafından seçilen fikir için sertifika üretilebilir.
- Sertifika yayından önce taslak/önizleme olarak hazırlanabilir.
- Yetkili onayıyla kesin sertifika oluşturulur.

### 18.2. Sertifika içeriği

- Öğrenci adı ve soyadı
- Okul
- İl
- Fikir kategorisi
- Fikir adı veya kısa özeti
- Seçim dönemi
- Belge numarası
- Düzenlenme tarihi
- Yetkili imza/görsel alanı
- QR veya doğrulama kodu

### 18.3. Teslimat

- Sertifika okul müdürlüğünün sistemde kayıtlı resmî e-posta adresine gönderilir.
- Okul müdürlüğü e-posta adresi öğrenci tarafından serbestçe girilmemelidir.
- Okul iletişim verisinin kaynağı ve doğrulama yöntemi kesinleştirilecektir.
- Gönderim başarılı/başarısız durumu kaydedilir.
- Başarısız gönderim yeniden denenir.
- Yetkili kullanıcı sertifikayı yeniden gönderebilir.

### 18.4. Taşınabilir PDF üretimi

- Uygulama `IDocumentGenerator` benzeri bir arayüz kullanır.
- Ücretsiz ve lisansı uygun bir .NET PDF kütüphanesi tercih edilir.
- Sunucu Chromium çalıştırmaya izin verirse HTML → PDF yöntemi kullanılabilir.
- Chromium yasaksa saf .NET PDF üreticisine geçilebilir.
- Ücretli harici PDF API'sine zorunlu bağımlılık kurulmaz.

---

## 19. Bildirim ve e-posta sistemi

### 19.1. Platform içi bildirimler

Örnek olaylar:

- Fikir başarıyla gönderildi.
- Fikir değerlendirmeye alındı.
- Değerlendirme tamamlandı.
- Fikir İl Aday Havuzuna girdi.
- Fikir Bakanlığa gönderildi.
- Fikir üç aylık dönemde seçildi.
- Fikir planlamaya alındı.
- Fikir hayata geçirildi.

### 19.2. E-posta

- Kullanıcı doğrulama
- Şifre sıfırlama
- Kritik durum bildirimleri
- Değerlendirici atama bildirimi
- Okul müdürlüğüne sertifika gönderimi

### 19.3. Taşınabilirlik

- E-posta `IEmailSender` benzeri bir arayüz üzerinden gönderilir.
- Geliştirmede yerel/test SMTP kullanılabilir.
- Üretimde YEĞİTEK/MEB SMTP kullanılabilir.
- SMTP sunucusu kod değişmeden yapılandırmadan değiştirilebilir.
- E-postalar arka planda gönderilir.
- Gönderim kuyruğu, yeniden deneme ve hata kaydı bulunur.

---

## 20. Erişilebilirlik ve kapsayıcılık

Hedef standart: WCAG 2.2 AA.

### 20.1. Sağ erişilebilirlik paneli

Mevcut sağ panel korunur ve şu özellikleri destekler:

- Koyu mod
- Yazı boyutu
- Disleksi dostu yazı tipi
- Yüksek kontrast
- Bağlantıları vurgulama
- İmleç görünümü
- Animasyonları durdurma
- Ekran okuyucu uyumlu sayfa okuma desteği

### 20.2. Temel erişilebilirlik

Panel, erişilebilir tasarımın yerine geçmez. Bütün ekranlar varsayılan olarak:

- Klavyeyle tamamen kullanılabilir olmalı.
- Görünür odak işareti sağlamalı.
- Semantik HTML kullanmalı.
- Form alanlarında doğru `label` bağlantıları bulunmalı.
- Hata mesajları ekran okuyucu tarafından duyurulmalı.
- Modal açıldığında odak modal içine taşınmalı ve kapanınca önceki elemana dönmeli.
- Renk tek başına durum göstergesi olmamalı.
- Kontrast oranları standartlara uygun olmalı.
- 360 piksel ve üzeri mobil ekranlarda kullanılabilir olmalı.
- Tablo içerikleri küçük ekranda erişilebilir biçimde kaydırılabilmeli veya kart görünümüne dönüşebilmelidir.
- `prefers-reduced-motion` ayarına saygı göstermelidir.

### 20.3. Dezavantajlı gruplar

- Sade ve yaş grubuna uygun metinler kullanılacaktır.
- İkonlar metinle desteklenecektir.
- Hatalar yalnızca renk veya titreşimle anlatılmayacaktır.
- Ekran okuyucu testleri manuel olarak yapılacaktır.
- Mobil ve düşük hızlı bağlantı senaryoları test edilecektir.

---

## 21. Raporlama

### 21.1. İl raporları

İl AR-GE yalnızca kendi iline ait:

- Başvuru sayıları
- Kategori dağılımı
- İlçe/okul dağılımı
- Değerlendirme sonuçları
- Ortalama puanlar
- Adaylar
- Bakanlığa gönderilenler
- Planlamaya alınanlar
- Hayata geçirilenler

raporlarını görebilir.

### 21.2. Bakanlık raporları

Bakanlık:

- 81 il toplamları
- İl karşılaştırmaları
- Kategori dağılımları
- Üç aylık dönem karşılaştırmaları
- Adaylık ve seçim oranları
- Planlanan ve uygulanan fikirler
- Sertifika teslim durumları

raporlarını görebilir.

### 21.3. Dışa aktarma

- Filtrelenmiş sonuçlar Excel uyumlu dosya olarak indirilebilir.
- PDF rapor üretilebilir.
- Dışa aktarma işlemi kullanıcının veri yetkisine tabidir.
- İl kullanıcısı dışa aktarma ile başka ilin verisini alamaz.
- Büyük raporlar arka planda hazırlanabilir.
- Her dışa aktarma işlemi audit loguna yazılır.

---

## 22. Teknik mimari

### 22.1. Genel yapı

```text
React + TypeScript + Vite
            ↓ HTTPS / JSON API
ASP.NET Core 10 Web API
            ↓ Entity Framework Core
PostgreSQL 18

Yan servisler:
- SMTP
- Dosya saklama
- PDF/Excel üretimi
- Arka plan işleri
- Audit ve uygulama logları
```

### 22.2. Backend katmanları

```text
Backend/
├── Domain/
│   ├── Entities
│   ├── ValueObjects
│   ├── Enums
│   ├── DomainServices
│   └── BusinessRules
├── Application/
│   ├── UseCases
│   ├── Commands
│   ├── Queries
│   ├── Interfaces
│   ├── DTOs
│   └── Validation
├── Infrastructure/
│   ├── Persistence
│   ├── Identity
│   ├── Email
│   ├── FileStorage
│   ├── Documents
│   └── BackgroundJobs
└── Api/
    ├── Endpoints
    ├── Authorization
    ├── Middleware
    └── Configuration
```

### 22.3. Modüller

- Identity
- StudentProfiles
- Ideas
- ProfanityFilter
- ProvinceInbox
- Evaluations
- ProvinceApprovals
- MinistrySelections
- ImplementationTracking
- Publications
- Archive
- Certificates
- Notifications
- Reporting
- Administration
- Audit

Modüller aynı uygulama içinde çalışır fakat birbirlerinin verilerine doğrudan kontrolsüz erişmez.

### 22.4. Frontend yapısı

```text
Frontend/
├── app/
├── pages/
│   ├── public/
│   ├── student/
│   ├── province-admin/
│   └── ministry-admin/
├── features/
├── components/
├── services/
├── accessibility/
├── styles/
└── assets/
```

### 22.5. İki panel, tek uygulama

- İl AR-GE paneli ve Bakanlık paneli aynı React uygulamasında ayrı route ve layout kullanabilir.
- Backend aynı API üzerinde rol/politika bazlı erişim sağlar.
- İki ayrı kod tabanı oluşturulmaz.
- Ortak tablo, form, erişilebilirlik ve rapor bileşenleri tekrar kullanılabilir.

---

## 23. Önerilen depo yapısı

```text
Fikir_Platformu/
├── frontend/                 # React + TypeScript + Vite
├── backend/
│   ├── src/
│   │   ├── Domain/
│   │   ├── Application/
│   │   ├── Infrastructure/
│   │   └── Api/
│   └── tests/
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── documentation/
├── tests/
│   ├── e2e/
│   ├── accessibility/
│   └── performance/
├── docs/
├── deploy/
│   ├── linux/
│   ├── windows/
│   └── containers/
└── README.md
```

Mevcut HTML/CSS/JS prototipi, yeni frontend'e geçiş boyunca referans ve görsel temel olarak korunacaktır.

---

## 24. Başlangıç veri modeli

### 24.1. Kimlik ve organizasyon

- `users`
- `roles`
- `user_roles`
- `provinces`
- `districts`
- `schools`
- `student_profiles`
- `staff_profiles`

### 24.2. Fikirler

- `ideas`
- `idea_drafts`
- `idea_categories`
- `idea_members`
- `idea_status_history`
- `idea_read_receipts`
- `idea_assignments`

### 24.3. Değerlendirme

- `evaluation_templates`
- `evaluation_template_versions`
- `evaluation_criteria`
- `evaluations`
- `evaluation_scores`
- `evaluation_comments`
- `province_candidate_approvals`

### 24.4. Bakanlık ve yayın

- `selection_periods`
- `ministry_candidates`
- `ministry_decisions`
- `selected_ideas`
- `publications`
- `archive_entries`

### 24.5. Uygulama takibi

- `implementation_statuses`
- `implementation_links`
- `implementation_attachments`

### 24.6. Sertifika ve iletişim

- `certificates`
- `certificate_deliveries`
- `school_contacts`
- `notifications`
- `email_outbox`
- `email_delivery_logs`

### 24.7. Güvenlik ve yönetim

- `blocked_terms`
- `blocked_term_versions`
- `audit_logs`
- `system_settings`
- `background_job_logs`

### 24.8. Kritik veri ilkeleri

- Bir fikir, gönderim anındaki `province_id` değerini taşır.
- Öğrenci profilindeki il değişse de eski fikrin ili değişmez.
- Değerlendirme kriteri ve açıklaması değerlendirme anında sürüm olarak saklanır.
- Durum değişiklikleri üzerine yazılmaz; geçmiş tablosuna eklenir.
- Bakanlık seçimi ve yayın işlemleri denetlenebilir kayıt üretir.
- Sertifika dosyasının hash/değişmez doğrulama bilgisi saklanabilir.

---

## 25. Örnek API alanları

### 25.1. Kimlik ve profil

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/reference/provinces`
- `GET /api/reference/categories`

### 25.2. Öğrenci fikirleri

- `GET /api/student/ideas`
- `POST /api/student/ideas/drafts`
- `PUT /api/student/ideas/drafts/{id}`
- `POST /api/student/ideas/{id}/submit`
- `GET /api/student/ideas/{id}`
- `DELETE /api/student/ideas/{id}`

### 25.3. İl AR-GE

- `GET /api/province/inbox`
- `GET /api/province/ideas/{id}`
- `POST /api/province/ideas/{id}/read`
- `POST /api/province/ideas/{id}/assign`
- `POST /api/province/ideas/{id}/evaluations`
- `PUT /api/province/evaluations/{id}`
- `POST /api/province/evaluations/{id}/complete`
- `GET /api/province/candidates`
- `POST /api/province/candidates/{id}/approve`
- `POST /api/province/candidates/{id}/return`
- `POST /api/province/ideas/{id}/planning`
- `POST /api/province/ideas/{id}/implementation`

### 25.4. Bakanlık

- `GET /api/ministry/candidates`
- `GET /api/ministry/candidates/{id}`
- `POST /api/ministry/periods`
- `PUT /api/ministry/periods/{id}`
- `POST /api/ministry/periods/{id}/open`
- `POST /api/ministry/periods/{id}/close`
- `POST /api/ministry/selections`
- `POST /api/ministry/selections/{id}/publish`
- `POST /api/ministry/selections/{id}/unpublish`
- `POST /api/ministry/certificates/{ideaId}/generate`
- `POST /api/ministry/certificates/{id}/send`

### 25.5. Kamuya açık

- `GET /api/public/current-selections`
- `GET /api/public/archive`
- `GET /api/public/archive/{id}`
- `GET /api/public/certificates/verify/{code}`

Gerçek endpoint isimleri uygulama geliştirilirken REST tutarlılığına göre kesinleştirilecektir.

---

## 26. Yetkilendirme ve veri güvenliği

### 26.1. Temel kurallar

- Her API işlemi sunucuda yetkilendirilir.
- Frontend'de düğmenin gizlenmesi güvenlik sayılmaz.
- Kullanıcı rolü ve il bilgisi güvenilir sunucu oturumundan alınır.
- Kullanıcının gönderdiği `province_id` yönetim sorgularında güvenilir kabul edilmez.
- İl personelinin bütün sorguları kendi iline sınırlandırılır.
- Bakanlık kullanıcıları yalnızca tanımlı Bakanlık yetkileriyle ulusal verilere ulaşır.
- Sistem yöneticisi rolü günlük iş kullanıcılarına verilmez.

### 26.2. Uygulama güvenliği

- HTTPS zorunlu
- Secure ve HttpOnly çerezler
- CSRF koruması
- XSS önleme ve güvenli çıktı kodlama
- SQL injection'a karşı parametreli sorgular/EF Core
- Giriş ve kayıt hız sınırlaması
- Parola deneme kilidi
- E-posta doğrulama
- Yönetici hesapları için MFA hazırlığı
- Güvenlik başlıkları
- Dosya yükleme türü/boyutu kontrolü
- Yükleme varsa zararlı yazılım taraması için adaptör
- Hassas bilgilerin loglara yazılmaması

### 26.3. KVKK ve veri minimizasyonu

- Sadece iş için gerekli kişisel bilgiler toplanır.
- Kamuya açık ana sayfada öğrenci adının gösterim şekli ayrıca onaylanır.
- Aydınlatma metni sürümü ve onay zamanı kaydedilir.
- Verilerin saklama ve silme süreleri Bakanlık politikasıyla belirlenir.
- Raporlarda gereksiz kişisel bilgi gösterilmez.
- Yedekler de kişisel veri politikalarına tabidir.

---

## 27. Audit ve izlenebilirlik

Audit kaydına alınacak örnek işlemler:

- Personel hesabı oluşturma ve rol değiştirme
- İl yetkisi atama
- Başvuruyu değerlendiriciye atama
- Değerlendirme tamamlama
- Puan veya nihai karar değiştirme
- İl adayını Bakanlığa gönderme
- Bakanlık seçimi yapma/değiştirme
- Yayına alma/yayından kaldırma
- Planlamaya alma/hayata geçirme
- Sertifika oluşturma ve gönderme
- Küfür filtresi kelime listesi değişikliği
- Rapor dışa aktarma
- Kişisel veri görüntüleyen kritik yönetim işlemleri

Audit kaydı:

- Kullanıcı ID
- İşlem tipi
- Hedef kayıt ID
- Tarih/saat
- IP/istemci bilgisi, politika izin veriyorsa
- Önceki değer
- Yeni değer
- Gerekçe
- Korelasyon/istek ID

içerebilir.

Normal uygulama logları ile audit kayıtları birbirinden ayrılacaktır.

---

## 28. Netlify geliştirme ve yayın planı

### 28.1. Şimdiki kullanım

- Mevcut HTML/CSS/JS prototipi Netlify'da yayımlanmaya devam edebilir.
- Yeni React/Vite frontend statik `dist` çıktısı olarak Netlify'a gönderilebilir.
- Netlify görsel demo, tasarım onayı ve frontend önizlemesi için kullanılacaktır.
- Gerçek öğrenci verileri backend ve resmî veri ortamı hazır olmadan kullanılmamalıdır.

### 28.2. Kullanılmayacak Netlify bağımlılıkları

- Netlify Functions
- Netlify Database
- Netlify Identity
- Netlify Blobs
- Netlify'a özel iş akışları
- Netlify'a özel kullanıcı veya rol sistemi

### 28.3. Yapılandırma

Frontend API adresi:

- Yerel: `http://localhost:5000/api`
- Test: test API adresi
- Üretim: YEĞİTEK tarafından verilecek alan adı

üzerinden ortam değişkeniyle belirlenir.

### 28.4. Netlify sınırı

Netlify ücretsiz planı prototip için uygundur ancak üretim kapasitesi ve kişisel veri barındırma kararı olarak kabul edilmeyecektir.

---

## 29. YEĞİTEK'e geçiş planı

### 29.1. YEĞİTEK'ten istenecek bilgiler

1. İşletim sistemi ve sürümü
2. CPU, RAM ve disk kapasitesi
3. PostgreSQL kullanım/kurulum izni
4. Kurumun zorunlu tuttuğu veritabanı sistemi
5. Konteyner/Podman/Docker/Kubernetes desteği
6. IIS, Nginx veya kurum reverse proxy bilgisi
7. Alan adı, DNS ve TLS/SSL yönetimi
8. Kurumsal SMTP bilgileri
9. Dosya depolama alanı ve kotası
10. Veritabanı ve dosya yedekleme sorumluluğu
11. Dış internet/paket deposu erişim kısıtları
12. Güvenlik duvarı ve açılabilecek portlar
13. Loglama ve izleme entegrasyonu
14. Uygulama yayınlama ve güncelleme prosedürü
15. Test, ön üretim ve üretim ortamlarının bulunup bulunmadığı

### 29.2. Desteklenen dağıtım biçimleri

Uygulama aşağıdaki biçimlerde hazırlanabilir:

- Linux üzerinde ASP.NET Core + systemd
- Linux üzerinde Podman/Docker konteyneri
- Windows Server üzerinde IIS
- Kurum Kubernetes platformunda konteyner
- .NET runtime kurulu framework-dependent paket
- Gerekirse runtime'ı içinde self-contained paket

### 29.3. Veritabanı değişikliği

Başlangıç PostgreSQL'dir. YEĞİTEK başka bir veritabanını zorunlu tutarsa:

- EF Core sağlayıcısı değiştirilir.
- Veritabanı migration'ları hedef sisteme göre yeniden hazırlanır.
- Sağlayıcıya özel veri tipleri ve sorgular uyarlanır.
- Büyük/küçük harf, tarih, JSON ve metin arama davranışları test edilir.
- RLS gibi sağlayıcı özelliklerinin karşılığı veya uygulama katmanı kontrolü kullanılır.
- Bütün entegrasyon ve yetki testleri hedef veritabanında yeniden çalıştırılır.

Domain ve Application katmanlarındaki iş kuralları değişmemelidir.

---

## 30. Ücretsiz ve açık kaynak yaklaşımı

### 30.1. Temel bileşenler

| İhtiyaç | Başlangıç seçimi | Yaklaşım |
|---|---|---|
| Frontend | React + TypeScript + Vite | Açık kaynak, statik derleme |
| Backend | ASP.NET Core 10 | Açık kaynak, LTS |
| Veritabanı | PostgreSQL 18 | Açık kaynak |
| Veri erişimi | Entity Framework Core | Açık kaynak |
| Kimlik | ASP.NET Core Identity | Uygulama içinde |
| Grafik | Chart.js veya uygun açık kaynak alternatif | Sağlayıcı bağımsız |
| PDF | Ücretsiz lisanslı yerel kütüphane | Harici API yok |
| Excel | Open XML tabanlı ücretsiz kütüphane | Harici API yok |
| Test | xUnit + Playwright | Otomatik test |
| Reverse proxy | Nginx/IIS | Sunucuya göre |
| Konteyner | Podman veya kurum standardı | Zorunlu değil |
| İzleme | OpenTelemetry ve kurum sistemi | Sağlayıcı bağımsız |

### 30.2. Kalite ilkesi

“Ücretsiz” seçim tek başına yeterli değildir. Bir bileşen ancak şu şartlarda kullanılacaktır:

- Lisansı kurum kullanımına uygun olmalı.
- Aktif geliştirilmelidir.
- Güvenlik güncellemesi almalıdır.
- Geniş ve güvenilir topluluğa sahip olmalıdır.
- Dokümantasyonu yeterli olmalıdır.
- Sunucuda çevrimdışı/kurum içi çalışabilmelidir.
- Sağlayıcı kilidi oluşturmamalıdır.
- Yerine başka uygulama konabilecek bir arayüz arkasında kullanılmalıdır.

---

## 31. Performans ve ölçeklenebilirlik

Kesin eş zamanlı kullanıcı hedefi YEĞİTEK ve Bakanlık ile belirlenecektir.

Başlangıç ilkeleri:

- API işlemleri sayfalama kullanır.
- Büyük tablolar bütün kayıtları tek seferde indirmez.
- Arama alanlarına uygun veritabanı indeksleri eklenir.
- İl ve dönem filtreleri temel indekslerin parçası olur.
- Büyük Excel/PDF raporları arka planda hazırlanır.
- E-posta gönderimi web isteğini bekletmez.
- Ana sayfa aktif seçimleri önbelleğe alınabilir.
- Uygulama birden fazla örnekle yatay ölçeklenebilir olacak şekilde oturumsuz tasarlanır.
- Kullanıcı oturumları merkezi/veritabanı destekli veya şifreli çerez temelli olur.
- Yük testleri hedef sunucu belli olduğunda yapılır.

---

## 32. Yedekleme ve felaket kurtarma

Üretim öncesinde aşağıdakiler kesinleştirilmelidir:

- Veritabanı günlük yedekleme
- Kritik dönemlerde daha sık yedekleme
- Sertifika ve ek dosya yedekleme
- Yedeklerin ayrı depolama alanında tutulması
- Yedek şifreleme
- Saklama süresi
- Geri yükleme prosedürü
- Düzenli geri yükleme testi
- Sorumlu ekip ve iletişim zinciri
- Hedef RPO/RTO değerleri

Yedek alınmış olması yeterli sayılmaz; geri yükleme testi yapılmalıdır.

---

## 33. Test stratejisi

### 33.1. Birim testleri

- 1.500 karakter sınırı
- Durum geçiş kuralları
- Adaylık puan hesabı
- İl bazlı yetki kuralları
- Üç aylık dönem hesapları
- Yayın/arşiv tarih kuralları
- Küfür filtresi normalleştirme
- Sertifika uygunluğu

### 33.2. Entegrasyon testleri

- PostgreSQL veri işlemleri
- Kullanıcı kayıt/giriş
- İl kullanıcısının başka ile erişememesi
- Değerlendirme kaydı
- Bakanlığa aday gönderme
- SMTP test sunucusu
- PDF üretimi
- Arka plan işleri

### 33.3. Uçtan uca testler

- Öğrenci kayıt → fikir gönderme
- Fikir → doğru İl AR-GE paneli
- Değerlendir → eşik → adaylık
- İl sorumlusu onayı → Bakanlık paneli
- Bakanlık seçimi → ana sayfa
- Dönem sonu → arşiv
- Sertifika → okul e-postası
- Mobil ve masaüstü ekranlar

### 33.4. Güvenlik testleri

- Yetkisiz API erişimi
- ID değiştirerek başka il kaydına erişim
- XSS girişleri
- SQL injection denemeleri
- CSRF
- Hız sınırlama
- Parola kilitleme
- Dosya yükleme saldırıları
- Hassas veri log kontrolü

### 33.5. Erişilebilirlik testleri

- Otomatik WCAG taraması
- Klavye ile manuel gezinme
- Ekran okuyucu testi
- Kontrast testi
- %200 yakınlaştırma
- Mobil ekran testi
- Animasyon azaltma testi

### 33.6. Veritabanı taşınabilirlik testleri

- Domain ve Application testleri veritabanından bağımsız çalışır.
- PostgreSQL entegrasyon testleri ayrı çalışır.
- Hedef veritabanı değişirse aynı entegrasyon test paketi yeni sağlayıcıda çalıştırılır.

---

## 34. Geliştirme ve teslim aşamaları

### Aşama 0 — Gereksinim mutabakatı

Çıktılar:

- Bu planın onaylanması
- Açık kararların kapatılması
- Rol/yetki matrisi
- Kesin değerlendirme kriterleri
- Kesin puan eşiği
- Form alanları
- KVKK gösterim kuralları

Tamamlanma ölçütü:

- Ürün sahibi ve ilgili yetkililer temel iş akışında mutabık kalmıştır.

### Aşama 1 — Teknik temel ve depo düzeni

Çıktılar:

- Frontend/backend klasör yapısı
- React/Vite başlangıcı
- ASP.NET Core çözümü ve katmanlar
- PostgreSQL geliştirme ortamı
- Temel CI kontrolleri
- Ortam yapılandırması
- Sağlık kontrol endpoint'i

Tamamlanma ölçütü:

- Frontend ve backend yerelde birlikte çalışır.
- Netlify frontend önizlemesi üretilebilir.

### Aşama 2 — Kimlik ve öğrenci profili

Çıktılar:

- Kayıt
- E-posta doğrulama
- Giriş/çıkış
- Şifre sıfırlama
- Profil
- İl seçimi
- Roller

Tamamlanma ölçütü:

- Doğrulanmış öğrenci hesabı profilini oluşturabilir.
- Yetkisiz kullanıcı özel alanlara erişemez.

### Aşama 3 — Fikir girişi

Çıktılar:

- Kategori seçimi
- 1.500 karakter sayacı
- Taslak kaydetme
- Küfür filtresi
- Fikir gönderme
- Öğrenci fikir listesi ve süreç takibi

Tamamlanma ölçütü:

- Fikir doğru il kaydıyla oluşturulur.
- Uygunsuz içerik kurala göre engellenir/işaretlenir.

### Aşama 4 — İl AR-GE gelen kutusu

Çıktılar:

- İl bazlı veri sınırı
- Yeni/okundu
- Filtreler ve arama
- Değerlendirici atama
- Başvuru detay ekranı

Tamamlanma ölçütü:

- İl personeli başka ilin verisini hiçbir API üzerinden göremez.

### Aşama 5 — Değerlendirme ve adaylık

Çıktılar:

- Kriter şablonları
- Değerlendirme ekranı
- Otomatik puan
- Puan eşiği
- Aday havuzu
- İl AR-GE sorumlusu onayı
- Audit kayıtları

Tamamlanma ölçütü:

- Eşik üstü fikirler otomatik adaylaşır.
- Onaylı aday Bakanlık paneline düşer.

### Aşama 6 — Bakanlık ve üç aylık seçim

Çıktılar:

- Bakanlık paneli
- 81 il filtreleri
- Üç aylık dönem yönetimi
- Kategori bazlı seçim
- Yayın onayı

Tamamlanma ölçütü:

- Bakanlık her kategoriden en fazla bir fikir seçip yayımlayabilir.

### Aşama 7 — Ana sayfa, arşiv ve sertifika

Çıktılar:

- Dinamik ana sayfa kartları
- Aktif dönem yayını
- Otomatik arşiv
- Arşiv filtreleri
- Sertifika üretimi
- Okul müdürlüğüne e-posta

Tamamlanma ölçütü:

- Seçilen fikir üç ay gösterilir ve dönem sonunda arşive geçer.
- Sertifika teslim durumu izlenebilir.

### Aşama 8 — Planlama, hayata geçirme ve raporlama

Çıktılar:

- Planlamaya alma
- Hayata geçirildi modalı
- Proje ilişkilendirmesi
- İl raporları
- Bakanlık raporları
- Excel/PDF dışa aktarma

Tamamlanma ölçütü:

- Uygulanan fikir zorunlu proje ilişki bilgileri olmadan kaydedilemez.

### Aşama 9 — Güvenlik, erişilebilirlik ve performans

Çıktılar:

- WCAG kontrolleri
- Güvenlik testi
- Yük testi
- Log ve izleme
- Yedekleme/geri yükleme testi
- Hata senaryoları

Tamamlanma ölçütü:

- Kritik güvenlik açığı yoktur.
- Temel erişilebilirlik kabul kriterleri sağlanır.
- Geri yükleme testi başarılıdır.

### Aşama 10 — YEĞİTEK uyarlaması ve üretim

Çıktılar:

- Hedef sunucu profili
- Dağıtım paketi
- Hedef veritabanı doğrulaması
- Alan adı/TLS
- SMTP
- Yedekleme
- İzleme
- Üretim kontrol listesi

Tamamlanma ölçütü:

- Uygulama YEĞİTEK test ortamında başarıyla çalışır.
- Yetki, güvenlik, e-posta, rapor, yayın ve yedekleme testleri tamamlanır.

---

## 35. Modül bazlı kabul kriterleri

### 35.1. Öğrenci

- Öğrenci kayıt olabilir ve e-postasını doğrulayabilir.
- İlini profilinde seçebilir.
- 1.500 karakterden uzun fikir gönderemez.
- Uygunsuz kelime kuralı hem frontend hem backend tarafından uygulanır.
- Fikrinin durum geçmişini görebilir.

### 35.2. İl AR-GE

- Giriş yapan kullanıcı yalnızca kendi ilini görür.
- Başvurular yeni/okundu olarak yönetilebilir.
- Kriter ekranı `Değerlendir` düğmesiyle açılır.
- Toplam puan doğru hesaplanır.
- Eşik üstü fikir aday sekmesine düşer.
- İl sorumlusu onaylamadan Bakanlığa gitmez.

### 35.3. Bakanlık

- Sadece İl AR-GE tarafından gönderilmiş adaylar görünür.
- Adaylar il ve kategori bazında filtrelenebilir.
- Her üç aylık dönemde her kategoriden en fazla bir seçim yapılır.
- Seçimler ana sayfada doğru tarih aralığında görünür.
- Süresi biten seçimler arşivde görünür.

### 35.4. Hayata geçirme

- “Hayata Geçirildi” işleminde proje adı ve ilişki açıklaması zorunludur.
- Uygulama bilgileri raporlanabilir.
- Durum değişikliği audit kaydı üretir.

### 35.5. Sertifika

- Seçilen fikir için tekil belge numarası oluşturulur.
- Sertifika okul müdürlüğüne gönderilebilir.
- Gönderim sonucu ve tekrar denemeler izlenebilir.
- Doğrulama koduyla belgenin geçerliliği kontrol edilebilir.

---

## 36. Riskler ve önlemler

| Risk | Etki | Önlem |
|---|---|---|
| YEĞİTEK sunucu standardının geç öğrenilmesi | Veritabanı/deploy uyarlaması | Taşınabilir katmanlar, erken teknik bilgi talebi |
| Öğrencinin yanlış il seçmesi | Fikrin yanlış İl AR-GE'ye gitmesi | Profil uyarısı, gönderim öncesi il teyidi, kontrollü düzeltme süreci |
| Küfür filtresinde yanlış pozitif | Geçerli fikrin engellenmesi | İnsan tarafından temizlenmiş liste, raporlama ve seviye modeli |
| İl verisinin başka ilce görülmesi | Kritik kişisel veri ihlali | Uygulama politikası, entegrasyon testleri, opsiyonel DB RLS |
| Değerlendirmede keyfî değişiklik | Güven kaybı | Şablon, zorunlu gerekçe, audit log, sürümleme |
| Sertifika e-postasının yanlış adrese gitmesi | Kişisel veri/teslimat sorunu | Doğrulanmış okul iletişim kaynağı, teslimat kaydı |
| Netlify ücretsiz limitlerinin aşılması | Demo kesintisi | Netlify yalnızca statik önizleme, üretim YEĞİTEK'te |
| Ücretsiz kütüphanenin terk edilmesi | Bakım sorunu | Lisans/aktiflik incelemesi, adaptör ve alternatif sağlayıcı |
| Dönem arşiv görevinin çalışmaması | Ana sayfada eski içerik | Tekrarlanabilir job, sağlık kontrolü, manuel tetikleme |
| Yedek var ancak geri yüklenemiyor | Veri kaybı | Periyodik geri yükleme testi |

---

## 37. Açık kararlar

Aşağıdaki konular geliştirme öncesinde veya ilgili aşamaya gelmeden kesinleştirilmelidir:

1. Öğrenci profilinde minimum ve zorunlu alanların son listesi
2. İl değişikliğinin serbest mi yoksa yetkili onaylı mı olacağı
3. Okul ve ilçe bilgilerinin liste mi yoksa serbest metin mi olacağı
4. Okul müdürlüğü resmî e-posta bilgilerinin kaynağı
5. Ekip olarak katılımın ilk sürümde bulunup bulunmayacağı
6. Değerlendirme kriterlerinin kesin adları ve açıklamaları
7. Kriterlerin 1–4 puan mı, onay kutusu mu veya karma mı olacağı
8. Ayın Fikri adaylık puan eşiği
9. Tek veya çoklu değerlendirici zorunluluğu
10. Puan farkında üçüncü değerlendirici kuralının kullanılıp kullanılmayacağı
11. Bir ilin bir kategoride Bakanlığa gönderebileceği maksimum aday sayısı
12. Küfür filtresinin sadece engelleme mi, engelleme + işaretleme mi yapacağı
13. Ana sayfada öğrenci adının tam mı, kısaltılmış mı gösterileceği
14. Ana sayfada okul bilgisinin gösterilip gösterilmeyeceği
15. Sertifika tasarımı, imza yöntemi ve doğrulama biçimi
16. “Ayın Fikri” adının üç aylık seçimlerde korunmasına ilişkin nihai kurumsal onay
17. Fikir silme için değerlendirme öncesi zaman sınırı
18. Planlamaya alınan ve hayata geçirilen fikirlerde belge yükleme zorunluluğu
19. YEĞİTEK sunucu ve veritabanı standardı
20. Üretim saklama, arşivleme ve KVKK silme süreleri

---

## 38. Proje tamamlanmış sayılma ölçütü

Platform aşağıdaki koşullar birlikte sağlandığında üretime hazır kabul edilir:

- Öğrenci kayıt, doğrulama, profil ve fikir gönderme süreçleri çalışmaktadır.
- 1.500 karakter ve küfür filtresi backend tarafından uygulanmaktadır.
- Fikir doğru ilin paneline düşmektedir.
- İl AR-GE başka illerin verilerine erişememektedir.
- Değerlendirme kriterleri ve puan hesabı çalışmaktadır.
- Eşik üstü adaylar doğru sekmeye aktarılmaktadır.
- İl AR-GE sorumlusu onayı Bakanlık havuzunu beslemektedir.
- Bakanlık üç aylık dönemlerde kategori bazında seçim yapabilmektedir.
- Seçimler ana sayfada yayımlanmakta ve dönem sonunda arşivlenmektedir.
- Hayata geçirilen fikirlerde proje ilişkilendirmesi zorunlu çalışmaktadır.
- Sertifika üretimi ve okul müdürlüğüne teslimat izlenebilmektedir.
- Erişilebilirlik kabul testleri tamamlanmıştır.
- Kritik güvenlik açığı bulunmamaktadır.
- Audit kayıtları kritik yönetim işlemlerini kapsamaktadır.
- Veritabanı ve dosya yedeklerinden geri yükleme testi yapılmıştır.
- YEĞİTEK hedef ortamında kurulum ve güncelleme prosedürü doğrulanmıştır.
- Teknik ve kullanıcı dokümantasyonu teslim edilmiştir.

---

## 39. Referanslar

- Proje kaynak belgesi: `Fikir Platformu 11.08.2026.pdf`
- .NET destek politikası: <https://dotnet.microsoft.com/en-us/platform/support/policy>
- ASP.NET Core lisansı: <https://github.com/dotnet/aspnetcore/blob/main/LICENSE.txt>
- PostgreSQL lisansı: <https://www.postgresql.org/about/licence/>
- PostgreSQL sürüm politikası: <https://www.postgresql.org/support/versioning/>
- PostgreSQL Row-Level Security: <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- WCAG 2.2: <https://www.w3.org/TR/wcag/>
- Netlify fiyatlandırma ve limitler: <https://www.netlify.com/pricing/>
- Netlify Functions: <https://docs.netlify.com/build/functions/overview/>
- .NET dağıtım seçenekleri: <https://learn.microsoft.com/en-us/dotnet/core/deploying/>

---

## 40. Sonuç

Bu plan; mevcut görsel prototipi, kaynak PDF'yi ve görüşmelerde alınan güncel kararları tek bir uygulanabilir ürün ve teknik mimari altında birleştirir.

Öncelik sırası:

1. Açık ürün kararlarını kapatmak
2. Rol/yetki ve değerlendirme şablonunu kesinleştirmek
3. Taşınabilir teknik temeli kurmak
4. Öğrenci → İl AR-GE → Bakanlık akışını geliştirmek
5. Üç aylık yayın, arşiv ve sertifika süreçlerini tamamlamak
6. Güvenlik, erişilebilirlik ve YEĞİTEK dağıtımını doğrulamak

Projenin bütün yeni kararları bu belgeye sürüm notuyla işlenmeli ve kod geliştirme bu planla izlenebilir biçimde yürütülmelidir.
