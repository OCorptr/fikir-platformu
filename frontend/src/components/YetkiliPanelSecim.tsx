// Onur (Sprint 11.73): "Yöneticilerin oturumu açıkken fikir sayfasına girdikleri
// zaman da Yetkili Giriş Sayfasına tıkladığımızda çıkan yönlendirme ekranların
// aynısı çıksın, şu anda orada olan hatalı."
//
// SEBEP: Aynı bilgi iki yerde AYRI ayrı yazılmıştı.
//   - components/YetkiliGirisModal.tsx → ana sayfa (S11.71'de düzeltildi)
//   - components/AuthModal.tsx         → /fikir sayfası (S11.72'de düzeltilmedi)
// İkincisi aynı hataları taşıyordu: etiketi cookie context'inden türetiyordu
// ("Bakanlık"), panel düğmeleri hiç yoktu, metni de yanlıştı. Ayrı bakım
// yüzeyi = kalıcı sapma kaynağı.
//
// Bu dosya tek doğruluk kaynağıdır. İki modal da buradan beslenir; ayrışamazlar.

export interface PanelSecenek {
  ad: string;
  yol: string;
}

// SPA navigasyon (useNavigate) bu modal içinde çalışmıyor; tam sayfa
// yüklemesi gerekiyor. `replace=false` → tarayıcı geri tuşu çalışır.
export function fullPageNav(hedef: string) {
  window.location.href = hedef;
}

// KURUM KURALI: "Sistem Yöneticisi dışında kimsede birden fazla panele erişemez."
// Sistem yöneticisi istisnadır ve üç panelin tamamına erişir.
// Bu pencere YETKİLİ girişidir — öğrenci paneli (/fikir) burada gösterilmez.
export function rolPanelSecenekleri(roller: readonly string[]): PanelSecenek[] {
  if (roller.includes("SystemAdmin")) {
    const liste: PanelSecenek[] = [{ ad: "Yönetici Paneli", yol: "/admin" }];
    if (roller.includes("MinistryOfficial")) liste.push({ ad: "Bakanlık Paneli", yol: "/bakanlik" });
    liste.push({ ad: "İl AR-GE Paneli", yol: "/il-panel" });
    return liste;
  }
  if (roller.includes("MinistryOfficial")) return [{ ad: "Bakanlık Paneli", yol: "/bakanlik" }];
  if (roller.includes("ProvinceManager") || roller.includes("ProvinceEvaluator")) {
    return [{ ad: "İl AR-GE Paneli", yol: "/il-panel" }];
  }
  return [];
}

// Etiket context'ten DEĞİL rolden üretilir. Sistem yöneticisinin üç cookie'si
// de olduğu için context'e bakmak "Bakanlık" gibi yanlış bir etiket üretiyordu.
const ROL_ETIKETI: readonly (readonly [string, string])[] = [
  ["SystemAdmin", "Sistem Yöneticisi"],
  ["MinistryOfficial", "Bakanlık Yetkilisi"],
  ["ProvinceManager", "İl AR-GE Yöneticisi"],
  ["ProvinceEvaluator", "İl AR-GE Değerlendiricisi"],
];

export function rolEtiketi(roller: readonly string[]): string | null {
  return ROL_ETIKETI.find(([r]) => roller.includes(r))?.[1] ?? null;
}

/**
 * Onur (S11.80): "il-panel'de Aday Havuzu'na tıklayınca bomboş ekran."
 *
 * Aynı hata üç ayrı yerde tekrarladı (CandidatesPage, ApplicationDetailPage,
 * AdminLayout) ve birinde boş ekran, birinde ana sayfaya atma, birinde
 * eksik menü öğesi olarak belirdi. Hepsi aynı hatadan: "il yöneticiliği
 * rol kontrolü" sistem yöneticisini dışarıda bırakıyor.
 *
 * KURUM KURALI: "Sistem Yöneticisi dışında kimsede birden fazla panele
 * erişemez." Sistem yöneticisi istisnadır — üç panelin de yönetim işlerini
 * yapar. Bu yüzden yetki kontrolleri ROLÜN VARLIĞINA değil, bu kurala bakar.
 */
export function ilYoneticiMi(roller: readonly string[]): boolean {
  return (
    roller.includes("SystemAdmin") ||
    roller.includes("ProvinceManager")
  );
}

interface Props {
  roller: readonly string[];
  /** Panel düğmesine basılınca çağrılır; yönlendirmeyi çağıran yapar. */
  onGit: (yol: string) => void;
}

export function YetkiliPanelSecenekleri({ roller, onGit }: Props) {
  const secenekler = rolPanelSecenekleri(roller);
  if (secenekler.length === 0) {
    return (
      <p className="yg-aktif-oturum__metin">
        Bu hesabın bir yetkili paneline erişimi yok. Size tanımlı bir panel
        görünmüyorsa kurum yöneticinizle görüşün.
      </p>
    );
  }
  return (
    <>
      {secenekler.map((p) => (
        <button key={p.yol} type="button" className="yg-ikincil" onClick={() => onGit(p.yol)}>
          {p.ad} →
        </button>
      ))}
    </>
  );
}
