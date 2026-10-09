/**
 * Sprint 11.92 — KVKK Aydınlatma Metni ve Açık Rıza Metni.
 *
 * Neden iki ayrı sayfa/bölüm?
 * KVKK Kurul'un 18.02.2026 tarihli 2026/347 sayılı İlke Kararı: açık rıza metni ile
 * aydınlatma metni **iç içe geçmiş şekilde sunulmamalı**, farklı başlıklar altında
 * ve **iki ayrı beyan** olarak düzenlenmelidir. Aydınlatmadan ONAY/RIZA istenmez —
 * yalnızca okunduğuna dair geri bildirim alınır.
 *
 * Kaynaklar:
 *  - 6698 sayılı KVKK md.10 (aydınlatma yükümlülüğü) · md.3 (açık rıza) · md.11 (haklar)
 *  - KVKK Aydınlatma Yükümlülüğünün Yerine Getirilmesi Hakkında Tebliğ, md.5
 *  - KVKK Kurul 01.07.2026 tarihli 2026/1301 sayılı karar — kamu kurumlarının
 *    kişisel verileri İNTERNET ORTAMINDA paylaşması.
 *
 * ⚠️ Bu metinler taslaktır ve yayına almadan önce kurum hukuk birimi tarafından
 * gözden geçirilmelidir. "Veri sorumlusu" alanları kurumun resmi unvanı ve
 * iletişim bilgileriyle doldurulmalıdır.
 */
import { Link } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";

/** Aydınlatma metninin sürümü — rıza kayıtlarında bu sürüm saklanır. */
export const KVKK_METIN_VERSIYONU = "2026-09-10";

