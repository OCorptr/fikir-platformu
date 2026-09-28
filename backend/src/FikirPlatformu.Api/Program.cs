using FikirPlatformu.Api;
using FikirPlatformu.Api.Endpoints;
using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Implementations;
using FikirPlatformu.Application.Ministry;
using FikirPlatformu.Application.Moderation;
using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Infrastructure.Email;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Moderation;
using FikirPlatformu.Infrastructure.Persistence;
using FikirPlatformu.Infrastructure.Time;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Minimal API: enum'ları string olarak serialize et (örn PeriodStatus "Open").
// Frontend TypeScript tarafında "Open" | "SelectionComplete" | "Archived" bekliyor.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddProblemDetails();
// DataAnnotations validation: DTO'lardaki [Required], [StringLength], [Range], [EmailAddress]
// otomatik uygulanır; başarısızda 400 + ValidationProblemDetails (plan §4.2).
builder.Services.AddValidation();

// Rate limiting (plan §5.1 — Sprint 5): Brute-force koruması.
// Login: 5 deneme / dakika (Identity lockout zaten var; bu ek savunma katmanı).
// Genel: 100 istek / dakika IP başına.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("login", httpContext =>
    {
        // Login endpoint'inde IP başına 5 deneme / dakika (plan §2.2 ile uyumlu).
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            AutoReplenishment = true
        });
    });

    // Genel IP-bazlı sınır (tüm endpoint'ler).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 100,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            AutoReplenishment = true
        });
    });
});

builder.Services.AddDbContext<FikirPlatformuDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("MySql")
        ?? throw new InvalidOperationException("MySql connection string eksik (appsettings.json veya user-secrets).");
    // TiDB Cloud MySQL 8 uyumlu. Pomelo 9 + EF Core 9 ile stabil.
    // SchemaBehavior.Ignore — EF Core'un "public" gibi MySQL olmayan schema referanslarını yok say
    // (Pomelo varsayılan olarak Throw eder; migration'larda explicit "public" yazıldığı için gerekli).
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString),
        my => my.SchemaBehavior(Pomelo.EntityFrameworkCore.MySql.Infrastructure.MySqlSchemaBehavior.Ignore)
               .EnableRetryOnFailure(maxRetryCount: 3));
});
builder.Services.AddScoped<IIdeaRepository, IdeaRepository>();
builder.Services.AddScoped<IIdeaReadReceiptRepository, IdeaReadReceiptRepository>();
builder.Services.AddScoped<IIdeaAssignmentRepository, IdeaAssignmentRepository>();
builder.Services.AddScoped<IIdeaEvaluationRepository, IdeaEvaluationRepository>();
builder.Services.AddScoped<IProvinceInboxQueryService, ProvinceInboxQueryService>();
builder.Services.AddScoped<AssignEvaluatorService>();
builder.Services.AddScoped<SubmitEvaluationService>();
builder.Services.AddScoped<ICandidatesQueryService, CandidatesQueryService>();
builder.Services.AddScoped<ApproveIdeaService>();
builder.Services.AddScoped<IPeriodRepository, PeriodRepository>();
builder.Services.AddScoped<PeriodService>();
builder.Services.AddScoped<IImplementationReportRepository, ImplementationReportRepository>();
builder.Services.AddScoped<SubmitImplementationReportService>();
builder.Services.AddScoped<IImplementationSummaryQueryService, ImplementationSummaryQueryService>();
builder.Services.AddScoped<IProfanityFilter, DatabaseProfanityFilter>();
builder.Services.AddScoped<SubmitIdeaService>();
// E-posta gönderici seçimi — 4 mod:
//   1) Mail__Type=gmail + Mail__Gmail__* config → GmailApiEmailSender (OAuth2 HTTPS 443)
//   2) Mail__Type=resend + Mail__Pass=API_KEY → ResendHttpEmailSender (HTTPS 443)
//   3) Mail__Host (veya SMTP_HOST) → SmtpEmailSender (SMTP 587 — Render free'de bloklu)
//   4) Hiçbiri yok → DevelopmentEmailSender (log'a düşer, demo için)
builder.Services.AddHttpClient<ResendHttpEmailSender>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("FikirPlatformu/1.0");
});
builder.Services.AddHttpClient<GmailApiEmailSender>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("FikirPlatformu/1.0");
});
builder.Services.Configure<GmailAyarlari>(builder.Configuration.GetSection("Mail:Gmail"));
builder.Services.AddScoped<IEmailSender>(sp =>
{
    var yeni = builder.Configuration.GetSection("Mail");
    var tip = (yeni["Type"] ?? "").ToLowerInvariant();

    // Mod 1: Gmail API OAuth2 (gerçek Gmail'den gönderim — Onur tercihi)
    if (tip == GmailApiEmailSender.SaglayiciTipi)
    {
        // RefreshToken env boş olsa bile GmailApiEmailSender oluştur —
        // DB'deki encrypted refresh token (gmail_refresh_tokens Id=1) SendAsync'te
        // çözülür. Eski kod boş token'da Mod 4'e düşüyordu; bu bug yüzden
        // OAuth handshake sonrası tekrar handshake isteniyordu (token DB'de
        // çözülemiyor, çünkü sender Development'a düşüyordu).
        var gmailAyarlar = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<GmailAyarlari>>().Value;
        return ActivatorUtilities.CreateInstance<GmailApiEmailSender>(sp,
            Microsoft.Extensions.Options.Options.Create(gmailAyarlar));
    }

    // Mod 2: Resend HTTPS
    var pass = yeni["Pass"] ?? builder.Configuration["SMTP_PASS"];
    if (tip == ResendHttpEmailSender.SaglayiciTipi && !string.IsNullOrWhiteSpace(pass))
    {
        var ayarlar = Microsoft.Extensions.Options.Options.Create(new MailAyarlari
        {
            Host = null,
            Pass = pass,
            From = yeni["From"] ?? builder.Configuration["EMAIL_FROM"],
            FromName = yeni["FromName"] ?? "Geleceğin Fikri",
        });
        return ActivatorUtilities.CreateInstance<ResendHttpEmailSender>(sp, ayarlar);
    }

    // Mod 3: SMTP (Render free'de port bloklu, fallback olarak duruyor)
    var host = yeni["Host"] ?? builder.Configuration["SMTP_HOST"];
    if (!string.IsNullOrWhiteSpace(host))
    {
        var user = yeni["User"] ?? builder.Configuration["SMTP_USER"];
        var portStr = yeni["Port"] ?? builder.Configuration["SMTP_PORT"];
        var from = yeni["From"] ?? builder.Configuration["EMAIL_FROM"];
        var mailOpts = Microsoft.Extensions.Options.Options.Create(new MailAyarlari
        {
            Host = host,
            Port = int.TryParse(portStr, out var p) ? p : 587,
            UseStartTls = !string.Equals(yeni["UseStartTls"], "false", StringComparison.OrdinalIgnoreCase),
            User = user,
            Pass = pass,
            From = from ?? user,
            FromName = yeni["FromName"] ?? "Geleceğin Fikri",
        });
        return ActivatorUtilities.CreateInstance<SmtpEmailSender>(sp, mailOpts);
    }

    // Mod 4: Development fallback
    return ActivatorUtilities.CreateInstance<DevelopmentEmailSender>(sp);
});
// Background job: auth_events 2 yıl retention (plan §1.7).
builder.Services.AddHostedService<FikirPlatformu.Api.ArkaPlan.AuthEventRetentionService>();
// Sprint 11.32: KVKK öğrenci kayıt temizleme — yeniden aktif, try-catch ile
// ana servisi crash ettirmez. EF Core snapshot invalid riski için DB sorguları
// startup'ta denenmez, sadece periyodik döngüde çalışır.
builder.Services.AddHostedService<FikirPlatformu.Api.ArkaPlan.EskiOgrenciKayitTemizlemeService>();
// Sprint 11.29: Pasif hesap kilitleme kaldırıldı.
// Sprint 11.53: GERİ AÇILDI — YEĞİTEK güvenlik gereksinimi madde 39
// ("kullanılmayan hesaplar raporlanır ve pasife alınır") zorunlu kılıyor.
// Servis artık: hareketsiz hesabı kilitler + AuthEvent kaydı yazar (rapor).
// Ayrıcalıklı roller muaf tutulur ve `PasifHesap_Enabled=false` ile kapatılabilir.
builder.Services.AddHostedService<FikirPlatformu.Api.ArkaPlan.PasifHesapTespitService>();

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        // Sign-in: e-posta doğrulama zorunlu (plan §2.5).
        options.SignIn.RequireConfirmedAccount = true;
        options.User.RequireUniqueEmail = true;

        // Password policy — YEĞİTEK güvenlik gereksinimi (madde 16):
        // "Parolalar en az 8 karakter (büyük/küçük harf, rakam, özel karakter) içerir."
        //
        // Sprint 11.53: rakam ve özel karakter ZORUNLU yapıldı. Önceden
        // (Sprint 10.7) kurum uyum şifreleri gerekçesiyle kapalıydı; bu madde
        // ile çelişiyordu. Artık dört koşulun dördü de zorunludur.
        options.Password.RequiredLength = 8;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireDigit = true;
        options.Password.RequireNonAlphanumeric = true;

        // Sprint 11.7'de eklenen `BypassPasswordValidator` Identity'nin default
        // şifre doğrulayıcısını baypas etmeyi amaçlıyordu, ancak işe yaramıyordu:
        // `AddPasswordValidator` kaydı `TryAdd` değil `Add` kullanır ve
        // `AddIdentityCore` varsayılan doğrulayıcıyı zaten `TryAddEnumerable` ile
        // kaydetmiştir. UserManager TÜM doğrulayıcıları çalıştırdığı için default
        // doğrulayıcı her zaman aktifti — yani kod her zaman zaten kuralları
        // uyguluyordu. Sprint 11.53'te kaldırıldı (ölü kod).
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<FikirPlatformuDbContext>()
    .AddSignInManager<SignInManager<ApplicationUser>>()
    .AddDefaultTokenProviders();

