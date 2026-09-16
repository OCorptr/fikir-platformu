import { useEffect, useState } from "react";

type YaziBoyutu = "buyuk" | "normal" | "kucuk";
type ImlecRengi = "beyaz" | "siyah" | "sari" | null;

type Ayarlar = {
  yazi: YaziBoyutu | null;
  disleksi: boolean;
  "yuksek-kontrast": boolean;
  "baglanti-vurgu": boolean;
  "ekran-okuyucu": boolean;
  "animasyon-durdur": boolean;
  imlec: ImlecRengi;
};

const VARSAYILAN: Ayarlar = {
  yazi: null,
  disleksi: false,
  "yuksek-kontrast": false,
  "baglanti-vurgu": false,
  "ekran-okuyucu": false,
  "animasyon-durdur": false,
  imlec: null,
};

function oku(): Ayarlar {
  try {
    const ham = localStorage.getItem("gf-erisilebilirlik");
    if (!ham) return { ...VARSAYILAN };
    const d = JSON.parse(ham) as Partial<Ayarlar>;
    return { ...VARSAYILAN, ...d };
  } catch {
    return { ...VARSAYILAN };
  }
}

function kaydet(a: Ayarlar) {
  try {
    localStorage.setItem("gf-erisilebilirlik", JSON.stringify(a));
  } catch {
    /* yok sayılır */
  }
}

