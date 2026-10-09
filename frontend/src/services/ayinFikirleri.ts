// Ana sayfa "Ayın Fikirleri" — herkese açık okuma ucu (Sprint 11.92).
//
// Bu veri ÖNCEDEN kod içinde sabit nesnelerdi (HomePage.tsx, sahte isim/okul/ay).
// Artık gerçek dönem kazananlarından geliyor. Uç anonimdir; öğrenci adı
// backend'de "Emir K." biçiminde maskelenerek gelir.
//
// KURAL (Onur, 9 Eki 2026): adaylar (kategori başına 1) bakanlık içindir.
// Anasayfa SADECE bakanlığın seçtiği kazananı yayınlar: aktif dönem + geçmiş 2.

import { apiRequest } from "./api";

export interface KazananKart {
  fikirId: string;
  kategoriId: number;
  kategori: string;
  il: string;
  /** PII maskeli: "Emir K." */
  ogrenci: string;
  fikir: string;
}

export interface DonemKaydi {
  id: string;
  etiket: string;
  baslangic: string;
  bitis: string;
  durum: string;
  /** null = bu dönem için bakanlık henüz kazanan seçmedi. */
  kazanan: KazananKart | null;
  secimTarihi: string | null;
}

export interface AyinFikirleriCevabi {
  aktifDonem: DonemKaydi | null;
  /** Tüm dönemler, en yeniden eskiye. */
  donemler: DonemKaydi[];
}

/** Anasayfada gösterilecek kazanan sayısı: aktif dönem + geçmiş 2 dönem. */
export const ANASAYFA_KAZANAN_SAYISI = 3;

export function ayinFikirleriGetir(signal?: AbortSignal): Promise<AyinFikirleriCevabi> {
  return apiRequest<AyinFikirleriCevabi>("/api/public/ayin-fikirleri", { signal });
}

/** Kazananı olan dönemler, en yeniden eskiye. */
export function kazananDonemler(cevap: AyinFikirleriCevabi): DonemKaydi[] {
  return (cevap.donemler ?? []).filter((d) => d.kazanan !== null);
}

/** Anasayfa kartları: aktif dönem + geçmiş 2 dönemin kazananları. */
export function anasayfaDonemleri(cevap: AyinFikirleriCevabi): DonemKaydi[] {
  return kazananDonemler(cevap).slice(0, ANASAYFA_KAZANAN_SAYISI);
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/**
 * Dönemi "Ekim - Aralık 2026" biçiminde gösterir (Onur, 9 Eki 2026).
 *
 * ⚠️ **Bitiş tarihi DAHİL DEĞİLDİR.** 2026 IV. dönem `2027-01-01`'de bitiyor;
 * yani son ay Aralık 2026'dır, "Aralık 2027" DEĞİL. Önceki hâlde yıl ay
 * geri alınınca bile 2027'de kalıyordu → "Ekim 2026 - Aralık 2027" çıkıyordu.
 */
export function donemAralik(kayit: DonemKaydi): string {
  const bas = new Date(kayit.baslangic);
  const son = new Date(kayit.bitis);

  const basAy = bas.getUTCMonth();
  const basYil = bas.getUTCFullYear();

  let sonAy = son.getUTCMonth();
  let sonYil = son.getUTCFullYear();
  if (son.getUTCDate() === 1) {
    // Son ay bir önceki ay → Ocak'a düşerse yıl da bir geri gider.
    sonAy -= 1;
    if (sonAy < 0) {
      sonAy += 12;
      sonYil -= 1;
    }
  }

  // Yıl sınırlarını aşan dönemde iki yıl yazılır; normal dönemde tek.
  const yil = basYil === sonYil ? ` ${sonYil}` : ` ${basYil} – ${sonYil}`;
  return `${AY_ADLARI[basAy]} - ${AY_ADLARI[sonAy]}${yil}`;
}

/**
 * Kategori adından emoji. Kategori adları DB'den gelir ve serbest metindir,
 * bu yüzden tam eşleşme yerine anahtar kelime eşleştirme yapılır.
 */
export function kategoriEmoji(kategori: string): string {
  const k = (kategori ?? "").toLocaleLowerCase("tr");
  if (/(çevre|sürdür|yeşil|iklim|atkı)/.test(k)) return "🌱";
  if (/(yapay zek|zekâ|zeka)/.test(k)) return "🤖";
  if (/(değerler|edebiyat|ahlak|kültür|sanat)/.test(k)) return "📖";
  if (/(sosyal fayda|yardım|dayanışma|sorumluluk)/.test(k)) return "🤝";
  if (/(teknoloji|yenilik|inşaat|mühendislik|üretim)/.test(k)) return "⚙️";
  if (/(spor|sağlık|beslenme|yaşam)/.test(k)) return "🩺";
  if (/(girişim|ekonom)/.test(k)) return "💡";
  if (/(afet|güvenli)/.test(k)) return "🛡️";
  return "💡";
}