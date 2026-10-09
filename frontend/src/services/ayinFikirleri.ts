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

/** Dönem etiketini "2026 IV. Donem" gibi kullanmak için güvenli gösterim. */
export function donemAralik(kayit: DonemKaydi): string {
  const b = new Date(kayit.baslangic);
  const s = new Date(kayit.bitis);
  const ayAdlari = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const bas = `${ayAdlari[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  // Bitis bitiş ayının ilk günü ise (ör. 2027-01-01) önceki ay gösterilir.
  const bitisAy = s.getUTCDate() === 1 ? s.getUTCMonth() - 1 : s.getUTCMonth();
  const bitisYil = s.getUTCDate() === 1 ? s.getUTCFullYear() : s.getUTCFullYear();
  return `${bas} – ${ayAdlari[(bitisAy + 12) % 12]} ${bitisYil}`;
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