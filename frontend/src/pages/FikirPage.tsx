// /fikir â€” AÅŸama 3 frontend.
// Oturum yoksa AuthModal aÃ§Ä±lÄ±r (kapatÄ±lamaz); giriÅŸ/kayÄ±t sonrasÄ± forma ulaÅŸÄ±lÄ±r.
// Kategori + fikir metni yeterli â€” Ã¶ÄŸrenci bilgileri (il/okul/sÄ±nÄ±f) backend profilinden alÄ±nÄ±r.

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

export default function FikirPage() {
  // oturum (Ã¶ÄŸrenci context'i)
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);

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

  // 1) sayfa aÃ§Ä±lÄ±r â€” Ã¶ÄŸrenci oturumu kontrol et
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        const s = sessionForContext(cevap, "student");
        setBen(s);
        if (!s) setAuthAcik(true); // /me 200 dÃ¶nse bile student session yoksa modal aÃ§
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setAuthAcik(true);
        }
      })
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // 2) oturum aÃ§Ä±ldÄ±ktan sonra â€” kategoriler + taslaklar
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
      setHata("Fikir boÅŸ olamaz.");
      return;
    }
    if (!kategoriId) {
      setHata("Tema seÃ§melisin.");
      return;
    }
    setCalisiyor("taslak");
    setHata(null);
    setMesaj(null);
    try {
      if (aktifTaslakId) {
        await updateDraft(aktifTaslakId, { categoryId: kategoriId as number, content: fikir });
        setMesaj("Taslak gÃ¼ncellendi.");
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
      setHata("Fikir boÅŸ olamaz.");
      return;
    }
    if (!kategoriId) {
      setHata("Tema seÃ§melisin.");
      return;
    }
    setCalisiyor("gonder");
    setHata(null);
    try {
      const gonderilen = aktifTaslakId
        ? await submitIdea(aktifTaslakId)
        : await submitIdea((await saveDraft({ categoryId: kategoriId as number, content: fikir })).id);
      setGonderildiEkran(gonderilen as unknown as StudentIdeaDto);
      setMesaj("Fikrin baÅŸarÄ±yla iletildi!");
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
    if (!confirm("Bu taslaÄŸÄ± silmek istediÄŸine emin misin?")) return;
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

  // YÃ¼kleniyor ekranÄ±
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

  // Kimlik yoksa FORM GÃ–STERÄ°LMEZ â€” sadece AuthModal arka planda aÃ§Ä±lÄ±r.
  if (!ben) {
    return (
      <>
        <main className="fikir-hero">
          <div className="fikir-sol">
            <div className="balon-kapsa">
              <div className="balon">
                Merhaba! Fikrini yazmadan önce <b>hesabınla giriş yap</b> ya da yeni bir hesap oluştur. Sıra sende! 🖐
              </div>
            </div>
            <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
          </div>
        </main>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} arkadaMi />
      </>
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
          <h2 style={{ color: "#16355c", fontSize: "1.8rem" }}>Fikrin bize ulaÅŸtÄ±!</h2>
          <p style={{ color: "#647a92" }}>{mesaj ?? "Fikrinin deÄŸerlendirme sÃ¼recini buradan takip edebilirsin."}</p>
          <div className="adimlar">
            <span className="adim aktif">GÃ¶nderildi</span>
            <span className="adim">Ã–n DeÄŸerlendirme</span>
            <span className="adim">Komisyon Ä°ncelemesi</span>
            <span className="adim">Planlama</span>
            <span className="adim">Hayata GeÃ§irildi</span>
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

          <div className="balon-kapsa" style={{ marginBottom: "1rem" }}>
            <div className={`balon ${hata ? "balon--uyari" : ""}`}>
              {hata
                ? <><span aria-hidden="true">âš ï¸</span> {hata}</>
                : aktifTaslakId
                  ? "TaslaÄŸÄ±nÄ± dÃ¼zenliyorsun. BittiÄŸinde GÃ¶nder butonuna bas!"
                  : <>Merhaba, ben Fikri! Ã–nce bir <b>tema</b> seÃ§, sonra fikrini anlat. SÄ±ra sende!</>}
            </div>
          </div>

          <form onSubmit={handleGonder} className="fikir-form">
            <div className="alan">
              <span>Tema</span>
              <select
                className="tema-secim"
                value={kategoriId}
                onChange={(e) => setKategoriId(e.target.value === "" ? "" : Number(e.target.value))}
                required
              >
                <option value="">Tema seÃ§â€¦</option>
                {kategoriler.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>

            <div className="alan">
              <span>Fikrin ({fikir.length}/{MAX_KARAKTER})</span>
              <textarea
                className="fikir-metni"
                value={fikir}
                onChange={(e) => setFikir(e.target.value)}
                placeholder="Fikrini buraya yazâ€¦"
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
                {calisiyor === "taslak" ? "Kaydediliyorâ€¦" : aktifTaslakId ? "TaslaÄŸÄ± GÃ¼ncelle" : "Taslak Kaydet"}
              </button>
              <button
                type="submit"
                className="btn-ana btn-tam"
                disabled={calisiyor === "taslak" || calisiyor === "gonder"}
              >
                {calisiyor === "gonder" ? "GÃ¶nderiliyorâ€¦" : aktifTaslakId ? "TaslaÄŸÄ± GÃ¶nder" : "GÃ¶nder"}
              </button>
            </div>
          </form>

          {taslaklar.length > 0 && (
            <div className="taslak-listesi">
              <div className="bolum-basligi turkuaz">TaslaklarÄ±m & GeÃ§miÅŸ Fikirlerim</div>
              <ul>
                {taslaklar.map((t) => (
                  <li key={t.id} className={t.status === "Draft" ? "taslak-oge" : "fikir-oge"}>
                    <div className="taslak-sol">
                      <span className={`durum taslak-durum taslak-durum--${t.status}`}>{durumEtiketi(t.status)}</span>
                      <span className="taslak-icerik">{t.content.slice(0, 80)}{t.content.length > 80 ? "â€¦" : ""}</span>
                    </div>
                    <div className="taslak-sag">
                      {t.status === "Draft" && (
                        <>
                          <button type="button" className="taslak-islem" onClick={() => taslakSec(t)}>DÃ¼zenle</button>
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
    <>
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
      <AuthModal acik={authAcik} onAuthed={authGuncelle} />
    </>
  );
}

function durumEtiketi(durum: StudentIdeaDto["status"]): string {
  switch (durum) {
    case "Draft": return "Taslak";
    case "Submitted": return "GÃ¶nderildi";
    case "InEvaluation": return "DeÄŸerlendirmede";
    case "EvaluationCompleted": return "DeÄŸerlendirildi";
    case "Locked": return "Kilitli";
    case "Planned": return "PlanlandÄ±";
    case "ImplementationInProgress": return "Uygulamada";
    case "ImplementationCompleted": return "UygulandÄ±";
    case "ImplementationFailed": return "BaÅŸarÄ±sÄ±z";
    case "Deleted": return "Silindi";
  }
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluÅŸtu.";
}




