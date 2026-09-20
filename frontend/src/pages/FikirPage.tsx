// /fikir — Aşama 3 frontend.
// Oturum yoksa AuthModal açılır (kapatılamaz); giriş/kayıt sonrası forma ulaşılır.
// Kategori + fikir metni yeterli — öğrenci bilgileri (il/okul/sınıf) backend profilinden alınır.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { getCategories } from "../services/references";
import {
  deleteIdea,
  listMyIdeas,
  saveDraft,
  submitIdea,
  updateDraft,
} from "../services/ideas";
import { logout, me } from "../services/auth";
import {
  type CategoryRef,
  type MeSession,
  sessionForContext,
  type StudentIdeaDto,
} from "../types";

const MAX_KARAKTER = 1500;

// Kategori adina gore emoji prefix (referans fikir.html ile ayni ikonlar)
function kategoriEmoji(ad: string): string {
  if (ad.includes("Kültür") || ad.includes("Sanat")) return "🎨";
  if (ad.includes("Spor")) return "⚽";
  if (ad.includes("Bilim") || ad.includes("Teknoloji")) return "🔬";
  if (ad.includes("Yapay Zek")) return "🤖";
  if (ad.includes("Çevre")) return "🌱";
  if (ad.includes("Sosyal")) return "🤝";
  if (ad.includes("Girişimcilik")) return "💡";
  if (ad.includes("Afet")) return "🚨";
  if (ad.includes("Değerler")) return "📖";
  if (ad.includes("Yerli") || ad.includes("Mill")) return "🏭";
  return "🎨";
}

