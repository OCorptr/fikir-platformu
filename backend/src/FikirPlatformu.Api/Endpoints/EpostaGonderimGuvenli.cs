using FikirPlatformu.Application.Abstractions;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// E-posta gönderimini try/catch ile sarar.
///
/// Sprint 11.92 — KÖK NEDEN DÜZELTMESİ.
/// <c>IEmailSender.SendAsync</c> çağrıları (MFA OTP, MFA kurulum, kayıt doğrulama,
/// şifre sıfırlama) try/catch içinde değildi. Gmail gönderimi başarısız olduğunda
/// <c>InvalidOperationException</c> / <c>TimeoutException</c> endpoint'ten kaçıyor,
/// global hata yöneticisi <c>GuvenliHataYonetici</c> devreye giriyor ve kullanıcı
/// "İşlem sırasında beklenmeyen bir hata oluştu." genel mesajını görüyordu.
///
/// Yan etki: <c>auth_events</c>'e başarısızlık kaydı da yazılmıyordu — yani
/// "kim ne zaman OTP isteyip alamadı" izi yoktu.
///
/// Bu yardımcı:
///   1. Gönderim hatasını yakalar.
///   2. Sunucu loguna istisna + bağlam + alıcı yazar (teşhis için).
///   3. İstemciye YALNIZCA anlamlı Türkçe mesaj + makine okunur <c>errorCode</c>
///      döner. İstisna metni ASLA sızmaz (YEĞİTEK madde 41).
///   4. Başarılıysa <c>null</c> döner; çağıran akış normal şekilde devam eder.
///
/// Dönüş: başarıda <c>null</c>, başarısızlıkta <c>502 Bad Gateway</c> ProblemDetails.
/// 502 seçildi çünkü hata uygulamanın kendisinde değil, dış bağımlılıkta
/// (Google OAuth2 / Gmail API). Frontend <c>buildMessage()</c> sırası
/// message → errors → detail → title olduğu için <c>detail</c> okunur.
/// </summary>
internal static class EpostaGonderimGuvenli
{
    /// <summary>İstemciye gösterilecek genel mesaj (tek cümle, istisna detayı YOK).</summary>
    private const string KullaniciMesaji =
        "Doğrulama kodu gönderilemedi. E-posta hizmeti şu anda yanıt vermiyor. " +
        "Lütfen biraz sonra tekrar deneyin; sorun devam ederse sistem yöneticinize bildirin.";

    /// <summary>
    /// Maili gönderir. Başarılıysa <c>null</c>, başarısızsa hata <c>IResult</c>'i döner.
    /// Çağıran: <c>var h = await EpostaGonderimGuvenli.Gonder(...); if (h is not null) return h;</c>
    /// </summary>
    public static async Task<IResult?> Gonder(
        IEmailSender gonderici,
        EmailMessage mesaj,
        string baglam,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var log = loggerFactory.CreateLogger("FikirPlatformu.Mail");
        try
        {
            await gonderici.SendAsync(mesaj, cancellationToken);
            return null;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // İstemci sekmeyi kapattı / istek iptal edildi — sunucu hatası DEĞİL.
            // Yeniden fırlatma: kullanıcı zaten gitmiş, log şişmesin.
            log.LogInformation("[MAIL] Gönderim istemci tarafından iptal edildi — baglam={Baglam}", baglam);
            // 499 = Client Closed Request (nginx de kullanır). StatusCodes sabitinde
            // karşılığı olmadığı için literal yazıldı.
            return Results.Problem(
                detail: "İstek iptal edildi.",
                statusCode: 499,
                title: "İstek tamamlanmadı");
        }
        catch (Exception ex)
        {
            // Teşhis bilgisi SADECE sunucu logunda. Göndericinin kendi [GMAIL] satırları
            // (eksik SenderAddress / refresh token yok / token reddedildi) buraya da
            // istisna mesajıyla düşer — Render logunda [MAIL] etiketiyle aranacak.
            log.LogError(ex, "[MAIL] Gönderim başarısız — baglam={Baglam}, alici={Alici}, tip={Tip}",
                baglam, mesaj.Recipient, ex.GetType().Name);

            return Results.Problem(
                detail: KullaniciMesaji,
                statusCode: StatusCodes.Status502BadGateway,
                title: "E-posta gönderilemedi",
                type: "https://fikir.meb.gov.tr/errors/mail-gonderilemedi",
                extensions: new Dictionary<string, object?>
                {
                    // Makine okunur hata kodu — frontend loglarında/raporlarda ayırt etmek için.
                    // İstisna metni DEĞİL, sadece sabit kod.
                    ["errorCode"] = "MAIL_SEND_FAILED",
                    ["baglam"] = baglam,
                });
        }
    }
}