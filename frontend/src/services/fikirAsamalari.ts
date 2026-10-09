// Fikir durumu -> gorsel asama eslemesi (TEK KAYNAK).
//
// Onur (S11.88): "fikir yolladigimizda cikan bir goruntu var... o bilgiye her
// istedigi zaman ulasip kontrol edebilmeli ama bu ozellik yok. Taslaklarim &
// Gecmis Fikirlerim alanindan yolladigimiz bu fikirler tiklanarak erisilebilir
// olmali."
//
// Gonderim sonrasi ekraninda gosterilen 5 asamli cizgi (FikirPage `gonderildiEkran`)
// geciciydi: `formuTemizle()` ile kayboluyordu. Artik ayni cizgi her fikir icin
// detayda gorunuyor ve `status`'ten turetiyor - elle "aktif" isaretlenmiyor.
//
// Backend enum: IdeaSubmissionStatus (10 deger, Deleted haric 9 aktif yol).
// Buradaki INDIS, `IdeaStatus` string degerleriyle birebir eslesir; backend
// enum'unu degistirmek bu tabloyu da degistirmeyi gerektirir.

import type { StudentIdeaDto } from "../types";

export type FikirDurumu = StudentIdeaDto["status"];

/** Ekranda gosterilen 5 asama. */
export interface Asama {
  /** Cizgide gosterilen sira (1-5). */
  sira: number;
  /** Turkce baslik. */
  baslik: string;
  /** Ogrenciye gosterilecek kisa aciklama. */
  aciklama: string;
}

export const ASAMALAR: Asama[] = [
  {
    sira: 1,
    baslik: "Gönderildi",
    aciklama: "Fikrin bize ulaştı ve sistemimize kaydedildi.",
  },
  {
    sira: 2,
    baslik: "Ön Değerlendirme",
    aciklama:
      "Fikrin, kendi ilindeki AR-GE birimince ön değerlendirmeden geçiriliyor.",
  },
  {
    sira: 3,
    baslik: "Komisyon İncelemesi",
    aciklama:
      "Ön değerlendirme bitti. Şimdi bakanlık komisyonu fikrini inceliyor.",
  },
  {
    sira: 4,
    baslik: "Planlama",
    aciklama:
      "Fikir bir değerlendirme dönemine dahil edildi ve uygulama planına alındı.",
  },
  {
    sira: 5,
    baslik: "Hayata Geçirildi",
    aciklama: "Fikir uygulanıyor veya uygulandı.",
  },
];

/** Bu durumda asamanin durumu: gecildi mi, su an mi, sira mi? */
export type AsamaDurumu = "tamamlandi" | "aktif" | "bekliyor" | "basarisiz";

/**
 * Backend durumunu asama tablosuna baglar.
 *
 * `Draft` ve `Deleted` bilerek -1 doner: bunlar "surec baslamadi" ya da
 * "fikir artik yok" durumlaridir, cizgide yeri yoktur. (-1 = cizgi gosterilmez.)
 */
export function durumAsamalari(durum: FikirDurumu): {
  indeks: number;
  durum: AsamaDurumu;
} {
  switch (durum) {
    case "Draft":
    case "Deleted":
      return { indeks: -1, durum: "bekliyor" };

    // 1. asama
    case "Submitted":
      return { indeks: 0, durum: "aktif" };

    // 2. asama
    case "InEvaluation":
      return { indeks: 1, durum: "aktif" };

    // 3. asama
    case "EvaluationCompleted":
      return { indeks: 2, durum: "aktif" };

    // 4. asama - Locked bakanlikca döneme secildi, Planned ise plana alindi.
    // Ikisi de Planlama asamasi; Locked daha erken bir noktada.
    case "Locked":
    case "Planned":
      return { indeks: 3, durum: "aktif" };

    // 5. asama
    case "ImplementationInProgress":
      return { indeks: 4, durum: "aktif" };
    case "ImplementationCompleted":
      return { indeks: 4, durum: "tamamlandi" };
    case "ImplementationFailed":
      return { indeks: 4, durum: "basarisiz" };

    // Backend yeni bir durum eklerse buraya dusulur; sessizce yanlis gostermek
    // yerine "0. asama" deyip olusturulabilir sekilde dur.
    default:
      return { indeks: 0, durum: "bekliyor" };
  }
}

/** Ogrenciye gosterilecek tek satirlik durum aciklamasi. */
export function durumOzeti(durum: FikirDurumu): string {
  switch (durum) {
    case "Draft":
      return "Taslak — henüz gönderilmedi.";
    case "Submitted":
      return "Fikriniz alındı, ön değerlendirme bekliyor.";
    case "InEvaluation":
      return "İlinizdeki AR-GE birimi fikrinizi değerlendiriyor.";
    case "EvaluationCompleted":
      return "Bakanlık komisyonu fikrinizi inceliyor.";
    case "Locked":
      return "Fikriniz bir değerlendirme dönemine dahil edildi.";
    case "Planned":
      return "Fikriniz uygulama planına alındı.";
    case "ImplementationInProgress":
      return "Fikriniz uygulanıyor.";
    case "ImplementationCompleted":
      return "Fikriniz hayata geçirildi. Teşekkürler!";
    case "ImplementationFailed":
      // Sprint 11.92: "Başarısız" çocuğa suçluluk yükü bindiriyordu ve 5. adım
    // açıklaması "uygulanıyor veya uygulandı" diyerek bunu çürütüyordu.
    return "Bu fikir için uygulama yapılmadı. Fikrin kayıtta ve değerlendirmede kaldı.";
    case "Deleted":
      return "Bu fikir silinmiş.";
  }
}
