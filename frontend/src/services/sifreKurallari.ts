/**
 * Şifre kuralları — YEĞİTEK güvenlik gereksinimi madde 16 (Sprint 11.53).
 *
 * Backend'deki Identity konfigürasyonuyla BİREBİR aynı olmalıdır:
 *   RequiredLength 8 · RequireUppercase · RequireLowercase
 *   RequireDigit · RequireNonAlphanumeric
 *
 * Buradaki kurallar yalnızca kullanıcıyı erken uyarmak içindir; gerçek doğrulama
 * backend'de yapılır ve hatalar Türkçe döner.
 */

export const SIFRE_MIN_UZUNLUK = 8;

export const SIFRE_KURALLARI = [
  "En az 8 karakter",
  "En az bir büyük harf (A-Z)",
  "En az bir küçük harf (a-z)",
  "En az bir rakam (0-9)",
  "En az bir özel karakter (örn. ! ? @ # $)",
] as const;

/** Şifrenin karşılamadığı kuralların Türkçe açıklamalarını döner (boşsa uyumlu). */
export function sifreKuralIhlalleri(sifre: string): string[] {
  const ihlaller: string[] = [];

  if (sifre.length < SIFRE_MIN_UZUNLUK) {
    ihlaller.push(`En az ${SIFRE_MIN_UZUNLUK} karakter`);
  }
  if (!/[A-Z]/.test(sifre)) ihlaller.push("En az bir büyük harf (A-Z)");
  if (!/[a-z]/.test(sifre)) ihlaller.push("En az bir küçük harf (a-z)");
  if (!/[0-9]/.test(sifre)) ihlaller.push("En az bir rakam (0-9)");
  if (!/[^A-Za-z0-9]/.test(sifre)) ihlaller.push("En az bir özel karakter (örn. ! ? @ # $)");

  return ihlaller;
}

/** Tek satırlık Türkçe hata mesajı; uyumluysa null. */
export function sifreKuralHatasi(sifre: string): string | null {
  const ihlaller = sifreKuralIhlalleri(sifre);
  if (ihlaller.length === 0) return null;
  return `Şifre ${ihlaller.join(", ")} içermelidir.`;
}

export function sifreKurallaraUyuyor(sifre: string): boolean {
  return sifreKuralIhlalleri(sifre).length === 0;
}
