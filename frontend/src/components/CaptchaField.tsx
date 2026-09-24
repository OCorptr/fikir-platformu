// Basit matematik CAPTCHA alanı (YEĞİTEK gereksinim #2):
// - /api/auth/captcha/new ile yeni soru alır (örn. "5 + 3")
// - Kullanıcı cevabı girer, form gönderildiğinde CaptchaId + Answer backend'e iletilir.
// - Tek kullanımlık: başarılı/başarısız doğrulamadan sonra yeni soru gerekir.

import { useEffect, useState } from "react";
import { apiRequest, ApiHttpError } from "../services/api";

interface CaptchaState {
  id: string;
  question: string;
}

export function CaptchaField(props: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  captchaId: string;
  onCaptchaIdChange: (id: string) => void;
}) {
  const [soru, setSoru] = useState<CaptchaState | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // İlk mount ve "yenile" tıklamasında yeni soru al.
  const yenile = async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const yeni = await apiRequest<{ id: string; question: string }>("/api/auth/captcha/new");
      setSoru(yeni);
      props.onCaptchaIdChange(yeni.id);
      props.onChange("");
    } catch (e) {
      setHata(e instanceof ApiHttpError ? e.message : "CAPTCHA yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    yenile();
    // mount'ta bir kere çalışsın — props callback'leri ref'le
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="captcha-field">
      <label htmlFor={props.id} className="captcha-label">
        Güvenlik sorusu{" "}
        <button
          type="button"
          className="captcha-yenile"
          onClick={yenile}
          disabled={yukleniyor}
          aria-label="Yeni güvenlik sorusu"
          title="Yeni soru"
        >
          🔄 {yukleniyor ? "..." : "Yenile"}
        </button>
      </label>
      <div className="captcha-soru-blok">
        <span className="captcha-soru" aria-live="polite">
          {soru ? `${soru.question} = ?` : "Yükleniyor…"}
        </span>
        <input
          id={props.id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={6}
          required
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-describedby={`${props.id}-help`}
        />
      </div>
      <small id={`${props.id}-help`} className="captcha-help">
        İşlem sonu: {soru ? "yeni soru gerekli" : "—"}
      </small>
      {hata && <div className="captcha-hata">{hata}</div>}
    </div>
  );
}