// Sprint 11.55 — GÜVENLİK YAMASI.
// `AddIdentityCore` `SecurityStampValidator`'ı kaydetmez; bunu yapan `AddIdentity`'dir.
// Kayıt edilmediği için şifre değiştiğinde AÇIK OLAN OTURUMLAR geçersiz
// kalmıyordu: kullanıcı şifresini değiştirdikten sonra hâlâ giriş yapmış
// görünüyor ve eski oturumla sistemde gezebiliyordu (kullanıcı raporundan).
// `ValidationInterval` cookie her istekte kontrol edilir; 5 dakika dengeli bir
// değerdir (çok kısa = her istekte veritabanına gider, çok uzun = eski
// oturumlar dakikalarca açık kalır).
builder.Services.Configure<SecurityStampValidatorOptions>(options =>
    options.ValidationInterval = TimeSpan.FromMinutes(5));

// Cookie güvenlik ayarları (plan §3.1 + §3.2 — Sprint 3):
//   - HttpOnly: JS erişemez (XSS koruması)
//   - SameSite: Cors:AllowedOrigins DOLUYSA → None (cross-origin); BOŞSA → Lax (same-origin reverse proxy)
//   - SecurePolicy: Development=SameAsRequest (HTTP test); Production=Always (HTTPS zorunlu)
//   - ExpireTimeSpan=30 dk: idle timeout (plan §3.2)
//   - Absolute timeout=8 saat: ASP.NET Core cookie auth'da yok; OnValidatePrincipal + IssueDate ile manuel uygulanır.
var isProduction = builder.Environment.IsProduction();
var securePolicy = isProduction ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
// CORS beyaz listesi + cookie SameSite kararı.
//   - Liste DOLU  → cross-origin: CORS middleware açılır, cookie'ler SameSite=None (Secure zorunlu).
//   - Liste BOŞ   → same-origin (nginx reverse proxy veya aynı domain): CORS kurulmaz, SameSite=Lax.
// Sprint 11.52: Üretimdeki gömülü Render fallback kaldırıldı; artık `Cors__AllowedOrigins`
//   açıkça verilmezse same-origin moduna düşer. Render dağıtımı için
//   `Cors__AllowedOrigins` veya `Cors__AllowRenderFallback=true` ayarlanmalıdır.
var corsOrigins = BakimCORS.AktifOriginler(builder.Configuration, builder.Environment);
var sameSite = corsOrigins.Length > 0 ? SameSiteMode.None : SameSiteMode.Lax;

