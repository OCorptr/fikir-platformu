// Fikrin hangi asamada oldugunu gosteren 5 asamali cizgi.
//
// Onur (S11.88): gonderim sonrasi ekraninda gosterilen bu cizgi geciciydi;
// ogrenci fikri gonderdikten sonra bir daha erisemiyordu. Bu bilesen cizgiyi
// durumdan turetir ve hem detay ekraninda hem gonderim sonrasi ekraninda
// kullanilir - iki yer ayni gorunur.
//
// Konu: 'fikir-asama' icin 'onurlink' degil, mevcut `.adimlar` / `.adim`
// temelini paylasir; boylece gonderim sonrasi ekraninin gorunumu degismez.

import { ASAMALAR, durumAsamalari, durumOzeti, type FikirDurumu } from "../services/fikirAsamalari";

export function FikirAsamaCizgisi({
  durum,
  yon = "asagi",
}: {
  durum: FikirDurumu;
  /** 'asagi' = dikey liste (mobil), 'yatay' = gonderim sonrasi ekrani. */
  yon?: "asagi" | "yatay";
}) {
  const { indeks } = durumAsamalari(durum);

  // Taslak veya silinmis fikir - henuz bir surec baslamadi, cizgi anlamsiz.
  if (indeks < 0) {
    return (
      <div className="asama-bos">
        <p className="asama-bos__baslik">{durumOzeti(durum)}</p>
        <p className="asama-bos__alt">
          Fikir gönderildiğinde aşamalar burada adım adım görünecek.
        </p>
      </div>
    );
  }

  return (
    <div className={`asama-izgara asama-izgara--${yon}`}>
      {ASAMALAR.map((asama, i) => {
        let sinif = "asama";
        if (i < indeks) sinif += " asama--tamamlandi";
        else if (i === indeks) sinif += " asama--aktif";
        else sinif += " asama--bekliyor";

        const bitti = i < indeks || durum === "ImplementationCompleted";
        if (durum === "ImplementationFailed" && i === indeks) sinif += " asama--basarisiz";

        return (
          <div key={asama.sira} className={sinif}>
            <span className="asama__no">
              {bitti ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 13l4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                asama.sira
              )}
            </span>
            <div className="asama__metin">
              <span className="asama__baslik">{asama.baslik}</span>
              <span className="asama__aciklama">{asama.aciklama}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