export function KvkkPage() {
  return (
    <div className="kvkk-sayfa">
      <header className="kvkk-ust">
        <h1>Kişisel Verilerin İşlenmesi</h1>
        <p className="kvkk-alt">
          Bu sayfada iki ayrı metin bulunur: <b>Aydınlatma Metni</b> ve{" "}
          <b>Açık Rıza Metni</b>. İkisi farklı konuları anlatır ve birbirinin yerine
          geçmez. Metin sürümü: <b>{KVKK_METIN_VERSIYONU}</b>
        </p>
        <Link to="/" className="btn-ikincil">← Anasayfaya dön</Link>
      </header>

      {/* ============ 1. AYDINLATMA METNİ ============ */}
      {/* Buradan ONAY istenmez. Yalnızca bilgilendirmedir (KVKK md.10). */}
      <section className="kvkk-bolum" id="aydinlatma">
        <h2>1. Aydınlatma Metni</h2>
        <p>
          Bu metni okuduğunuz için teşekkür ederiz. Bu bölüm sadece bilgilendirme
          amaçlıdır; <b>onay veya rıza talep edilmemektedir.</b> Kaydolurken
          yalnızca "metni okudum" bilgisini alırız.
        </p>

        <h3>Veri sorumlusu kim?</h3>
        <p>
          <b>[Kurumun resmî unvanı]</b> — Genç AR-GE / Geleceğin Fikri Platformu.
          Adres: [kurum adresi]. İletişim: [e-posta / telefon].
          <br />
          <span className="kvkk-not">
            Bu alanlar kurumun resmî bilgileriyle doldurulmalıdır (KVKK md.10/a).
          </span>
        </p>

        <h3>Hangi bilgilerinizi işliyoruz?</h3>
        <ul>
          <li><b>Kimlik ve iletişim:</b> ad, soyad, e-posta adresi.</li>
          <li><b>Öğrencilik bilgileri:</b> il, okul, sınıf, öğrenci numarası.</li>
          <li><b>İçerik:</b> yazdığınız fikirin metni, puanlar ve yorumlar.</li>
          <li><b>İşlem kayıtları:</b> giriş ve güvenlik kayıtları (kayıt saati, IP
            adresinizin bir kısmı).</li>
        </ul>
        <p className="kvkk-not">
          Özel nitelikli kişisel veri (<span>sağlık, din, etnik köken</span> vb.)
          <b> toplanmaz.</b>
        </p>

        <h3>Neden işliyoruz?</h3>
        <ul>
          <li>Fikrinizi platforma kaydetmek ve size giriş sağlamak,</li>
          <li>Fikrinizi il AR-GE değerlendirmesine ve bakanlık değerlendirmesine sunmak,</li>
          <li>Değerlendirme sonuçlarını ve uygulama durumunu size göstermek,</li>
          <li>Platformun güvenliğini sağlamak ve denetim kayıtları tutmak.</li>
        </ul>

        <h3>Hukuki sebep nedir?</h3>
        <p>
          Platforma kaydolmak ve fikir paylaşmak için gerekli olması nedeniyle{" "}
          <b>sözleşmenin kurulması ve ifasıyla doğrudan ilgili</b> işleme şartı
          (KVKK md.5/2-c) ve hesabınızın güvenliği için <b>meşru menfaat</b> şartı
          (md.5/2-f). Fikrinizin ana sayfada yayımlanması ise <b>ayrı ve isteğe
          bağlı bir açık rızaya</b> dayanır (2. bölüm).
        </p>

        <h3>Kimlerle paylaşıyoruz?</h3>
        <p>
          Verileriniz yalnızca <b>değerlendirme göreviyle yetkili</b> kurum
          personeliyle paylaşılır: kendi ilinizin AR-GE değerlendiricileri, il
          yöneticileri ve bakanlık komisyonu. <b>Reklam, pazarlama veya üçüncü
          taraflarla paylaşım yapılmaz.</b>
        </p>

        <h3>Ne kadar süre saklıyoruz?</h3>
        <p>
          Hesabınız ve fikirleriniz, <b>platformun faal olduğu sürece ve
          eğitim/araştırma amacı sona ermedikçe</b> saklanır. Hesabınızı
 ���nbsp;kapattığınızda kişisel verileriniz <b>90 gün içinde</b> silinir ya da
          istisna hâlleri saklanacaksa bu ayrıca bildirilir. Denetim kayıtları
          (giriş kayıtları) en fazla <b>2 yıl</b> saklanır.
        </p>

        <h3>Haklarınız</h3>
        <p>
          Kanunun 11. maddesi kapsamındaki haklarınız (verilerinizin işlenip
          işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, işlemeye
          itiraz etme, zararın giderilmesini talep etme) vardır. Başvurularınızı{" "}
          <b>[veri sorumlusu iletişim bilgisi]</b> üzerinden iletebilirsiniz.
          Talepleriniz en geç <b>30 gün</b> içinde sonuçlandırılır.
        </p>
      </section>

      {/* ============ 2. AÇIK RIZA METNİ ============ */}
      {/* Yalnızca bu konuya ilişkin, isteğe bağlı ve geri alınabilir rıza. */}
      <section className="kvkk-bolum kvkk-riza" id="acik-riza">
        <h2>2. Açık Rıza Metni — Fikrinizin Yayımlanması</h2>
        <p>
          Bu bölüm <b>1. bölümden tamamen ayrıdır</b> ve yalnızca bir konuyu
          kapsar: fikrinizin internet ortamında yayımlanması.
        </p>

        <h3>Yayımlama nedir?</h3>
        <p>
          Bakanlık her üç aylık dönemde, değerlendirmeler sonucu bir fikri{" "}
          <b>“Ayın Fikri”</b> olarak seçebilir. Seçilen fikrin metni ve{" "}
          <b>maskelenmiş adınız</b> (örn. “Elif Y.”) platformun <b>herkese açık</b>
          ana sayfasında ve “Ayın Fikri Arşivi” bölümünde gösterilir.
        </p>

        <h3>Yayımlarsak hangi bilgileriniz görünür?</h3>
        <ul>
          <li><b>Maskeli ad:</b> adınızın ilk harfi + soyadınızın ilk harfi
            (örn. “Elif Y.”). <b>Soyadınızın tamamı gösterilmez.</b></li>
          <li><b>İl:</b> hangi ilde yazdığınız.</li>
          <li><b>Fikrinizin metni:</b> yazdığınız metnin kısaltılmış hâli.</li>
          <li><b>Okul adı gösterilmez.</b> Sınıf ve öğrenci numarası hiçbir zaman
            yayımlanmaz.</li>
        </ul>
        <p className="kvkk-not">
          Yalnızca amaç için gerekli <b>asgari</b> bilgi yayımlanır
          (KVKK Kurul 2026/1301 sayılı karar: “amaçla bağlantılı, sınırlı ve ölçülü
          olma” ilkesi).
        </p>

        <h3>Onayı vermezseniz ne olur?</h3>
        <p>
          <b>Hiçbir şey değişmez.</b> Fikriniz yazılır, ilinizdeki
          değerlendiriciler tarafından değerlendirilir ve bakanlığa gönderilir.
          Tek farkı: <b>ana sayfada yayımlanmaz.</b> Yayımlamak, fikrinizin
          değerlendirilmesi için <b>şart değildir</b>.
        </p>

        <h3>Onayı geri çekebilir miyim?</h3>
        <p>
          <b>Evet, istediğin zaman.</b> Onayı geri çektiğiniz andan itibaren
          bilgileriniz ana sayfadan kaldırılır. Fikrinizin değerlendirme süreci
          devam eder.
        </p>

        <h3>Onay ne kadar süre geçerli?</h3>
        <p>
          Onayınız, <b>“Ayın Fikri” seçildiği sürece</b> ve siz geri çekmedikçe
          geçerlidir. Dönem bittiğinde ilgili kayıt yayımlamadan kaldırılır.
        </p>
      </section>

      <footer className="kvkk-alt-not">
        Bu metinler <b>{KVKK_METIN_VERSIYONU}</b> sürümlüdür. Sürüm değişirse
        kayıt formunda güncel sürüm gösterilir.
      </footer>
    </div>
  );
}