// Mutlak oturum süresi: kullanıcının cookie yazıldıktan sonra en fazla açık kalabileceği süre.
// Cookie + DB'de saklanan ilk giriş zamanı (ApplicationUser.PasswordChangedAt benzeri tek bir "session start" alanı) ile kontrol edilebilir;
// ancak IdentityUser'da mevcut alan yok. Bu yüzden claim'e yazıp OnValidatePrincipal'de kontrol ediyoruz.
var absoluteTimeout = TimeSpan.FromHours(8);

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    // Öğrenci: Identity'nin default scheme'i (Identity.Application).
    .AddCookie(IdentityConstants.ApplicationScheme, options =>
    {
        options.Cookie.Name = ".FikirStudent.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = sameSite;
        options.Cookie.SecurePolicy = securePolicy;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
        // Absolute timeout: cookie IssueDate'i claim olarak yazıldıktan 8 saat sonra oturum düşürülür.
        options.Events.OnSigningIn = ctx =>
        {
            var issuedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            ctx.Principal!.Identities.First().AddClaim(new System.Security.Claims.Claim("auth_issued_at", issuedAt));
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = ctx =>
        {
            var issuedAtClaim = ctx.Principal?.FindFirst("auth_issued_at")?.Value;
            if (long.TryParse(issuedAtClaim, out var issuedAt))
            {
                var age = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(issuedAt);
                if (age > absoluteTimeout)
                {
                    ctx.RejectPrincipal(); // 401 — kullanıcı tekrar login olmalı
                }
            }
            return Task.CompletedTask;
        };
    })
    // İl AR-GE personeli: ayrı cookie — aynı tarayıcıda bakanlık hesabı açıkken
    // il-panel'e girildiğinde çakışmayı önler (plan §49).
    .AddCookie("ProvinceScheme", options =>
    {
        options.Cookie.Name = ".FikirProvince.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = sameSite;
        options.Cookie.SecurePolicy = securePolicy;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
        options.Events.OnSigningIn = ctx =>
        {
            var issuedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            ctx.Principal!.Identities.First().AddClaim(new System.Security.Claims.Claim("auth_issued_at", issuedAt));
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = ctx =>
        {
            var issuedAtClaim = ctx.Principal?.FindFirst("auth_issued_at")?.Value;
            if (long.TryParse(issuedAtClaim, out var issuedAt))
            {
                var age = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(issuedAt);
                if (age > absoluteTimeout)
                {
                    ctx.RejectPrincipal();
                }
            }
            return Task.CompletedTask;
        };
    })
    // Bakanlık: ayrı cookie.
    .AddCookie("MinistryScheme", options =>
    {
        options.Cookie.Name = ".FikirMinistry.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = sameSite;
        options.Cookie.SecurePolicy = securePolicy;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
        options.Events.OnSigningIn = ctx =>
        {
            var issuedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
            ctx.Principal!.Identities.First().AddClaim(new System.Security.Claims.Claim("auth_issued_at", issuedAt));
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = ctx =>
        {
            var issuedAtClaim = ctx.Principal?.FindFirst("auth_issued_at")?.Value;
            if (long.TryParse(issuedAtClaim, out var issuedAt))
            {
                var age = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(issuedAt);
                if (age > absoluteTimeout)
                {
                    ctx.RejectPrincipal();
                }
            }
            return Task.CompletedTask;
        };
    })
    // Pre-MFA scheme (Sprint 9): MFA setup/verify bekleyen kullanıcı için kısa süreli cookie.
    // Şifre doğrulandı ama MFA tamamlanmadı → 10dk cookie yazılır, MFA endpoint'lerine erişim.
    // MFA tamamlanınca normal scheme'e upgrade edilir (SignOut + SignIn).
    .AddCookie("PreMfaScheme", options =>
    {
        options.Cookie.Name = ".FikirPreMfa.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = sameSite;
        options.Cookie.SecurePolicy = securePolicy;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
        options.SlidingExpiration = false;
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    });

builder.Services.AddAuthorization(options =>
{
    // Her policy kendi cookie scheme'i ile authenticate olur + rol kontrolü yapar.
    options.AddPolicy("StudentOnly", p => p
        .AddAuthenticationSchemes(IdentityConstants.ApplicationScheme)
        .RequireAssertion(ctx => ctx.User.IsInRole("Student")));

    options.AddPolicy("ProvinceOnly", p => p
        .AddAuthenticationSchemes("ProvinceScheme")
        .RequireAssertion(ctx => ctx.User.IsInRole("ProvinceManager") || ctx.User.IsInRole("ProvinceEvaluator")));

    options.AddPolicy("MinistryOnly", p => p
        .AddAuthenticationSchemes("MinistryScheme")
        .RequireAssertion(ctx => ctx.User.IsInRole("MinistryOfficial")));

    // Pre-MFA scheme: MFA setup veya MFA verify bekleyen kullanıcı (Sprint 9).
    // Şifre doğrulandı ama MFA tamamlanmadı → kısa süreli cookie yazılır,
    // MFA endpoint'lerine erişim verilir. Verify başarılı olunca normal scheme'e upgrade.
    options.AddPolicy("PreMfaOnly", p => p
        .AddAuthenticationSchemes("PreMfaScheme")
        .RequireAuthenticatedUser());

    // MFA doğrulanmış kullanıcı — herhangi bir normal scheme.
    options.AddPolicy("MfaCompleted", p => p
        .AddAuthenticationSchemes(IdentityConstants.ApplicationScheme, "ProvinceScheme", "MinistryScheme")
        .RequireAuthenticatedUser());

    // SystemAdmin only — MFA doğrulanmış + SystemAdmin rolü (Sprint 9 admin endpoint'leri).
    options.AddPolicy("SystemAdminOnly", p => p
        .AddAuthenticationSchemes(IdentityConstants.ApplicationScheme, "ProvinceScheme", "MinistryScheme")
        .RequireAssertion(ctx => ctx.User.IsInRole("SystemAdmin")));
});

// Data Protection API: TOTP secret gibi hassas alanları DB'de şifreli saklamak için
// (plan §6.4 + YEĞİTEK gereksinim #8). Anahtarlar aynı DB'de data_protection_keys
// tablosunda saklanır — container yeniden başladığında şifre çözme devam eder.
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext>()
    .SetApplicationName("FikirPlatformu");

// Hassas alan şifreleme servisi (TOTP secret, vs.).
builder.Services.AddSingleton<FikirPlatformu.Infrastructure.Security.HassasVeriSifreleme>();
builder.Services.AddSingleton<FikirPlatformu.Api.Endpoints.EmailOtpStore>();

// CORS whitelist (plan §3.5 — Sprint 3):
// Cors:AllowedOrigins BOŞSA → CORS middleware hiç aktif olmaz (same-origin reverse proxy).
// Cors:AllowedOrigins DOLUYSA → sadece bu origin'lere izin (cross-origin deployment).
const string FrontendCorsPolicy = "FrontendCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        if (corsOrigins.Length > 0)
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials(); // cookie tabanlı auth zorunlu
        }
        // corsOrigins boşsa policy boş kalır — UseCors aşağıda hiç çağrılmaz
        // (same-origin reverse proxy durumu için CORS gerekmiyor).
    });
});

// Sprint 11.52 (YEĞİTEK madde 2): Kapça güvenlik testi sırasında kapatılabilir.
// Ortam değişkeni: Captcha__Disabled=true  (varsayılan: açık)
CaptchaEndpoints.Ayarla(builder.Configuration.GetValue("Captcha:Disabled", false));

var app = builder.Build();

// EF Core migration'ları otomatik uygula (Sprint 10 — yoksa deployment'ta yeni
// kolonlar (örn. TwoFactorMethod) uygulanmaz, runtime'da hata verir).
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext>();
    dbContext.Database.Migrate();

    // Sprint 10.7+++ Gmail OAuth refresh token için singleton tablo oluştur.
    // EF Core migration dosyaları bu makinede sandbox'tan oluşturulamıyor
    // (dosya yazma engellenmiş); bunun yerine idempotent raw SQL — startup'ta
    // her açılışta no-op. Snapshot sürüm uyumsuzluğu migration mekanizmasını
    // devre dışı bırakırsa bile schema doğru kalır.
    try
    {
        dbContext.Database.ExecuteSqlRaw(
            "CREATE TABLE IF NOT EXISTS `gmail_refresh_tokens` (" +
            "`Id` INT NOT NULL," +
            "`EncryptedRefreshToken` TEXT NOT NULL," +
            "`UpdatedAt` DATETIME(6) NOT NULL," +
            "PRIMARY KEY (`Id`)" +
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "[STARTUP] gmail_refresh_tokens tablosu oluşturulamadı.");
    }

    // Sprint 11.53: `auth_events.Reason` kolonu — YEĞİTEK madde 39 için
    // "kullanılmayan hesap pasife alındı / yeniden etkinleştirildi" kayıtlarında
    // gerekçe tutulur. EF migration bu ortamda üretilemediği için (sandbox
    // dosya yazma engeli) idempotent raw SQL ile eklenir; her açılışta no-op.
    try
    {
        dbContext.Database.ExecuteSqlRaw(
            "ALTER TABLE `auth_events` ADD COLUMN IF NOT EXISTS `Reason` VARCHAR(255) NULL");
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "[STARTUP] auth_events.Reason kolonu oluşturulamadı.");
    }

    // Sprint 11.60 / YG-17: PasswordChangedAt başlangıç değerlemesi.
    // Eski kayıtlarda bu alan NULL'dır. NULL, "ne zaman değiştirildiği
    // bilinmiyor" demektir ve politikada en kötü senaryo (zorunlu değişim)
    // olarak yorumlanır. Kullanıcıları kilitlememek için son giriş tarihine,
    // o da yoksa bugüne geriye dönük bir taban değer yazılır.
    try
    {
        var etkilenen = dbContext.Database.ExecuteSqlRaw(
            """
            UPDATE `AspNetUsers`
            SET `PasswordChangedAt` = COALESCE(`LastLoginAt`, UTC_TIMESTAMP())
            WHERE `PasswordChangedAt` IS NULL
            """);
        if (etkilenen > 0)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogWarning(
                "[STARTUP] {Sayi} hesaba PasswordChangedAt taban değeri yazıldı (YG-17).",
                etkilenen);
        }
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "[STARTUP] PasswordChangedAt taban değerlemesi yapılamadı.");
    }
}

