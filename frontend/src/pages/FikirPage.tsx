import { useState, type FormEvent } from "react";
import { UstBar } from "../components/UstBar";

const MAX = 1500;
const ILLER = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkâri","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kırıkkale","Kırklareli","Kırşehir","Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"];

const TEMALAR = [
  "🎨 Kültür ve Sanat",
  "⚽ Spor ve Sağlıklı Yaşam",
  "🔬 Bilim ve Teknoloji",
  "🤖 Yapay Zekâ",
  "🌱 Çevre ve Sürdürülebilirlik",
  "🤝 Sosyal Sorumluluk",
  "💡 Girişimcilik",
  "🚨 Afet Farkındalığı ve Güvenli Yaşam",
  "📖 Değerler Eğitimi",
  "🏭 Yerli ve Millî Üretim – Millî Savunma",
];

const SINIF_GRUPLARI = [
  { etiket: "İlkokul", siniflar: [1, 2, 3, 4] },
  { etiket: "Ortaokul", siniflar: [5, 6, 7, 8] },
  { etiket: "Lise", siniflar: [9, 10, 11, 12] },
];

export default function FikirPage() {
  const [tema, setTema] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [il, setIl] = useState("");
  const [sinif, setSinif] = useState("");
  const [okul, setOkul] = useState("");
  const [okulNo, setOkulNo] = useState("");
  const [fikir, setFikir] = useState("");
  const [ekipAcik, setEkipAcik] = useState(false);
  const [ekipGirdi, setEkipGirdi] = useState("");
  const [ekipArkadaslar, setEkipArkadaslar] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [gonderildi, setGonderildi] = useState(false);

  function fikriniTemizle() {
    setTema("");
    setAdSoyad("");
    setIl("");
    setSinif("");
    setOkul("");
    setOkulNo("");
    setFikir("");
    setEkipArkadaslar([]);
    setHata(null);
  }

  function gonder() {
    if (!tema) { setHata("Göndermeden önce bir tema seçmelisin."); return; }
    if (!adSoyad.trim() || !il || !sinif || !okul.trim() || !okulNo.trim()) { setHata("Lütfen öğrenci bilgilerinin tamamını doldur."); return; }
    if (fikir.trim().length < 10) { setHata("Lütfen fikrini en az bir cümleyle anlat."); return; }
    setHata(null);
    setGonderildi(true);
  }

  return (
    <>
      <UstBar />
      <main className="fikir-hero">
        <div className="fikir-sol">
          <div className="balon-kapsa">
            <div className="balon">
              {gonderildi
                ? "Fikrin bize ulaştı, teşekkür ederiz! 🎉"
                : hata
                  ? hata
                  : ekipAcik
                    ? "Arkadaşlarını davet et; fikirler paylaşıldıkça büyür! 💪"
                    : <>Merhaba, ben Fikri! 🖐 Önce bir <b>tema</b> seç, sonra bilgilerini doldur ve fikrini anlat. Sıra sende!</>}
            </div>
          </div>
          <img className="maskot-fikir" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE maskotu" />
        </div>

        <section className="fikir-karti">
          {gonderildi ? (
            <div className="basari">
              <svg className="basari-tik" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" fill="none" stroke="#16a34a" strokeWidth="3" />
                <path d="M15 27 l7.5 7 L38 19" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <h2 style={{ color: "#16355c", fontSize: "1.8rem" }}>Fikrin bize ulaştı!</h2>
              <p style={{ color: "#647a92" }}>Fikrinin değerlendirme sürecini buradan takip edebilirsin.</p>
              <div className="adimlar">
                <span className="adim aktif">Gönderildi</span>
                <span className="adim">Ön Değerlendirme</span>
                <span className="adim">Komisyon İncelemesi</span>
                <span className="adim">Planlama</span>
                <span className="adim">Hayata Geçirildi</span>
              </div>
              <button type="button" className="btn-ikincil" onClick={() => { setFikir(""); }}>Yeni Fikir Yaz</button>
            </div>
          ) : (
            <>
              <h1>
                <span style={{ color: "#1f9fa4" }}>Fikrini</span>{" "}
                <span style={{ color: "#ef7814" }}>Anlat!</span>
              </h1>

              <div className="bolum-basligi turkuaz">1 · Temanı Seç</div>
              <select className="tema-secim" value={tema} onChange={(e) => setTema(e.target.value)}>
                <option value="">🎨 Bir tema seç...</option>
                {TEMALAR.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <div className="bolum-basligi mavi">2 · Öğrenci Bilgileri</div>
              <div className="ogrenci-alani">
                <div className="ogrenci-alan">
                  <label htmlFor="ogr-ad">Ad Soyad</label>
                  <input id="ogr-ad" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} placeholder="Örnek: Zeynep Kaya" maxLength={60} />
                </div>
                <div className="ogrenci-alan">
                  <label htmlFor="ogr-il">İl</label>
                  <select id="ogr-il" value={il} onChange={(e) => setIl(e.target.value)}>
                    <option value="">İl seç...</option>
                    {ILLER.map((ilAdi: string) => <option key={ilAdi} value={ilAdi}>{ilAdi}</option>)}
                  </select>
                </div>
                <div className="ogrenci-alan">
                  <label htmlFor="ogr-sinif">Sınıf</label>
                  <select id="ogr-sinif" value={sinif} onChange={(e) => setSinif(e.target.value)}>
                    <option value="">Sınıf seç...</option>
                    {SINIF_GRUPLARI.map((g) => (
                      <optgroup key={g.etiket} label={g.etiket}>
                        {g.siniflar.map((s) => <option key={s} value={s}>{s}. sınıf</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="ogrenci-alan genis">
                  <label htmlFor="ogr-okul">Okul</label>
                  <input id="ogr-okul" value={okul} onChange={(e) => setOkul(e.target.value)} placeholder="Örnek: Atatürk Ortaokulu" maxLength={80} />
                </div>
                <div className="ogrenci-alan">
                  <label htmlFor="ogr-no">Okul No</label>
                  <input id="ogr-no" value={okulNo} onChange={(e) => setOkulNo(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Örnek: 1045" inputMode="numeric" />
                </div>
              </div>

              <div className="bolum-basligi turuncu">3 · Fikrim</div>
              <textarea id="fikrim" rows={5} maxLength={MAX} value={fikir} onChange={(e) => setFikir(e.target.value)} placeholder="Fikrini buraya yaz... Dünyamızı daha güzel bir yer yapan ne olabilir?" />
              <div className="sayac-satiri">
                <span>{fikir.length} / {MAX} karakter</span>
              </div>

              <div className="fikir-butonlar">
                <button type="button" className="btn-ana btn-tam" onClick={gonder}>Fikrimi Gönder 🚀</button>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
