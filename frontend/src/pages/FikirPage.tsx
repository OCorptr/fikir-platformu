// /fikir — Aşama 3 frontend.
// Oturum yoksa AuthModal açılır (kapatılamaz); giriş/kayıt sonrası forma ulaşılır.
// Kategori + fikir metni yeterli — öğrenci bilgileri (il/okul/sınıf) backend profilinden alınır.

import { useEffect, useState, type FormEvent } from "react";
import { UstBar } from "../components/UstBar";
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
import type {
  CategoryRef,
  MeAuthenticated,
  StudentIdeaDto,
} from "../types";

const MAX_KARAKTER = 1500;

export default function FikirPage() {
  // oturum
  const [ben, setBen] = useState<MeAuthenticated | null>(null);
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

  // 1) sayfa açılır — oturum kontrolü
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        if (cevap.authenticated) {
          setBen(cevap);
        } else {
          setAuthAcik(true);
        }
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
    // AuthModal başarılı giriş/kayıt sonrası tetiklenir
    setAuthAcik(false);
    setKimlikKontrolEdildi(false);
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        if (cevap.authenticated) setBen(cevap);
        else setAuthAcik(true);
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

  async function handleTaslakKaydet(olay: FormEvent) {
    olay.preventDefault();
    if (!kategoriId) {
      setHata("Önce bir tema seç.");
      return;
    }
    if (fikir.length > MAX_KARAKTER) {
      setHata(`Fikir en fazla ${MAX_KARAKTER} karakter olabilir.`);
      return;
    }
    setCalisiyor("taslak");
    setHata(null);
    setMesaj(null);
    try {
      if (aktifTaslakId) {
        await updateDraft(aktifTaslakId, { categoryId: kategoriId, content: fikir });
        setMesaj("Taslak güncellendi.");
      } else {
        const sonuc = await saveDraft({ categoryId: kategoriId, content: fikir });
        setAktifTaslakId(sonuc.id);
        setMesaj("Taslak kaydedildi.");
      }
      await taslaklariYenile();
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function handleGonder(olay: FormEvent) {
    olay.preventDefault();
    if (!aktifTaslakId) {
      // önce taslak olarak kaydet, sonra gönder
      if (!kategoriId || !fikir.trim()) {
        setHata("Göndermek için önce tema seç ve fikrini yaz.");
        return;
      }
      setCalisiyor("gonder");
      setHata(null);
      try {
        const taslakCevap = await saveDraft({ categoryId: kategoriId, content: fikir });
        const gonderCevap = await submitIdea(taslakCevap.id);
        await taslaklariYenile();
        const detay = taslaklar.find((t) => t.id === taslakCevap.id);
        setGonderildiEkran(detay ?? olusturPlaceholder(taslakCevap.id, kategoriId, fikir));
        setAktifTaslakId(null);
        setKategoriId("");
        setFikir("");
        setMesaj(gonderCevap.message);
      } catch (e) {
        setHata(mesajCikar(e));
      } finally {
        setCalisiyor(null);
      }
      return;
    }

    setCalisiyor("gonder");
    setHata(null);
    setMesaj(null);
    try {
      // aktif taslağı güncelle (içerik değişmiş olabilir) ve gönder
      if (kategoriId !== "") {
        await updateDraft(aktifTaslakId, { categoryId: kategoriId as number, content: fikir });
      }
      const gonderCevap = await submitIdea(aktifTaslakId);
      await taslaklariYenile();
      const detay = taslaklar.find((t) => t.id === aktifTaslakId);
      setGonderildiEkran(
        detay ?? olusturPlaceholder(aktifTaslakId, kategoriId, fikir),
      );
      setMesaj(gonderCevap.message);
      formuTemizle();
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function taslaklariYenile() {
    try {
      const liste = await listMyIdeas();
      setTaslaklar(liste);
    } catch (e) {
      setHata(mesajCikar(e));
    }
  }

  async function handleTaslakAc(t: StudentIdeaDto) {
    setAktifTaslakId(t.id);
    setKategoriId(t.categoryId);
    setFikir(t.content);
    setHata(null);
    setMesaj(null);
    setGonderildiEkran(null);
  }

  async function handleTaslakSil(id: string) {
    if (!confirm("Bu taslağı silmek istediğine emin misin?")) return;
    setCalisiyor("sil");
    try {
      await deleteIdea(id);
      if (aktifTaslakId === id) formuTemizle();
      await taslaklariYenile();
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function handleCikis() {
    try {
      await logout();
    } catch {
      // yoksay — yine de arayüzü sıfırla
    }
    setBen(null);
    setAuthAcik(true);
    formuTemizle();
    setTaslaklar([]);
    setKategoriler([]);
  }

  // Yükleniyor ekranı
  if (!kimlikKontrolEdildi) {
    return (
      <>
        <UstBar />
        <main className="fikir-hero">
          <div className="yukleme-ekrani">
            <div className="yukleme-carki" aria-hidden="true" />
            <span>Yükleniyor…</span>
          </div>
        </main>
      </>
    );
  }

  const girisYapildi = ben !== null;
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
            <span style={{ color: "#1f9fa4" }}>Fikrini</span>{" "}
            <span style={{ color: "#ef7814" }}>Anlat!</span>
          </h1>

          {hata && (
            <div className="status-banner status-banner--error" role="alert">
              <span className="status-banner__icon">!</span>
              <span>{hata}</span>
            </div>
          )}
          {mesaj && !hata && (
            <div className="status-banner status-banner--info">
              <span className="status-banner__icon">i</span>
              <span>{mesaj}</span>
            </div>
          )}

          <div className="bolum-basligi turkuaz">1 · Temanı Seç</div>
          <select
            className="tema-secim"
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">🎨 Bir tema seç…</option>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>

          <div className="bolum-basligi turuncu">2 · Fikrim</div>
          <textarea
            id="fikrim"
            rows={5}
            maxLength={MAX_KARAKTER}
            value={fikir}
            onChange={(e) => setFikir(e.target.value)}
            placeholder="Fikrini buraya yaz… Dünyamızı daha güzel bir yer yapan ne olabilir?"
          />
          <div className="sayac-satiri">
            <span>{fikir.length} / {MAX_KARAKTER} karakter</span>
          </div>

          <div className="fikir-butonlar">
            <button
              type="button"
              className="btn-ikincil"
              onClick={handleTaslakKaydet}
              disabled={calisiyor !== null || !kategoriId}
            >
              {calisiyor === "taslak"
                ? (aktifTaslakId ? "Güncelleniyor…" : "Kaydediliyor…")
                : "💾 Taslak Kaydet"}
            </button>
            <button
              type="button"
              className="btn-ana btn-tam"
              onClick={handleGonder}
              disabled={calisiyor !== null}
            >
              {calisiyor === "gonder" ? "Gönderiliyor…" : "Fikrimi Gönder 🚀"}
            </button>
          </div>

          {taslaklar.length > 0 && (
            <div className="taslak-liste">
              <h2>📚 Fikirlerim</h2>
              {taslaklar.map((t) => (
                <div key={t.id} className="taslak-oge">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="taslak-meta">
                      {t.categoryName} · {new Date(t.updatedAt).toLocaleDateString("tr-TR")}
                    </div>
                    <div className="taslak-metin">{t.content || <i>(boş taslak)</i>}</div>
                  </div>
                  <span className={`taslak-durum taslak-durum--${t.status}`}>{durumEtiketi(t.status)}</span>
                  {t.canEdit && (
                    <>
                      <button
                        type="button"
                        className="taslak-islem"
                        onClick={() => handleTaslakAc(t)}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="taslak-islem sil"
                        onClick={() => handleTaslakSil(t.id)}
                        disabled={calisiyor === "sil"}
                      >
                        Sil
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <>
      <UstBar />
      <main className="fikir-hero">
        <div className="fikir-sol">
          <div className="balon-kapsa">
            <div className="balon">
              {!girisYapildi
                ? <>Merhaba! 🖐 Fikrini yazmadan önce <b>giriş yap</b> ya da <b>kayıt ol</b>.</>
                : gonderildiEkran
                  ? "Fikrin bize ulaştı, teşekkür ederiz! 🎉"
                  : aktifTaslakId
                    ? "Taslağını düzenliyorsun. Bittiğinde Gönder butonuna bas! 💪"
                    : <>Merhaba, ben Fikri! 🖐 Önce bir <b>tema</b> seç, sonra fikrini anlat. Sıra sende!</>}
            </div>
          </div>
          <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
        </div>

        {formIcerigi}

        {girisYapildi && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: "0.6rem" }}>
            <button
              type="button"
              className="btn-ikincil"
              onClick={handleCikis}
              style={{ fontSize: "0.9rem" }}
            >
              Çıkış Yap
            </button>
          </div>
        )}
      </main>

      <AuthModal acik={authAcik} onAuthed={authGuncelle} />
    </>
  );
}

function durumEtiketi(durum: StudentIdeaDto["status"]): string {
  switch (durum) {
    case "Draft": return "Taslak";
    case "Submitted": return "Gönderildi";
    case "InEvaluation": return "Değerlendirmede";
    case "EvaluationCompleted": return "Değerlendirildi";
    case "Locked": return "Kilitli";
    case "Deleted": return "Silindi";
  }
}

function olusturPlaceholder(
  id: string,
  kategoriId: number | "",
  icerik: string,
): StudentIdeaDto {
  const simdi = new Date().toISOString();
  return {
    id,
    categoryId: kategoriId || 0,
    categoryName: "",
    provinceId: 0,
    provinceName: "",
    content: icerik,
    status: "Submitted",
    createdAt: simdi,
    updatedAt: simdi,
    submittedAt: simdi,
    canEdit: false,
  };
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