// Sprint 11.52: Kurulum seed komutu — `dotnet run -- seed` ile ilk hesapları oluşturur.
// Eski `seed/ilk_hesaplar.py` canlı DB kimlik bilgisi içeriyordu ve geliştiricinin
// production DB'sindeki bir satıra bağımlıydı; artık Python'a gerek yok.
// Hedef veritabanı boş değilse hiçbir şey yazılmaz (fail-closed).
if (KurulumSeedAraci.CalistirilacakMi(args))
{
    var seedLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("KurulumSeed");
    await KurulumSeedAraci.CalistirAsync(app.Services, builder.Configuration, seedLogger);
    return;
}

// Güvenlik header'ları (Sprint 5 — ek savunma katmanı).
// X-Content-Type-Options: MIME sniffing engeli
// X-Frame-Options: clickjacking koruması
// Referrer-Policy: referrer bilgisi sızıntısı azaltma
// Permissions-Policy: gereksiz tarayıcı özelliklerini kapatma
// Content-Security-Policy + Strict-Transport-Security: Sprint 11.52 (YG-07, YEĞİTEK maddeleri)
//
// HSTS yalnızca HTTPS üzerinden gönderilir; HTTP'de tarayıcı bunu yok sayar.
var hstsAktif = builder.Environment.IsProduction();
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()";

    // Sprint 11.52: Content-Security-Policy. React derlemesi 'unsafe-inline' stil
    // ve 'unsafe-eval' gerektirir; kaynak yalnızca kendi origin'ine (connect-src dahil)
    // ve Gmail/Resend API'lerine açıktır. Başka origin'e script yüklenemez.
    h["Content-Security-Policy"] = builder.Configuration["Security:ContentSecurityPolicy"]
        ?? "default-src 'self'; " +
           "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
           "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
           "font-src 'self' data: https://fonts.gstatic.com; " +
           "img-src 'self' data: blob:; " +
           "connect-src 'self' https://www.googleapis.com https://gmail.googleapis.com https://api.resend.com; " +
           "frame-ancestors 'none'; " +
           "base-uri 'self'; " +
           "form-action 'self'";

    if (hstsAktif && ctx.Request.IsHttps)
    {
        h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }

    await next();
});

// Güvenli global hata yönetici — PII sızıntısı yok (YEĞİTEK gereksinim #41).
FikirPlatformu.Api.Middleware.GuvenliHataYonetici.Kullan(app);

app.UseStatusCodePages(async context =>
{
    // UseStatusCodePages handler'ı fallback ProblemDetails üretir. Burada kısa Türkçe mesaj yazıyoruz.
    var ctx2 = context.HttpContext;
    ctx2.Response.ContentType = "application/problem+json";
    if (ctx2.Response.StatusCode == StatusCodes.Status404NotFound)
    {
        await ctx2.Response.WriteAsJsonAsync(new
        {
            type = "https://tools.ietf.org/html/rfc9110#section-15.5.5",
            title = "Sayfa bulunamadı",
            status = StatusCodes.Status404NotFound,
            detail = "Aradığınız sayfa veya kayıt bulunamadı."
        });
    }
    else if (ctx2.Response.StatusCode == StatusCodes.Status405MethodNotAllowed)
    {
        await ctx2.Response.WriteAsJsonAsync(new
        {
            type = "https://tools.ietf.org/html/rfc9110#section-15.5.6",
            title = "İstek yöntemi desteklenmiyor",
            status = StatusCodes.Status405MethodNotAllowed,
            detail = "Bu endpoint bu HTTP yöntemini desteklemiyor."
        });
    }
});
app.UseRateLimiter();

// Sprint 11.28: UseCors EN BASTA olmali — Microsoft Learn:
/// UseCors must be called after UseRouting but before UseAuthorization,
/// but the implicit UseRouting in minimal API may not be active yet.
/// Tüm middleware'lerden once cagirmak en guvenli yol.
// Sprint 11.52: Liste boşsa (same-origin mod) CORS middleware hiç kurulmaz.
if (corsOrigins.Length > 0)
{
    app.UseCors(FrontendCorsPolicy);
}

// Sprint 11.28: CORS preflight OPTIONS request'leri 204 ile kısa devre yapsın
// — UseStatusCodePages middleware'i 404 fallback'i bu istekleri yakalıyor.
// UseCors'tan SONRA olmalı ki CORS header'ları (Allow-Origin, Allow-Methods,
// Allow-Credentials) cevaba eklenmiş olsun.
app.Use(async (ctx, next) =>
{
    if (HttpMethods.IsOptions(ctx.Request.Method) && ctx.Request.Headers.ContainsKey("Origin"))
    {
        ctx.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }
    await next();
});

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/__debug/cors-config", (
    HttpContext http,
    IConfiguration cfg) =>
{
    // Sprint 11.52: Gömülü varsayılan anahtar kaldırıldı — `AdminMaintenance__Secret`
    // tanımlı değilse bu debug endpoint kapalıdır (fail-closed).
    if (!BakimGizliAnahtar.Gecerli(http, cfg))
    {
        return Results.Json(new { message = "Geçersiz veya eksik token." }, statusCode: 401);
    }
    var corsSection = cfg.GetSection("Cors:AllowedOrigins").Get<string[]>();
    return Results.Ok(new
    {
        corsSectionLength = corsSection?.Length ?? 0,
        corsSectionValues = corsSection ?? Array.Empty<string>(),
        envHasKey = cfg.GetSection("Cors:AllowedOrigins").Exists(),
        // Sprint 11.52: Gerçek CORS whitelist'i (env boşsa hardcoded fallback dahil) göster.
        aktifCorsOrigins = BakimCORS.AktifOriginler(cfg, app.Environment),
    });
});

app.MapGet("/api/health", (IClock clock) => Results.Ok(new
{
    status = "healthy",
    application = "Geleceğin Fikri API",
    utcTime = clock.UtcNow
}));

app.MapGet("/api/health/db", async (FikirPlatformuDbContext db, CancellationToken cancellationToken) =>
{
    var connected = await db.Database.CanConnectAsync(cancellationToken);
    // Sprint 11.52: Bu uç PostgreSQL diyordu ama uygulama Pomelo MySQL / TiDB kullanıyor.
    var motor = db.Database.ProviderName ?? "bilinmiyor";
    return connected
        ? Results.Ok(new { status = "connected", database = "MySQL/TiDB", provider = motor })
        : Results.StatusCode(503);
});

app.MapAuthEndpoints();
app.MapMfaEndpoints();
app.MapCaptchaEndpoints();
app.MapAdminEndpoints();
app.MapProfileEndpoints();
app.MapReferenceEndpoints();
app.MapStudentIdeaEndpoints();
app.MapProvinceEndpoints();
app.MapMinistryEndpoints();