export function AccessibilityPanel() {
  const [acik, setAcik] = useState(false);
  const [ayar, setAyar] = useState<Ayarlar>(() => oku());
  const [koyuMod, setKoyuMod] = useState(
    () => localStorage.getItem("gf-tema") === "koyu",
  );

  // ayar degisikliklerini uygula
  useEffect(() => {
    const h = document.documentElement;
    h.classList.toggle("yazi-buyuk", ayar.yazi === "buyuk");
    h.classList.toggle("yazi-kucuk", ayar.yazi === "kucuk");
    h.classList.toggle("disleksi", !!ayar.disleksi);
    h.classList.toggle("yuksek-kontrast", !!ayar["yuksek-kontrast"]);
    h.classList.toggle("baglanti-vurgu", !!ayar["baglanti-vurgu"]);
    h.classList.toggle("animasyon-durdur", !!ayar["animasyon-durdur"]);
    h.classList.toggle("ekran-okuyucu", !!ayar["ekran-okuyucu"]);
    h.classList.toggle("imlec-beyaz", ayar.imlec === "beyaz");
    h.classList.toggle("imlec-siyah", ayar.imlec === "siyah");
    h.classList.toggle("imlec-sari", ayar.imlec === "sari");
    kaydet(ayar);
  }, [ayar]);

  // koyu mod durumunu uygula (tema.js ile ayni davranis)
  useEffect(() => {
    document.documentElement.classList.toggle("koyu-mod", koyuMod);
    localStorage.setItem("gf-tema", koyuMod ? "koyu" : "acik");
    const logos = koyuMod
      ? {
          marka: "/assets/img/gencarge_logo_koyu.webp",
          yuzyil: "/assets/img/1_koyu.webp",
        }
      : {
          marka: "/assets/img/gencarge_logo.webp",
          yuzyil: "/assets/img/1.webp",
        };
    document
      .querySelectorAll<HTMLImageElement>(".logo-mark")
      .forEach((img) => (img.src = logos.marka));
    document
      .querySelectorAll<HTMLImageElement>(".yuz-yil-logo")
      .forEach((img) => (img.src = logos.yuzyil));
  }, [koyuMod]);

  function anahtarGuncelle(anahtar: keyof Ayarlar, deger: boolean | string | null) {
    setAyar((onceki) => ({ ...onceki, [anahtar]: deger }) as Ayarlar);
  }

  function sayfayiOku() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const parcalar = Array.from(
      document.querySelectorAll("main h1, main h2, main p, main li, main td"),
    )
      .map((el) => (el as HTMLElement).innerText.trim())
      .filter((metin) => metin.length > 0);
    parcalar.forEach((metin) => {
      const ses = new SpeechSynthesisUtterance(metin);
      ses.lang = "tr-TR";
      window.speechSynthesis.speak(ses);
    });
  }

  function okumayiDurdur() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  const anahtar = (etiket: string, ozellik: keyof Ayarlar) => (
    <div className="ep-satir">
      <span>{etiket}</span>
      <button
        type="button"
        className={`ep-anahtar${ayar[ozellik] ? " acik" : ""}`}
        aria-label={etiket}
        aria-pressed={!!ayar[ozellik]}
        onClick={() => anahtarGuncelle(ozellik, !ayar[ozellik])}
      />
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="erisilebilirlik-dugme"
        aria-expanded={acik}
        aria-controls="erisilebilirlik-panel"
        onClick={() => setAcik((deger) => !deger)}
      >
        <img src="/assets/img/erisilebilirlik_man.png" alt="Erişilebilirlik araçları" />
      </button>

      <div id="erisilebilirlik-panel" className={`erisilebilirlik-panel${acik ? " acik" : ""}`}>
        <div className="ep-baslik">♿ Erişilebilirlik</div>

        <div className="ep-satir">
          <span>🌗 Koyu Mod</span>
          <button
            type="button"
            className={`ep-anahtar${koyuMod ? " acik" : ""}`}
            aria-label="Koyu mod"
            aria-pressed={koyuMod}
            onClick={() => {
              setKoyuMod((deger) => !deger);
            }}
          />
        </div>

        <div className="ep-satir">
          <span>🔊 Ekran Okuyucu</span>
          <button
            type="button"
            className={`ep-anahtar${ayar["ekran-okuyucu"] ? " acik" : ""}`}
            aria-label="Ekran okuyucu"
            aria-pressed={!!ayar["ekran-okuyucu"]}
            onClick={() => anahtarGuncelle("ekran-okuyucu", !ayar["ekran-okuyucu"])}
          />
        </div>
        {ayar["ekran-okuyucu"] && (
          <div className="ep-okuma-araclari">
            <button type="button" className="ep-dugme" onClick={sayfayiOku}>▶ Sayfayı Oku</button>
            <button type="button" className="ep-dugme" onClick={okumayiDurdur}>⏹ Durdur</button>
          </div>
        )}

        <div className="ep-satir">
          <span>🔠 Yazı Boyutu</span>
          <div className="ep-grup">
            {(["kucuk", "normal", "buyuk"] as const).map((boyut, indeks) => (
              <button
                key={boyut}
                type="button"
                className={`ep-dugme${ayar.yazi === boyut ? " acik" : ""}`}
                onClick={() => anahtarGuncelle("yazi", boyut === "normal" ? null : boyut)}
              >
                {["A−", "A", "A+"][indeks]}
              </button>
            ))}
          </div>
        </div>

        <div className="ep-satir">
          <span>📖 Disleksi Dostu Yazı Tipi</span>
          <button
            type="button"
            className={`ep-anahtar${ayar.disleksi ? " acik" : ""}`}
            aria-label="Disleksi dostu yazı tipi"
            aria-pressed={!!ayar.disleksi}
            onClick={() => anahtarGuncelle("disleksi", !ayar.disleksi)}
          />
        </div>

        <div className="ep-satir">
          <span>🌗 Yüksek Kontrast</span>
          <button
            type="button"
            className={`ep-anahtar${ayar["yuksek-kontrast"] ? " acik" : ""}`}
            aria-label="Yüksek kontrast"
            aria-pressed={!!ayar["yuksek-kontrast"]}
            onClick={() => anahtarGuncelle("yuksek-kontrast", !ayar["yuksek-kontrast"])}
          />
        </div>

        <div className="ep-satir">
          <span>🔗 Bağlantıları Vurgula</span>
          <button
            type="button"
            className={`ep-anahtar${ayar["baglanti-vurgu"] ? " acik" : ""}`}
            aria-label="Bağlantıları vurgula"
            aria-pressed={!!ayar["baglanti-vurgu"]}
            onClick={() => anahtarGuncelle("baglanti-vurgu", !ayar["baglanti-vurgu"])}
          />
        </div>

        <div className="ep-satir">
          <span>🖱️ İmleç Rengi</span>
          <div className="ep-grup">
            {(["beyaz", "siyah", "sari"] as const).map((renk, indeks) => (
              <button
                key={renk}
                type="button"
                className={`ep-dugme${ayar.imlec === renk ? " acik" : ""}`}
                aria-label={`İmleç rengi: ${["Beyaz", "Siyah", "Sarı"][indeks]}`}
                aria-pressed={ayar.imlec === renk}
                onClick={() => anahtarGuncelle("imlec", renk)}
              >
                {["⚪", "⚫", "🟡"][indeks]}
              </button>
            ))}
          </div>
        </div>

        <div className="ep-satir">
          <span>⏸️ Animasyonları Durdur</span>
          <button
            type="button"
            className={`ep-anahtar${ayar["animasyon-durdur"] ? " acik" : ""}`}
            aria-label="Animasyonları durdur"
            aria-pressed={!!ayar["animasyon-durdur"]}
            onClick={() => anahtarGuncelle("animasyon-durdur", !ayar["animasyon-durdur"])}
          />
        </div>

        <button type="button" className="ep-sifirla" onClick={() => setAyar({ ...VARSAYILAN })}>
          ♻️ Tümünü Sıfırla
        </button>
      </div>
    </>
  );
}
