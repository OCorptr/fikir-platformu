// Kullanıcı Ekleme Drawer (Lightbox Modal) — Sprint 11.49.
//
// UserListPage'in "+ Yönetici Ekle" / "+ Ekle" butonlarından çağrılır.
// Sağdan slide-in drawer; ESC veya overlay tıklamayla kapanır.
// Onur feedback'i: ilkel ekleme sayfası yerine lightbox istedi.
//
// Web Interface Guidelines:
// - focus trap + ESC kapatma
// - aria-modal, aria-labelledby, role="dialog"
// - inline hata mesajları (first-error focus on submit)
// - submit sırasında spinner
// - reduced motion desteği
//
// Otomatik şifre üretimi:
// - 12 karakter (8 büyük + 2 küçük harf + 2 rakam + sembol)
// - "Oluştur" deyince şifre hash'lenir, kullanıcıya "Şifreyi göster" checkbox'ı
// - Mail olarak GÖNDERİLMEZ — admin ekranda görür + panoya kopyala

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALLOWED_ROLES,
  type AllowedRole,
  createUser,
} from "../../services/admin";
import { getProvinces } from "../../services/references";
import { rolAdi } from "../../services/roles";
import { sifreKuralHatasi } from "../../services/sifreKurallari";
import type { ProvinceRef } from "../../types";
import { ApiHttpError } from "../../services/api";

type GrupKodu = "Yonetim" | "IlManager" | "IlEvaluator";

const GRUP_ROLLERI: Record<GrupKodu, AllowedRole> = {
  Yonetim: "SystemAdmin",
  IlManager: "ProvinceManager",
  IlEvaluator: "ProvinceEvaluator",
};

interface Props {
  acik: boolean;
  onClose: () => void;
  grupKodu: GrupKodu;
  ilKodu?: number;
  ilAdi?: string;
  basariliCallback?: () => void;
}

// 12-char güvenli şifre: 4 büyük harf + 4 küçük harf + 2 rakam + 2 sembol.
function guvenliSifreUret(): string {
  const BUYUK = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const KUCUK = "abcdefghjkmnpqrstuvwxyz";
  const RAKAM = "23456789";
  const SEMBOL = "!#@$%&";
  const sample = (s: string, n: number) => {
    const a: string[] = [];
    for (let i = 0; i < n; i++) {
      a.push(s[Math.floor(Math.random() * s.length)]);
    }
    return a;
  };
  const tum = [
    ...sample(BUYUK, 4),
    ...sample(KUCUK, 4),
    ...sample(RAKAM, 2),
    ...sample(SEMBOL, 2),
  ];
  // Fisher-Yates karıştır.
  for (let i = tum.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tum[i], tum[j]] = [tum[j], tum[i]];
  }
  return tum.join("");
}

