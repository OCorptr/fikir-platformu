// Identity rol adı → kullanıcı arayüzünde görüntülenecek etiket.
//
// Onur Sprint 11.10 talebi: AR-GE rozetleri kısa görünsün.
// DB'deki IdentityRole.Name korunur (Identity framework sabit isimleri):
//   "SystemAdmin", "MinistryOfficial", "ProvinceManager", "ProvinceEvaluator", "Student".
// Sadece UI gösterimi için bu eşleme kullanılır. Asla API'ye giden role parametresini
// veya IdentityUserRole join'deki isimleri bu helper ile değiştirme.
//
// CSV toplu import, kullanıcı oluşturma ve Identity authorize policy'leri
// IdentityName kullanır.

export const ROLE_DISPLAY: Record<string, string> = {
  SystemAdmin: "Sistem Yöneticisi",
  MinistryOfficial: "Bakanlık AR-GE Yetkilisi",
  ProvinceManager: "İl AR-GE Yöneticisi",
  ProvinceEvaluator: "İl AR-GE Değerlendiricisi",
  Student: "Öğrenci",
};

/** Identity rol adını UI etiketine çevirir. Bilinmeyen role'leri aynen döner. */
export function rolAdi(identityRole: string): string {
  return ROLE_DISPLAY[identityRole] ?? identityRole;
}

/** AR-GE rozetlerini sıralı kısa liste olarak döner (UI sıralaması). */
export const ARGE_ROL_SIRASI = [
  "SystemAdmin",
  "MinistryOfficial",
  "ProvinceManager",
  "ProvinceEvaluator",
] as const;
