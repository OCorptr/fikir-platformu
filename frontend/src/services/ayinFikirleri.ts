// Ana sayfa "Ayın Fikirleri" — herkese açık okuma ucu (Sprint 11.92).
//
// Bu veri ÖNCEDEN kod içinde sabit nesnelerdi (HomePage.tsx, sahte isim/okul/ay).
// Artık gerçek dönem seçimlerinden geliyor. Uç anonimdir; öğrenci adı
// backend'de "Emir K." biçiminde maskelenerek gelir.

import { apiRequest } from "./api";

export interface AyinFikriKart {
  /** Dönem + kategori adayı (JSON camelCase: fikirId). */
  fikirId: string;
  kategoriId: number;
  kategori: string;
  il: string;
  /** PII maskeli: "Emir K." */
  ogrenci: string;
  fikir: string;
  secimTarihi: string;
}

export interface DonemOzet {
  id: string;
  etiket: string;
  baslangic: string;
  bitis: string;
  durum: string;
}

export interface ArsivKaydi {
  id: string;
  etiket: string;
  baslangic: string;
  bitis: string;
  kazanan: AyinFikriKart | null;
}

export interface AyinFikirleriCevabi {
  donem: DonemOzet | null;
  adaylar: AyinFikriKart[];
  kazananFikirId: string | null;
  arsiv: ArsivKaydi[];
}

/** İçinde bulunulan dönemin adayları + geçmiş dönemlerin kazananları. */
export function ayinFikirleriGetir(signal?: AbortSignal): Promise<AyinFikirleriCevabi> {
  return apiRequest<AyinFikirleriCevabi>("/api/public/ayin-fikirleri", { signal });
}

/**
 * Kategori adından emoji. Kategori adları DB'den gelir ve serbest metindir,
 * bu yüzden tam eşleşme yerine anahtar kelime eşleştirme yapılır.
 */
export function kategoriEmoji(kategori: string): string {
  const k = (kategori ?? "").toLocaleLowerCase("tr");
  if (/(çevre|sürdür|yeşil|iklim|atkı)/.test(k)) return "🌱";
  if (/(yapay zek|ai\b|zeka)/.test(k)) return "🤖";
  if (/(değerler|edebiyat|ahlak)/.test(k)) return "📖";
  if (/(sosyal fayda)/.test(k)) return "❤️";
  if (/(sosyal sorumluluk|yardım|dayanışma)/.test(k)) return "🤝";
  if (/(teknoloji|yenilik|inşaat|mühendislik)/.test(k)) return "⚙️";
  if (/(sağlık|spor|beslenme)/.test(k)) return "🩺";
  return "💡";
}

/** Kategori adından kısa etiket (kartın "tema" satırı). */
export function kategoriEtiket(kategori: string): string {
  return `${kategoriEmoji(kategori)} ${kategori}`.trim();
}