// Bakım endpoint'i — sistem yöneticisi hesabını oluşturur/sıfırlar.
// Hesap bilgileri `SeedSystemAdmin__Email` / `SeedSystemAdmin__Password`
// ortam değişkenlerinden okunur; hiçbiri kodda gömülü değildir (Sprint 11.52).
//
// Güvenlik: `AdminMaintenance__Secret` tanımlı değilse endpoint 403 döner (fail-closed).
// Sprint 12'de admin panelinden SystemAdmin yönetimi yapılınca bu kaldırılacak.
//
// Kullanım:
//   curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/admin-reset?token=SECRET"
// Sprint 11.33: Aşağıdaki tek MapPost kullanılır (duplicate kaldırıldı).
// Sprint 11.7 — anonymous maintenance endpoint.
// Sistem Admin hesabını oluşturma/sıfırlama için acil kurtarma.
// Production'da `AdminMaintenance__Secret` env değişkeni set edilmelidir; aksi halde
// hardcoded fallback kullanılır (sadece bilinen taraf erişebilir).
// Sprint 12'de admin panelinden SystemAdmin yönetimi yapılacak, bu kaldırılacak.
//
// Kullanım:
//   curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/admin-reset?token=ENV_SECRET"
app.MapPost("/api/__maintenance/admin-reset", async (
    HttpContext http,
    IConfiguration yapilandirma,
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IPasswordHasher<ApplicationUser> passwordHasher,
    FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext veritabani,
    ILogger<Program> logger) =>
{
    // Sprint 11.52: Kod içine gömülü varsayılan anahtar kaldırıldı.
    // `AdminMaintenance__Secret` tanımlı değilse endpoint fail-closed (403) kalır.
    if (!BakimGizliAnahtar.Gecerli(http, yapilandirma))
    {
        return Results.Json(new { message = "Yetkisiz. Token yanlış veya eksik." }, statusCode: 403);
    }

    // Sprint 11.52: Gömülü e-posta + şifre kaldırıldı. Artık `SeedSystemAdmin__Email`
    // ve `SeedSystemAdmin__Password` ortam değişkenlerinden okunur. Tanımlı değilse
    // endpoint 503 döner (fail-closed) — teslim edilen kodda bilinen kimlik yok.
    var hedefEposta = yapilandirma["SeedSystemAdmin:Email"];
    var hedefSifre = yapilandirma["SeedSystemAdmin:Password"];
    if (string.IsNullOrWhiteSpace(hedefEposta) || string.IsNullOrWhiteSpace(hedefSifre))
    {
        logger.LogError("[MAINT] SeedSystemAdmin__Email / SeedSystemAdmin__Password tanımlı değil — admin oluşturulamadı.");
        return Results.Json(
            new { message = "Sunucu yapılandırması eksik: SeedSystemAdmin__Email ve SeedSystemAdmin__Password gerekli." },
            statusCode: 503);
    }

    var mevcut = await userManager.FindByEmailAsync(hedefEposta);
    if (mevcut is not null)
    {
        logger.LogInformation("[MAINT] Mevcut Sistem Admin siliniyor: {Email}", hedefEposta);
        var silSonuc = await userManager.DeleteAsync(mevcut);
        if (!silSonuc.Succeeded)
        {
            logger.LogError("[MAINT] silme başarısız: {Errors}",
                string.Join(",", silSonuc.Errors.Select(e => e.Description)));
            return Results.Json(new { message = "Silme başarısız." }, statusCode: 500);
        }
    }

    var sistemAdmin = new ApplicationUser
    {
        UserName = hedefEposta,
        Email = hedefEposta,
        FirstName = "Sistem",
        LastName = "Yöneticisi",
        EmailConfirmed = true,
    };
    // Sprint 11.7 bugfix3 — Identity 9 PasswordValidator pipeline tüm Identity
    // validators uyguluyor. Önceki CreateAsync BAŞARILI görünüyor ama login fail —
    // demek ki validator Identity hatasız rapor etse bile PasswordHash boş bırakılmış
    // olabilir (validator bypass). Kesin fix: Identity'nin kendi IPasswordHasher'ı ile
    // direkt hash'leyip PasswordHash alanını set etmek.
    var olusturma = await userManager.CreateAsync(sistemAdmin, hedefSifre);
    if (olusturma.Succeeded && !string.IsNullOrEmpty(sistemAdmin.PasswordHash))
    {
        logger.LogInformation("[MAINT] Sistem Admin CreateAsync başarılı + PasswordHash set: {Email}", hedefEposta);
    }
    else
    {
        // CreateAsync başarısız VEYA PasswordHash boş → bypass.
        if (!string.IsNullOrEmpty(sistemAdmin.SecurityStamp))
        {
            // Identity framework user SQL INSERT yapmış ama validators reddetti.
            // user kayıtlı, ama PasswordHash yok. Direkt set edelim.
            sistemAdmin.PasswordHash = passwordHasher.HashPassword(sistemAdmin, hedefSifre);
            var updSonuc = await userManager.UpdateAsync(sistemAdmin);
            logger.LogWarning("[MAINT] CreateAsync validator başarısız; PasswordHash direkt set: success={S}", updSonuc.Succeeded);
        }
        else
        {
            // Identity INSERT dahi başarısız oldu (DB unique constraint veya başka).
            // Son çare: SQL raw insert.
            sistemAdmin.PasswordHash = passwordHasher.HashPassword(sistemAdmin, hedefSifre);
            veritabani.Users.Add(sistemAdmin);
            try
            {
                await veritabani.SaveChangesAsync();
                logger.LogInformation("[MAINT] raw EF Core INSERT başarılı: {Email}", hedefEposta);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[MAINT] raw INSERT exception");
                return Results.Json(new { message = "Identity CreateAsync ve raw INSERT başarısız." }, statusCode: 500);
            }
        }
    }

    if (!await roleManager.RoleExistsAsync("SystemAdmin"))
        await roleManager.CreateAsync(new IdentityRole("SystemAdmin"));
    if (!await roleManager.RoleExistsAsync("MinistryOfficial"))
        await roleManager.CreateAsync(new IdentityRole("MinistryOfficial"));
    if (!await userManager.IsInRoleAsync(sistemAdmin, "SystemAdmin"))
        await userManager.AddToRoleAsync(sistemAdmin, "SystemAdmin");
    if (!await userManager.IsInRoleAsync(sistemAdmin, "MinistryOfficial"))
        await userManager.AddToRoleAsync(sistemAdmin, "MinistryOfficial");

    logger.LogInformation("[MAINT] Sistem Admin başarıyla oluşturuldu: {Email}", hedefEposta);
    return Results.Ok(new
    {
        message = "Sistem Admin oluşturuldu.",
        email = hedefEposta,
        passwordHint = "Belirlediğiniz şifre ile giriş yapın. MFA setup sonra yapılır.",
    });
}).AllowAnonymous();

