namespace FikirPlatformu.Tests;

/// <summary>
/// Sprint 11.84 — Başlangıç (startup) yapılandırma denetimi.
///
/// <para><b>Neden bu test var:</b> Sprint 11.84'te <c>UseForwardedHeaders</c>
/// için yapılan DI kaydı <c>builder.Build()</c> satırından <b>sonra</b> kalmıştı.
/// Bu bir derleme hatası ÜRETMEZ — <c>dotnet build</c> ve <c>dotnet test</c> yeşil
/// kalır, kod doğru görünür. Hata yalnızca uygulama <b>çalışırken</b> ortaya çıkar:
///
/// <code>
/// Unhandled exception. System.InvalidOperationException: The service collection
/// cannot be modified because it is read-only.
/// </code>
///
/// Sonuç: Render deploy'u çöktü ve uygulama hiç açılmadı. "Derleniyor + testler
/// geçiyor" kontrolünün yetmediği canlı kanıtıdır.</para>
///
/// <para>Bu test, DI konteyneri dondurulduktan sonra kalan her
/// <c>builder.Services.*</c> çağrısını yakalar — aynı hatanın tekrarlamasını
/// engeller.</para>
/// </summary>
public class ProgramYapilandirmaDenetimi
{
    private static readonly string ProgramYolu = YoluBul("Program.cs");

    [Fact]
    public void Program_cs_bulunabildi()
    {
        Assert.True(File.Exists(ProgramYolu),
            $"Program.cs bulunamadı: {ProgramYolu}. Test dizini yanlış mı?");
    }

    /// <summary>
    /// <c>builder.Build()</c> çağrısından sonra DI konteyneri salt okunur olur.
    /// O satırdan sonra <c>builder.Services.*</c> çağrısı olmamalıdır.
    /// </summary>
    [Fact]
    public void Build_sonrasi_di_kaydi_yok()
    {
        var satirlar = File.ReadAllLines(ProgramYolu);

        var buildIndex = Array.FindIndex(satirlar, l =>
            l.Trim() == "var app = builder.Build();");

        Assert.True(buildIndex >= 0,
            "Program.cs içinde `var app = builder.Build();` bulunamadı. " +
            "Test güncellenmeli.");

        var ihlaller = new List<string>();
        for (var i = buildIndex + 1; i < satirlar.Length; i++)
        {
            var satir = satirlar[i].Trim();
            if (satir.StartsWith("//", StringComparison.Ordinal)) continue;
            if (satir.Contains("builder.Services.", StringComparison.Ordinal))
                ihlaller.Add($"satır {i + 1}: {satir}");
        }

        Assert.True(ihlaller.Count == 0,
            "`builder.Build()` sonrasında DI kaydı yapılamaz — uygulama açılışta " +
            "çöker (\"service collection cannot be modified because it is read-only\").\n"
            + "Bulunanlar:\n  " + string.Join("\n  ", ihlaller));
    }

    /// <summary>
    /// Güvenlik başlığı middleware'i tanım sonrasından önce gelmeli; aksi halde
    /// hiçbir başlık gönderilmez ve sessizce eksik kalır.
    /// </summary>
    [Fact]
    public void Guvenlik_basligi_middleware_diyarlardan_once()
    {
        var icerik = File.ReadAllText(ProgramYolu);

        var baslikIndex = icerik.IndexOf("Content-Security-Policy", StringComparison.Ordinal);
        Assert.True(baslikIndex >= 0, "Güvenlik başlığı middleware'i bulunamadı.");

        var corsIndex = icerik.IndexOf("UseCors(", StringComparison.Ordinal);
        Assert.True(corsIndex >= 0, "UseCors bulunamadı.");

        Assert.True(baslikIndex < corsIndex,
            "Güvenlik başlığı middleware'i UseCors'tan SONRA olmamalı — " +
            "OPTIONS önleyici yanıtlarında ve hata yanıtlarında başlıklar eksik kalır.");
    }

    /// <summary>
    /// HSTS üretimde koşulsuz gönderilir. <c>IsHttps</c> koşulu geri
    /// getirilirse ters proxy arkasında başlık hiç gitmez (canlı ölçüm: 11.84).
    /// </summary>
    [Fact]
    public void Hsts_IsHttps_kosuluna_bagli_degil()
    {
        var icerik = File.ReadAllText(ProgramYolu);

        Assert.Contains("\"Strict-Transport-Security\"", icerik, StringComparison.Ordinal);

        var kosullu = System.Text.RegularExpressions.Regex.IsMatch(
            icerik,
            @"if\s*\(\s*hstsAktif\s*&&\s*ctx\.Request\.IsHttps\s*\)",
            System.Text.RegularExpressions.RegexOptions.None,
            TimeSpan.FromSeconds(2));

        Assert.False(kosullu,
            "HSTS `ctx.Request.IsHttps` koşuluna bağlanmamalı. Ters proxy TLS'i " +
            "sonlandırdığında uygulama isteği HTTP görür ve başlık hiç gönderilmez. " +
            "RFC 6797 §8.1: HTTP üzerinden gelen HSTS tarayıcı tarafından yok sayılır, " +
            "bu yüzden koşul gerekmez ve zararsızdır.");
    }

    private static string YoluBul(string dosyaAdi)
    {
        var dizin = new DirectoryInfo(AppContext.BaseDirectory);
        while (dizin is not null)
        {
            var aday = Path.Combine(dizin.FullName, "src", "FikirPlatformu.Api", dosyaAdi);
            if (File.Exists(aday)) return aday;

            // backend/tests/... → backend/ → repo kökü
            var kok = Path.Combine(dizin.FullName, "backend", "src", "FikirPlatformu.Api", dosyaAdi);
            if (File.Exists(kok)) return kok;

            dizin = dizin.Parent;
        }
        throw new FileNotFoundException(
            $"{dosyaAdi} bulunamadı. AppContext.BaseDirectory: {AppContext.BaseDirectory}");
    }
}