export default function FikirPage() {
  // oturum (öğrenci context'i)
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);
  // AuthModal sekmesi (giris / kayit / dogrulamaBekleniyor) - maskot balonu buna gore guncellenir
  const [authMod, setAuthMod] = useState<"giris" | "kayit" | "dogrulamaBekleniyor">("giris");
  function balonYazisi(m: "giris" | "kayit" | "dogrulamaBekleniyor") {
    if (m === "giris") return <>Merhaba! Fikrini yazmadan önce <b>hesabınla giriş yap</b> ya da yeni bir hesap oluştur. Sıra sende! 🖐</>;
    if (m === "kayit") return <>Yeni misin? <b>Hesap oluştur</b>, e-postanı doğrula, sonra fikrini yaz. Birkaş saniye sürer! 🚀</>;
    return <>E-posta kutunu kontrol et! 🎉 Doğrulama bağlantısına tıkladıktan sonra <b>giriş yapabilirsin</b>.</>;
  }


  // form
  const [kategoriler, setKategoriler] = useState<CategoryRef[]>([]);
  const [taslaklar, setTaslaklar] = useState<StudentIdeaDto[]>([]);
  const [aktifTaslakId, setAktifTaslakId] = useState<string | null>(null);
  const [kategoriId, setKategoriId] = useState<number | "">("");
  const [fikir, setFikir] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState<"taslak" | "gonder" | "sil" | "taslakYukle" | null>(null);
  const [gonderildiEkran, setGonderildiEkran] = useState<StudentIdeaDto | null>(null);

  // 1) sayfa açılır — öğrenci oturumu kontrol et
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        const s = sessionForContext(cevap, "student");
        setBen(s);
        if (!s) setAuthAcik(true); // /me 200 dönse bile student session yoksa modal aç
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setAuthAcik(true);
        }
      })
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // 2) oturum açıldıktan sonra — kategoriler + taslaklar
  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    setCalisiyor("taslakYukle");
    Promise.all([getCategories(controller.signal), listMyIdeas(controller.signal)])
      .then(([kategorilerCevap, taslaklarCevap]) => {
        setKategoriler(kategorilerCevap);
        setTaslaklar(taslaklarCevap);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata(mesajCikar(e));
        }
      })
      .finally(() => setCalisiyor(null));
    return () => controller.abort();
  }, [ben]);

  function authGuncelle() {
    setAuthAcik(false);
    setKimlikKontrolEdildi(false);
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        const s = sessionForContext(cevap, "student");
        setBen(s);
        if (!s) setAuthAcik(true);
      })
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }

  function formuTemizle() {
    setAktifTaslakId(null);
    setKategoriId("");
    setFikir("");
    setHata(null);
    setMesaj(null);
    setGonderildiEkran(null);
  }

  async function handleTaslak(e: FormEvent) {
    e.preventDefault();
    if (!fikir.trim()) {
      setHata("Fikir boş olamaz.");
      return;
    }
    if (!kategoriId) {
      setHata("Tema seçmelisin.");
      return;
    }
    setCalisiyor("taslak");
    setHata(null);
    setMesaj(null);
    try {
      if (aktifTaslakId) {
        await updateDraft(aktifTaslakId, { categoryId: kategoriId as number, content: fikir });
        setMesaj("Taslak güncellendi.");
      } else {
        const yeni = await saveDraft({ categoryId: kategoriId as number, content: fikir });
        setAktifTaslakId((yeni as { id: string }).id);
        setMesaj("Taslak kaydedildi.");
      }
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function handleGonder(e: FormEvent) {
    e.preventDefault();
    if (!fikir.trim()) {
      setHata("Fikir boş olamaz.");
      return;
    }
    if (!kategoriId) {
      setHata("Tema seçmelisin.");
      return;
    }
    setCalisiyor("gonder");
    setHata(null);
    try {
      const gonderilen = aktifTaslakId
        ? await submitIdea(aktifTaslakId)
        : await submitIdea((await saveDraft({ categoryId: kategoriId as number, content: fikir })).id);
      setGonderildiEkran(gonderilen as unknown as StudentIdeaDto);
      setMesaj("Fikrin başarıyla iletildi!");
      setAktifTaslakId(null);
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function handleTaslakSil(id: string) {
    if (!confirm("Bu taslağı silmek istediğine emin misin?")) return;
    setCalisiyor("sil");
    setHata(null);
    try {
      await deleteIdea(id);
      if (aktifTaslakId === id) formuTemizle();
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  function taslakSec(t: StudentIdeaDto) {
    if (t.status !== "Draft") return;
    setAktifTaslakId(t.id);
    setKategoriId(t.categoryId);
    setFikir(t.content);
    setGonderildiEkran(null);
    setMesaj(null);
    setHata(null);
  }

  const navigate = useNavigate();

  async function handleCikis() {
    try {
      await logout("student");
    } catch {
      /* yoksay */
    }
    setBen(null);
    setAuthAcik(false); // modal yeniden acilmasin - anasayfaya yonlendiriliyoruz
    setTaslaklar([]);
    setKategoriler([]);
    formuTemizle();
    navigate("/", { replace: true });
  }

  // Yükleniyor ekranı
  if (!kimlikKontrolEdildi) {
    return (
        <main className="fikir-hero fikir-hero-onplanda">
          <div className="maskot-onplan">
            <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
            <div className="maskot-yazi">
              Merhaba! Fikrini yazmadan önce <b>giriş yap</b> ya da <b>kayıt ol</b>.
              <br />
              <span className="maskot-yazi-alt">Sıra sende!</span>
            </div>
          </div>
        </main>
    );
  }

  // Kimlik yoksa FORM GÖSTERİLMEZ — sadece AuthModal arka planda açılır.
  if (!ben) {
    return (
      <main className="fikir-hero">
        <div className="fikir-sol">
          <div className="balon-kapsa">
            <div className="balon">{balonYazisi(authMod)}</div>
          </div>
          <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
        </div>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} arkadaMi onModChange={setAuthMod} />
      </main>
    );
  }

  const formIcerigi = (
    <section className={`fikir-karti ${authAcik ? "fikir-form-blur" : ""}`}>
      {gonderildiEkran ? (
        <div className="basari">
          <svg className="basari-tik" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="24" fill="none" stroke="#16a34a" strokeWidth="3" />
            <path d="M15 27 l7.5 7 L38 19" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h2 style={{ color: "#16355c", fontSize: "1.8rem" }}>Fikrin bize ulaştı!</h2>
          <p style={{ color: "#647a92" }}>{mesaj ?? "Fikrinin değerlendirme sürecini buradan takip edebilirsin."}</p>
          <div className="adimlar">
            <span className="adim aktif">Gönderildi</span>
            <span className="adim">Ön Değerlendirme</span>
            <span className="adim">Komisyon İncelemesi</span>
            <span className="adim">Planlama</span>
            <span className="adim">Hayata Geçirildi</span>
          </div>
          <button type="button" className="btn-ikincil" onClick={formuTemizle}>
            Yeni Fikir Yaz
          </button>
        </div>
      ) : (
        <>
          <h1>
            <span style={{ color: "#1f9fa4" }}>Fikir</span>{" "}
            <span style={{ color: "#ef7814" }}>Formu</span>
          </h1>

          {mesaj && (
            <div className="status-banner status-banner--success" role="status">
              <span className="status-banner__icon">âœ“</span>
              <span>{mesaj}</span>
            </div>
          )}


          <form onSubmit={handleGonder} className="fikir-form">
          <div className="bolum-basligi turkuaz">1 · Temanı Seç</div>
          <select
            className="tema-secim"
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value === "" ? "" : Number(e.target.value))}
            required
            aria-label="Tema seç"
          >
            <option value="">🎨 Bir tema seç…</option>
                {kategoriler.map((k) => (
                  <option key={k.id} value={k.id}>{kategoriEmoji(k.name)} {k.name}</option>
                ))}
              </select>

          <div className="bolum-basligi turuncu">3 · Fikrim</div>
          <div className="alan">
            <span>Fikrin ({fikir.length}/{MAX_KARAKTER})</span>
              <textarea
                className="fikir-metni"
                value={fikir}
                onChange={(e) => setFikir(e.target.value)}
                placeholder="Fikrini buraya yaz…"
                maxLength={MAX_KARAKTER}
                rows={8}
                required
              />
            </div>

            <div className="fikir-butonlar">
              <button
                type="button"
                className="btn-ikincil"
                onClick={handleTaslak}
                disabled={calisiyor === "taslak" || calisiyor === "gonder"}
              >
                {calisiyor === "taslak" ? "Kaydediliyor…" : aktifTaslakId ? "Taslağı Güncelle" : "Taslak Kaydet"}
              </button>
              <button
                type="submit"
                className="btn-ana btn-tam"
                disabled={calisiyor === "taslak" || calisiyor === "gonder"}
              >
                {calisiyor === "gonder" ? "Gönderiliyor…" : aktifTaslakId ? "Taslağı Gönder" : "Fikrimi Gönder"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 21 3l-5 18-4.5-7.5z"/><path d="M11.5 13.5 21 3"/></svg>
              </button>
            </div>
          </form>

          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "0.1rem solid #e3ecf4" }}>
            <button
              type="button"
              className="btn-ikincil"
              onClick={handleCikis}
              style={{ width: "100%" }}
            >
              🚪 Çıkış Yap
            </button>
          </div>

          {taslaklar.length > 0 && (
            <div className="taslak-listesi">
              <div className="bolum-basligi turkuaz">Taslaklarım & Geçmiş Fikirlerim</div>
              <ul>
                {taslaklar.map((t) => (
                  <li key={t.id} className={t.status === "Draft" ? "taslak-oge" : "fikir-oge"}>
                    <div className="taslak-sol">
                      <span className={`durum taslak-durum taslak-durum--${t.status}`}>{durumEtiketi(t.status)}</span>
                      <span className="taslak-icerik">{t.content.slice(0, 80)}{t.content.length > 80 ? "…" : ""}</span>
                    </div>
                    <div className="taslak-sag">
                      {t.status === "Draft" && (
                        <>
                          <button type="button" className="taslak-islem" onClick={() => taslakSec(t)}>Düzenle</button>
                          <button type="button" className="taslak-islem tehlikeli" onClick={() => handleTaslakSil(t.id)}>Sil</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <main className="fikir-hero">
      <div className="fikir-sol">
        <div className="balon-kapsa">
          <div className="balon">
            {ben
              ? <>Hoş geldin, <b>{ben.firstName}</b>! Bir <b>tema</b> seç, sonra fikrini anlat. Sıra sende! ✏️</>
              : <>Merhaba, ben Fikri! Önce bir <b>tema</b> seç, sonra fikrini anlat. Sıra sende!</>}
          </div>
        </div>
        <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
      </div>
      {formIcerigi}
      <AuthModal acik={authAcik} onAuthed={authGuncelle} />
    </main>
  );
}

function durumEtiketi(durum: StudentIdeaDto["status"]): string {
  switch (durum) {
    case "Draft": return "Taslak";
    case "Submitted": return "Gönderildi";
    case "InEvaluation": return "Değerlendirmede";
    case "EvaluationCompleted": return "Değerlendirildi";
    case "Locked": return "Kilitli";
    case "Planned": return "Planlandı";
    case "ImplementationInProgress": return "Uygulamada";
    case "ImplementationCompleted": return "Uygulandı";
    case "ImplementationFailed": return "Başarısız";
    case "Deleted": return "Silindi";
  }
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}