// Sprint 11.48: MustChangePassword flag kapat — Identity'nin "hesap açıldığında
// ilk girişte şifre değiştir" flag'i (MustChangePassword) bazı seed/admin hesaplarda
// true olarak kalıyor. Onur Admin Panel'de hesabında 'Şifre değişmeli' rozeti
// görüyordu — sebebi bu. Bu endpoint ile flag'i false yapılır.
// Kullanım: POST /api/__maintenance/clear-must-change-password?token=SECRET&email=X
app.MapPost("/api/__maintenance/clear-must-change-password", async (
    HttpContext http,
    IConfiguration yapilandirma,
    UserManager<ApplicationUser> userManager,
    FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext veritabani,
    ILogger<Program> logger) =>
{
    // Sprint 11.52: Kod içine gömülü varsayılan anahtar kaldırıldı.
    // `AdminMaintenance__Secret` tanımlı değilse endpoint fail-closed (403) kalır.
    if (!BakimGizliAnahtar.Gecerli(http, yapilandirma))
    {
        return Results.Json(new { message = "Yetkisiz. Token yanlış veya eksik." }, statusCode: 403);
    }

    var email = http.Request.Query["email"].ToString();
    if (string.IsNullOrWhiteSpace(email))
    {
        return Results.Json(new { message = "email query param gerekli." }, statusCode: 400);
    }

    var user = await userManager.FindByEmailAsync(email);
    if (user is null)
    {
        return Results.Json(new { message = $"Kullanıcı bulunamadı: {email}" }, statusCode: 404);
    }

    var oncekiDeger = user.MustChangePassword;
    user.MustChangePassword = false;

    // SecurityStamp yenile ki eski cookie/MFA invalidate olsun.
    await userManager.UpdateSecurityStampAsync(user);
    var updSonuc = await userManager.UpdateAsync(user);
    if (!updSonuc.Succeeded)
    {
        // Fallback: raw SQL.
        // Sprint 11.52: Tırnak içinde çift tırnak ("AspNetUsers") PostgreSQL tanımıydı.
        // MySQL/TiDB'de çift tırnak string literal sayılır → syntax error. Backtick'e çevrildi.
        var affected = await veritabani.Database.ExecuteSqlRawAsync(
            "UPDATE `AspNetUsers` SET `MustChangePassword` = 0, `SecurityStamp` = {0}, `ConcurrencyStamp` = {1} WHERE `Id` = {2}",
            Guid.NewGuid().ToString().Replace("-", "").ToUpperInvariant(),
            Guid.NewGuid().ToString(),
            user.Id);
        veritabani.ChangeTracker.Clear();
        var guncel = await veritabani.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
        logger.LogInformation("[MAINT-CLEAR-MCP] Raw SQL UPDATE: {Email} affected={A}, yeniDeger={D}",
            email, affected, guncel.MustChangePassword);
        return Results.Ok(new
        {
            message = "MustChangePassword kapatıldı (raw SQL fallback).",
            email,
            oncekiDeger,
            yeniDeger = guncel.MustChangePassword,
            affectedRows = affected,
        });
    }

    logger.LogInformation("[MAINT-CLEAR-MCP] {Email} MustChangePassword {Onceki} → false", email, oncekiDeger);
    return Results.Ok(new
    {
        message = "MustChangePassword kapatıldı.",
        email,
        oncekiDeger,
        yeniDeger = user.MustChangePassword,
    });
}).AllowAnonymous();

// Sprint 11.44: Raw SQL PasswordHash UPDATE — Identity UserManager.UpdateAsync
// bazen yazmiyor gibi gorunuyor (Onur 2 kez denedi, login yine yanlis-sifre).
// SQL raw UPDATE ile AspNetUsers.PasswordHash'i direk degistir. Verify edildikten
// sonra SecurityStamp da yenilenmez ki cookie/MFA cache'leri bozulmasin.
app.MapPost("/api/__maintenance/set-password-raw", async (
    HttpContext http,
    IConfiguration yapilandirma,
    IPasswordHasher<ApplicationUser> passwordHasher,
    FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext veritabani,
    ILogger<Program> logger) =>
{
    // Sprint 11.52: Kod içine gömülü varsayılan anahtar kaldırıldı.
    // `AdminMaintenance__Secret` tanımlı değilse endpoint fail-closed (403) kalır.
    if (!BakimGizliAnahtar.Gecerli(http, yapilandirma))
    {
        return Results.Json(new { message = "Yetkisiz. Token yanlış veya eksik." }, statusCode: 403);
    }

    var email = http.Request.Query["email"].ToString();
    var yeniSifre = http.Request.Query["password"].ToString();
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(yeniSifre))
    {
        return Results.Json(new { message = "email + password query param gerekli." }, statusCode: 400);
    }

    // User'ı bul — Identity UserManager yerine EF DbContext ile (bozuk PasswordHash
    // gözden geçirmeksizin). Identity zaten lazy-loading/security check yapmaz.
    var user = await veritabani.Users.FirstOrDefaultAsync(u => u.Email == email);
    if (user is null)
    {
        return Results.Json(new { message = $"Kullanıcı bulunamadı: {email}" }, statusCode: 404);
    }

    // Identity IPasswordHasher ile hash'le.
    var yeniHash = passwordHasher.HashPassword(user, yeniSifre);
    var eskiHash = user.PasswordHash;

    // SecurityStamp'i Identity UserManager'a dokunmadan SQL ile yenile (eski cookie
    // invalidate olsun). Sadece PasswordHash UPDATE'i etkisi yeterli olabilir ama
    // SecurityStamp de guncelleyelim ki ValidateUser login sanity check'inde
    // rol atamaları cookie tazeleyince uyumsuzluk olmasın.
    var yeniSecurityStamp = Guid.NewGuid().ToString().Replace("-", "").ToUpperInvariant();
    // Sprint 11.52: Aynı PostgreSQL→MySQL tanım hatası. Backtick'e çevrildi.
    var affected = await veritabani.Database.ExecuteSqlRawAsync(
        "UPDATE `AspNetUsers` SET `PasswordHash` = {0}, `SecurityStamp` = {1}, `ConcurrencyStamp` = {2} WHERE `Id` = {3}",
        yeniHash, yeniSecurityStamp, Guid.NewGuid().ToString(), user.Id);

    // DB'den tekrar oku ve verify et.
    veritabani.ChangeTracker.Clear();
    var guncelUser = await veritabani.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
    var verify = passwordHasher.VerifyHashedPassword(guncelUser, guncelUser.PasswordHash, yeniSifre);

    logger.LogInformation("[MAINT-SET-PWD-RAW] {Email} PasswordHash set edildi. AffectedRows={Affected}, Verify={Verify}",
        email, affected, verify);

    return Results.Ok(new
    {
        message = "Raw SQL PasswordHash set edildi.",
        email,
        affectedRows = affected,
        verifyResult = verify.ToString(),
        eskiHashLen = eskiHash?.Length ?? 0,
        yeniHashLen = guncelUser.PasswordHash?.Length ?? 0,
        yeniSecurityStampLen = guncelUser.SecurityStamp?.Length ?? 0,
    });
}).AllowAnonymous();

