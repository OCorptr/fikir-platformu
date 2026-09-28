using Microsoft.AspNetCore.Identity;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// ASP.NET Core Identity'nin şifre kurallarını Türkçeye çevirir ve tek bir
/// kullanıcı dostu mesaja toplar (Sprint 11.53, YEĞİTEK madde 16).
///
/// Neden: Identity hataları İngilizce döner ("Passwords must have at least one
/// digit."). Kullanıcıya Türkçe mesaj gösterilmesi proje kuralıdır ve
/// kurum kullanıcılarına daha anlaşılır gelir.
/// </summary>
public static class SifreKuraliMesaji
{
    private static readonly Dictionary<string, string> Kurallar = new()
    {
        ["PasswordTooShort"] = "Şifre en az 8 karakter olmalıdır.",
        ["PasswordRequiresUniqueChars"] = "Şifre en az 8 farklı karakter içermelidir.",
        ["PasswordRequiresDigit"] = "Şifre en az bir rakam (0-9) içermelidir.",
        ["PasswordRequiresLower"] = "Şifre en az bir küçük harf (a-z) içermelidir.",
        ["PasswordRequiresUpper"] = "Şifre en az bir büyük harf (A-Z) içermelidir.",
        ["PasswordRequiresNonAlphanumeric"] = "Şifre en az bir özel karakter (örn. ! ? @ # $) içermelidir.",
    };

    /// <summary>Identity hata listesini Türkçe, sıralı ve tek satırda döner.</summary>
    public static string Turkce(IdentityResult sonuc)
    {
        var bilinen = new List<string>();
        var bilinmeyen = new List<string>();

        foreach (var hata in sonuc.Errors)
        {
            var aciklama = Kurallar.TryGetValue(hata.Code, out var metin)
                ? metin
                : hata.Description;

            // Aynı mesajı tekrarlama (Identity bazen çoklu hata üretir).
            if (!bilinen.Contains(aciklama) && !bilinmeyen.Contains(aciklama))
            {
                if (Kurallar.ContainsKey(hata.Code)) bilinen.Add(aciklama);
                else bilinmeyen.Add(aciklama);
            }
        }

        var hepsi = bilinen.Concat(bilinmeyen).ToArray();
        return hepsi.Length == 0
            ? "Şifre kabul edilmedi."
            : string.Join(" ", hepsi);
    }

    /// <summary>Yalnızca şifre kurallarından kaynaklanan hatalar var mı?</summary>
    public static bool SadeceKuralHatasiMi(IdentityResult sonuc)
        => sonuc.Errors.All(h => Kurallar.ContainsKey(h.Code));
}