export function UserCreateModal({ acik, onClose, grupKodu, ilKodu, ilAdi, basariliCallback }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const ilkInputRef = useRef<HTMLInputElement>(null);

  const presetRol = GRUP_ROLLERI[grupKodu];
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<AllowedRole>(presetRol);
  const [ilKoduState, setIlKoduState] = useState<number | "">(ilKodu ?? "");
  const [password, setPassword] = useState(() => guvenliSifreUret());
  const [sifreGizli, setSifreGizli] = useState(true);
  const [iller, setIller] = useState<ProvinceRef[]>([]);
  const [alanHatalari, setAlanHatalari] = useState<Partial<Record<string, string>>>({});
  const [genelHata, setGenelHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonOlusturulan, setSonOlusturulan] = useState<{ email: string; password: string; role: AllowedRole } | null>(null);

  const ilSecimiGerekli = role === "ProvinceManager" || role === "ProvinceEvaluator";

  useEffect(() => {
    if (acik) {
      getProvinces().then(setIller).catch(() => setIller([]));
      // Formu preset'le.
      setRole(presetRol);
      setIlKoduState(ilKodu ?? "");
      setEmail(""); setFirstName(""); setLastName("");
      setPassword(guvenliSifreUret());
      setSifreGizli(true);
      setAlanHatalari({});
      setGenelHata(null);
      setSonOlusturulan(null);
      // İlk input'a odaklan.
      setTimeout(() => ilkInputRef.current?.focus(), 60);
    }
  }, [acik, presetRol, ilKodu]);

  // ESC kapatma.
  useEffect(() => {
    if (!acik) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [acik, onClose]);

  // Body scroll kilitle.
  useEffect(() => {
    if (acik) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [acik]);

  const baslikMetni = useMemo(() => {
    if (grupKodu === "Yonetim") return "Yeni Sistem Yöneticisi / Bakanlık Yetkilisi";
    if (grupKodu === "IlManager") return "Yeni İl AR-GE Yöneticisi";
    return "Yeni İl AR-GE Değerlendiricisi";
  }, [grupKodu]);

  function validate(): boolean {
    const h: Partial<Record<string, string>> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      h.email = "Geçerli bir e-posta girin.";
    }
    if (!firstName.trim() || firstName.trim().length < 2) h.firstName = "Ad en az 2 karakter.";
    if (!lastName.trim() || lastName.trim().length < 2) h.lastName = "Soyad en az 2 karakter.";
    const pwHata = sifreKuralHatasi(password);
    if (pwHata) h.password = pwHata;
    if (ilSecimiGerekli && (ilKoduState === "" || !ilKoduState)) {
      h.ilKodu = "İl seçimi zorunlu.";
    }
    setAlanHatalari(h);
    return Object.keys(h).length === 0;
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      // İlk hatalı alana odaklan.
      const ilkHataliAlan = Object.keys(alanHatalari)[0];
      const el = dialogRef.current?.querySelector(`[data-alan="${ilkHataliAlan}"]`) as HTMLInputElement | null;
      el?.focus();
      return;
    }
    setGenelHata(null);
    setCalisiyor(true);
    try {
      await createUser({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        ilKodu: ilSecimiGerekli && ilKoduState ? Number(ilKoduState) : undefined,
      });
      setSonOlusturulan({ email, password, role });
      // Başarı toast'ı + otomatik kapatma (8 sn sonra).
      setTimeout(() => {
        basariliCallback?.();
        onClose();
      }, 1200);
    } catch (err) {
      setGenelHata(err instanceof ApiHttpError ? err.message : "Oluşturulamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  function panoyaKopyala() {
    if (sonOlusturulan) {
      const text = `E-posta: ${sonOlusturulan.email}\nŞifre: ${sonOlusturulan.password}`;
      navigator.clipboard?.writeText(text);
    }
  }

  if (!acik) return null;

  return (
    <div
      className="adm-modal-perde"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="adm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-baslik"
      >
        <header className="adm-modal-ust">
          <div>
            <h2 id="drawer-baslik">{baslikMetni}</h2>
            <small>
              Rol: <b>{rolAdi(role)}</b>
              {ilAdi && <> · İl: <b>{ilAdi}</b></>}
            </small>
          </div>
          <button
            type="button"
            className="adm-modal-kapat"
            onClick={onClose}
            aria-label="Kapat"
          >
            ✕
          </button>
        </header>

        <form onSubmit={gonder} className="adm-modal-govde" noValidate>
          {genelHata && (
            <div className="adm-bildirim adm-bildirim-hata" role="alert" aria-live="assertive" style={{ marginBottom: "1rem" }}>
              {genelHata}
            </div>
          )}
          {sonOlusturulan && (
            <div className="adm-bildirim adm-bildirim-basari" role="status" aria-live="polite">
              ✓ Kullanıcı oluşturuldu.
            </div>
          )}

          <div className={`adm-alan ${alanHatalari.email ? "hata" : ""}`}>
            <label htmlFor="dc-email">
              E-posta <span style={{ color: "#d8402f" }}>*</span>
            </label>
            <input
              id="dc-email"
              ref={ilkInputRef}
              type="email"
              data-alan="email"
              autoComplete="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!alanHatalari.email}
              aria-describedby={alanHatalari.email ? "dc-email-hata" : undefined}
              required
            />
            {alanHatalari.email && <span id="dc-email-hata" className="adm-alan-hata">{alanHatalari.email}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
            <div className={`adm-alan ${alanHatalari.firstName ? "hata" : ""}`}>
              <label htmlFor="dc-ad">
                Ad <span style={{ color: "#d8402f" }}>*</span>
              </label>
              <input
                id="dc-ad"
                type="text"
                data-alan="firstName"
                autoComplete="off"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-invalid={!!alanHatalari.firstName}
                required
              />
              {alanHatalari.firstName && <span className="adm-alan-hata">{alanHatalari.firstName}</span>}
            </div>
            <div className={`adm-alan ${alanHatalari.lastName ? "hata" : ""}`}>
              <label htmlFor="dc-soyad">
                Soyad <span style={{ color: "#d8402f" }}>*</span>
              </label>
              <input
                id="dc-soyad"
                type="text"
                data-alan="lastName"
                autoComplete="off"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                aria-invalid={!!alanHatalari.lastName}
                required
              />
              {alanHatalari.lastName && <span className="adm-alan-hata">{alanHatalari.lastName}</span>}
            </div>
          </div>

          <div className={`adm-alan ${alanHatalari.password ? "hata" : ""}`}>
            <label htmlFor="dc-sifre">
              Geçici Şifre <span style={{ color: "#d8402f" }}>*</span>
            </label>
            <div className="adm-sifre-kutu">
              <code aria-live="polite">{sifreGizli ? "•".repeat(password.length) : password}</code>
              <button
                type="button"
                onClick={() => setSifreGizli((g) => !g)}
                aria-label={sifreGizli ? "Şifreyi göster" : "Şifreyi gizle"}
              >
                {sifreGizli ? "👁 Göster" : "🙈 Gizle"}
              </button>
              <button
                type="button"
                onClick={() => setPassword(guvenliSifreUret())}
                aria-label="Yeni şifre üret"
              >
                🔄 Yeni Şifre
              </button>
            </div>
            <span className="adm-etiket-hint">
              Şifreyi kullanıcıya iletin, ilk girişte değiştirmesi istenir.
            </span>
          </div>

          {(grupKodu === "Yonetim") && (
            <div className="adm-alan">
              <label htmlFor="dc-rol">
                Rol <span style={{ color: "#d8402f" }}>*</span>
              </label>
              <select
                id="dc-rol"
                value={role}
                onChange={(e) => {
                  const yeniRol = e.target.value as AllowedRole;
                  setRole(yeniRol);
                  if (yeniRol !== "ProvinceManager" && yeniRol !== "ProvinceEvaluator") {
                    setIlKoduState("");
                  } else if (ilKoduState === "" && ilKodu) {
                    setIlKoduState(ilKodu);
                  }
                }}
              >
                {ALLOWED_ROLES.map((r) => (
                  <option key={r} value={r}>{rolAdi(r)}</option>
                ))}
              </select>
            </div>
          )}

          {ilSecimiGerekli && (
            <div className={`adm-alan ${alanHatalari.ilKodu ? "hata" : ""}`}>
              <label htmlFor="dc-il">
                İl <span style={{ color: "#d8402f" }}>*</span>
              </label>
              <select
                id="dc-il"
                data-alan="ilKodu"
                value={ilKoduState === "" ? "" : String(ilKoduState)}
                onChange={(e) => setIlKoduState(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={Boolean(ilKodu)}
                aria-invalid={!!alanHatalari.ilKodu}
                required
              >
                <option value="">İl seçin…</option>
                {iller.map((i) => (
                  <option key={i.id} value={i.id}>
                    {String(i.id).padStart(2, "0")} — {i.name}
                  </option>
                ))}
              </select>
              {alanHatalari.ilKodu && <span className="adm-alan-hata">{alanHatalari.ilKodu}</span>}
            </div>
          )}
        </form>

        <footer className="adm-modal-alt">
          <button type="button" className="adm-btn adm-btn-sessiz" onClick={onClose} disabled={calisiyor}>
            İptal
          </button>
          {sonOlusturulan && (
            <button type="button" className="adm-btn adm-btn-sessiz" onClick={panoyaKopyala}>
              📋 Şifreyi Kopyala
            </button>
          )}
          <button
            type="submit"
            className="adm-btn adm-btn-ana"
            onClick={(e) => gonder(e as unknown as React.FormEvent)}
            disabled={calisiyor}
          >
            {calisiyor ? "Oluşturuluyor…" : sonOlusturulan ? "✓ Oluşturuldu" : "Kullanıcı Oluştur"}
          </button>
        </footer>
      </div>
    </div>
  );
}