// Idempotent PasswordHash set — mevcut hesabın şifresini değiştirmek için.
// Identity 9 CreateAsync sırasında PasswordHash'i boş bırakabiliyor; bu endpoint
// mevcut hesabın PasswordHash'ini doğrudan set eder.
// Kullanım: POST /api/__maintenance/set-password?token=<SEKRET>&email=X&password=Y
app.MapPost("/api/__maintenance/set-password", async (
    HttpContext http,
    IConfiguration yapilandirma,
    UserManager<ApplicationUser> userManager,
    IPasswordHasher<ApplicationUser> passwordHasher,
    FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext veritabani,
    ILogger<Program> logger) =>
{
    // Sprint 11.52: Kod içine gömülü varsayılan anahtar kaldırıldı.
    // `AdminMaintenance__Secret` tanımlı değilse endpoint fail-closed (403) kalır.
    if (!BakimGizliAnahtar.Gecerli(http, yapilandirma))
    {
        return Results.Json(new { message = "Yetkisiz. Token yanlış veya eksik." }, statusCode: 403);
    }

    var email = http.Request.Query["email"].ToString();
    var yeniSifre = http.Request.Query["password"].ToString();
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(yeniSifre))
    {
        return Results.Json(new { message = "email + password query param gerekli." }, statusCode: 400);
    }

    var user = await userManager.FindByEmailAsync(email);
    if (user is null)
    {
        return Results.Json(new { message = $"Kullanıcı bulunamadı: {email}" }, statusCode: 404);
    }

    // Identity'nin kendi IPasswordHasher'ı ile direkt hash set et.
    user.PasswordHash = passwordHasher.HashPassword(user, yeniSifre);
    // SecurityStamp yenilensin — eski cookie/MFA invalidate olur.
    await userManager.UpdateSecurityStampAsync(user);
    var updSonuc = await userManager.UpdateAsync(user);
    if (!updSonuc.Succeeded)
    {
        // Son çare: SQL raw UPDATE.
        user.PasswordHash = passwordHasher.HashPassword(user, yeniSifre);
        veritabani.Users.Update(user);
        await veritabani.SaveChangesAsync();
        logger.LogWarning("[MAINT-SET-PWD] UpdateAsync başarısız, raw SQL kullanıldı: {Email}", email);
    }

    // Verify: yeni hash ile yeni şifre doğrulanıyor mu?
    var verify = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, yeniSifre);
    logger.LogInformation("[MAINT-SET-PWD] {Email} şifre set edildi. VerifyHashedPassword={Verify}", email, verify);

    return Results.Ok(new
    {
        message = "Şifre başarıyla set edildi.",
        email = user.Email,
        verifyResult = verify.ToString(),
        oncekiPasswordHash = "***reset***",
        yeniPasswordHashLen = user.PasswordHash?.Length ?? 0,
    });
}).AllowAnonymous();

// Sprint 11.41: Hesap lockout kaldır (Identity AccessFailedCount-based lock).
// Onur çok hatalı login denemesinden sonra hesabı kilitlenmiş olabilir.
// Kullanım: POST /api/__maintenance/unlock-account?token=SECRET&email=user@x.com
app.MapPost("/api/__maintenance/unlock-account", async (
    HttpContext http,
    IConfiguration yapilandirma,
    UserManager<ApplicationUser> userManager) =>
{
    // Sprint 11.52: Kod içine gömülü varsayılan anahtar kaldırıldı.
    // `AdminMaintenance__Secret` tanımlı değilse endpoint fail-closed (403) kalır.
    if (!BakimGizliAnahtar.Gecerli(http, yapilandirma))
    {
        return Results.Json(new { message = "Yetkisiz. Token yanlış veya eksik." }, statusCode: 403);
    }

    var email = http.Request.Query["email"].ToString();
    if (string.IsNullOrWhiteSpace(email))
    {
        return Results.Json(new { message = "email query param gerekli." }, statusCode: 400);
    }

    var user = await userManager.FindByEmailAsync(email);
    if (user is null)
    {
        return Results.Json(new { message = $"Kullanıcı bulunamadı: {email}" }, statusCode: 404);
    }

    var oncekiBasarisizDeneme = user.AccessFailedCount;
    var oncekiLockoutEnd = user.LockoutEnd;

    // AccessFailedCount sıfırla + LockoutEnd temizle.
    await userManager.ResetAccessFailedCountAsync(user);
    await userManager.SetLockoutEndDateAsync(user, null);

    return Results.Ok(new
    {
        message = "Hesap kilidi kaldırıldı.",
        email = user.Email,
        oncekiBasarisizDeneme,
        oncekiLockoutEnd,
        yeniAccessFailedCount = user.AccessFailedCount,
        yeniLockoutEnd = user.LockoutEnd,
    });
}).AllowAnonymous();

// rolleri bir kez olustur (idempotent)
using (var kapsam = app.Services.CreateScope())
{
    var rolYoneticisi = kapsam.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    string[] roller =
    [
        "Student",
        "ProvinceEvaluator",
        "ProvinceManager",
        "MinistryOfficial",
        "SystemAdmin"
    ];
    foreach (var rol in roller)
    {
        if (!await rolYoneticisi.RoleExistsAsync(rol))
        {
            await rolYoneticisi.CreateAsync(new IdentityRole(rol));
        }
    }
}

// Sprint 10.7+++ Sistem Admin seed.
//
// ⚠️ Sprint 11.52 GÜVENLİK DÜZELTMESİ — eski davranış KALDIRILDI:
//   Eski kod, Production dahil HER ortamda ve HER açılışta, kodda gömülü olan
//   sabit bir e-posta + sabit bir şifreyle sistem yöneticisi hesabını arayıp,
//   varsa SİLİP yeniden oluşturuyordu. Bu:
//     (a) bilinen şifreyle en yüksek yetkiye erişim açığı,
//     (b) her restart'ta yöneticinin şifresi/MFA kurulumu/servis kayıtları yok olması,
//     (c) teslim edilen kodda kimlik bilgisi gömülü olması demekti.
//
// Yeni davranış (fail-closed):
//   - Yalnızca `SeedSystemAdmin__Email` VE `SeedSystemAdmin__Password` ortam
//     değişkenlerinin İKİSİ de tanımlıysa seed çalışır.
//   - Hesap zaten varsa hiçbir şey yapılmaz (şifre/MFA korunur).
//   - Hiçbir e-posta veya şifre kodda gömülü değildir.
//   - Kurulum sonrası bu iki değişken sunucudan KALDIRILMASI önerilir.
{
    var seedEmail = builder.Configuration["SeedSystemAdmin:Email"];
    var seedPassword = builder.Configuration["SeedSystemAdmin:Password"];

    if (string.IsNullOrWhiteSpace(seedEmail) || string.IsNullOrWhiteSpace(seedPassword))
    {
        Console.WriteLine("[SEED] Sistem Admin seed ATLANDI — SeedSystemAdmin__Email ve " +
            "SeedSystemAdmin__Password tanımlı değil. İlk yönetici hesabını " +
            "Admin Panel > Kullanıcı Yönetimi veya /api/__maintenance/admin-reset ile oluşturun.");
    }
    else
    {
        using var sistemAdminKapsam = app.Services.CreateScope();
        var kullaniciYoneticisi = sistemAdminKapsam.ServiceProvider
            .GetRequiredService<UserManager<ApplicationUser>>();

        var mevcutSistemAdmin = await kullaniciYoneticisi.FindByEmailAsync(seedEmail);
        if (mevcutSistemAdmin is not null)
        {
            // Kesinlikle dokunma: şifre/MFA/güvenlik damgası korunur.
            Console.WriteLine($"[SEED] Sistem Admin zaten var, dokunulmadı: {seedEmail}");
        }
        else
        {
            var sistemAdmin = new ApplicationUser
            {
                UserName = seedEmail,
                Email = seedEmail,
                FirstName = "Sistem",
                LastName = "Yöneticisi",
                EmailConfirmed = true,
            };
            var olusturma = await kullaniciYoneticisi.CreateAsync(sistemAdmin, seedPassword);
            if (olusturma.Succeeded)
            {
                await kullaniciYoneticisi.AddToRoleAsync(sistemAdmin, "SystemAdmin");
                await kullaniciYoneticisi.AddToRoleAsync(sistemAdmin, "MinistryOfficial");
                Console.WriteLine($"[SEED] Sistem Admin oluşturuldu: {seedEmail}");
            }
            else
            {
                Console.WriteLine($"[SEED] HATA: Sistem Admin oluşturulamadı: " +
                    FikirPlatformu.Api.Endpoints.SifreKuraliMesaji.Turkce(olusturma));
                Console.WriteLine("[SEED] Hatırlatma: şifre en az 8 karakter, büyük harf, küçük harf, " +
                    "rakam ve özel karakter içermelidir (YEĞİTEK madde 16).");
            }
        }
    }
}

// İl AR-GE demo seed: 1 ProvinceManager + 1 ProvinceEvaluator (İstanbul ili). Şifre "12345".
// Bu seed sadece Development ortamında ve kullanıcı yoksa oluşturulur; idempotent.
if (app.Environment.IsDevelopment())
{
    using var seedKapsam = app.Services.CreateScope();
    var kullaniciYoneticisi = seedKapsam.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var girisYoneticisi = seedKapsam.ServiceProvider.GetRequiredService<SignInManager<ApplicationUser>>();

    async Task IlPersoneliOlusturAsync(string eposta, string ad, string soyad, params string[] roller)
    {
        var mevcut = await kullaniciYoneticisi.FindByEmailAsync(eposta);
        if (mevcut is not null) return;
        var kullanici = new ApplicationUser
        {
            UserName = eposta,
            Email = eposta,
            FirstName = ad,
            LastName = soyad,
            EmailConfirmed = true, // Development seed — e-posta doğrulaması atlandı
        };
        var sonuc = await kullaniciYoneticisi.CreateAsync(kullanici, "12345");
        if (!sonuc.Succeeded) return;
        foreach (var rol in roller)
        {
            await kullaniciYoneticisi.AddToRoleAsync(kullanici, rol);
        }
    }

    await IlPersoneliOlusturAsync("manager@local", "İl", "Yönetici", "ProvinceManager");
    await IlPersoneliOlusturAsync("evaluator@local", "İl", "Değerlendirici", "ProvinceEvaluator");
    await IlPersoneliOlusturAsync("ministry@local", "Bakanlık", "Yetkili", "MinistryOfficial");

    // Öğrenci demo seed: 10 öğrenci, farklı iller, farklı kategorilerde fikir göndermiş.
    // Idempotent — kullanıcı yoksa oluşturur.
    using var ogrenciKapsam = app.Services.CreateScope();
    var ogrenciKullaniciYonetici = ogrenciKapsam.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var ogrenciVeritabani = ogrenciKapsam.ServiceProvider.GetRequiredService<FikirPlatformuDbContext>();
    var ogrenciSaat = ogrenciKapsam.ServiceProvider.GetRequiredService<IClock>();

    async Task OgrenciVeFikirOlusturAsync(
        string eposta,
        string ad,
        string soyad,
        int ilId,
        int kategoriId,
        string okul,
        int? sinif,
        string okulNo,
        string fikirMetni)
    {
        var mevcut = await ogrenciKullaniciYonetici.FindByEmailAsync(eposta);
        string userId;
        Guid profilId;
        if (mevcut is null)
        {
            var k = new ApplicationUser
            {
                UserName = eposta,
                Email = eposta,
                FirstName = ad,
                LastName = soyad,
                EmailConfirmed = true,
            };
            await ogrenciKullaniciYonetici.CreateAsync(k, "12345");
            await ogrenciKullaniciYonetici.AddToRoleAsync(k, "Student");
            userId = k.Id;
            profilId = Guid.NewGuid();
            var simdi = ogrenciSaat.UtcNow;
            ogrenciVeritabani.StudentProfiles.Add(new FikirPlatformu.Domain.Students.StudentProfile
            {
                Id = profilId,
                ApplicationUserId = userId,
                ProvinceId = ilId,
                School = okul,
                Grade = sinif,
                StudentNumber = okulNo,
                CreatedAt = simdi,
                UpdatedAt = simdi,
            });
            await ogrenciVeritabani.SaveChangesAsync();
        }
        else
        {
            userId = mevcut.Id;
            var mevcutProfil = ogrenciVeritabani.StudentProfiles.FirstOrDefault(p => p.ApplicationUserId == userId);
            if (mevcutProfil is null) return;
            profilId = mevcutProfil.Id;
        }

        // Aynı öğrencinin fikri zaten varsa atla
        var varMi = ogrenciVeritabani.Ideas.Any(i => i.StudentId == profilId && i.CategoryId == kategoriId);
        if (varMi) return;

        var simdi2 = ogrenciSaat.UtcNow;
        var fikir = Idea.CreateDraft(profilId, ilId, kategoriId, fikirMetni, simdi2);
        fikir.Submit(ilId, simdi2);
        ogrenciVeritabani.Ideas.Add(fikir);
        await ogrenciVeritabani.SaveChangesAsync();
    }

    await OgrenciVeFikirOlusturAsync("test1.ogr@local", "Ayşe", "Yılmaz", 34, 1, "Atatürk Ortaokulu", 5, "1042", "Okullarda geleneksel el sanatları atölyeleri kurulmalı.");
    await OgrenciVeFikirOlusturAsync("test2.ogr@local", "Mehmet", "Demir", 6, 2, "Ankara Lisesi", 11, "2018", "Okul bahçelerinde spor sahaları yenilenmeli ve yeni branşlar eklenmeli.");
    await OgrenciVeFikirOlusturAsync("test3.ogr@local", "Zeynep", "Kaya", 35, 3, "İzmir Fen Lisesi", 10, "3025", "Yapay zekâ destekli öğrenme asistanı tüm okullarda ücretsiz olmalı.");
    await OgrenciVeFikirOlusturAsync("test4.ogr@local", "Ali", "Öztürk", 16, 4, "Bursa Anadolu Lisesi", 9, "4051", "Okul çevre kulüpleri geri dönüşüm fabrikalarıyla işbirliği yapmalı.");
    await OgrenciVeFikirOlusturAsync("test5.ogr@local", "Elif", "Arslan", 7, 5, "Antalya Koleji", 7, "5019", "Dijital kütüphane uygulaması tüm öğrencilere ücretsiz erişim sağlamalı.");
    await OgrenciVeFikirOlusturAsync("test6.ogr@local", "Mert", "Yıldız", 42, 6, "Konya Mimar Sinan İHL", 8, "6073", "Mahalle bazlı gönüllülük programları öğrenciler için zorunlu olmalı.");
    await OgrenciVeFikirOlusturAsync("test7.ogr@local", "Selin", "Acar", 1, 2, "Adana Anadolu Lisesi", 12, "7038", "Yüzme havuzları kırsal okullara taşınabilir sistemlerle kurulmalı.");
    await OgrenciVeFikirOlusturAsync("test8.ogr@local", "Burak", "Polat", 61, 1, "Trabzon Yomra Fen Lisesi", 11, "8054", "Karadeniz bölgesi kültürü dijital müzelerle tanıtılmalı.");
    await OgrenciVeFikirOlusturAsync("test9.ogr@local", "İrem", "Çelik", 27, 7, "Gaziantep Fen Lisesi", 9, "9027", "Okul kantinlerinde sağlıklı menü seçenekleri artırılmalı.");
    await OgrenciVeFikirOlusturAsync("test10.ogr@local", "Kerem", "Doğan", 26, 3, "Eskişehir Atatürk Lisesi", 10, "1001", "Robotik kodlama zorunlu ders olmalı ve her okulda lab olmalı.");
}

app.Run();

public partial class Program;
