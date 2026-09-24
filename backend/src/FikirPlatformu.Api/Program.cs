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
    // useMicrosoftSchema: false (default) — MySQL schemasız; "public" referansı yok sayılır.
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString),
        my => my.EnableRetryOnFailure(maxRetryCount: 3));
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
builder.Services.AddScoped<IEmailSender, DevelopmentEmailSender>();
// Background job: auth_events 2 yıl retention (plan §1.7).
builder.Services.AddHostedService<FikirPlatformu.Api.ArkaPlan.AuthEventRetentionService>();
// Background job: kullanılmayan hesapları 90 gün sonra kilitle (plan §6.3).
builder.Services.AddHostedService<FikirPlatformu.Api.ArkaPlan.PasifHesapTespitService>();

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        // Sign-in: e-posta doğrulama zorunlu (plan §2.5).
        options.SignIn.RequireConfirmedAccount = true;
        options.User.RequireUniqueEmail = true;

        // Password policy (plan §2.1 + resim: min 8 karakter, büyük/küçük/raam/özel).
        options.Password.RequiredLength = 8;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireDigit = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequiredUniqueChars = 4;

        // Lockout (plan §2.2 + resim): 5 başarısız deneme → 15 dk kilit.
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<FikirPlatformuDbContext>()
    .AddSignInManager<SignInManager<ApplicationUser>>()
    .AddDefaultTokenProviders();

// Cookie güvenlik ayarları (plan §3.1 + §3.2 — Sprint 3):
//   - HttpOnly: JS erişemez (XSS koruması)
//   - SameSite: Cors:AllowedOrigins DOLUYSA → None (cross-origin); BOŞSA → Lax (same-origin reverse proxy)
//   - SecurePolicy: Development=SameAsRequest (HTTP test); Production=Always (HTTPS zorunlu)
//   - ExpireTimeSpan=30 dk: idle timeout (plan §3.2)
//   - Absolute timeout=8 saat: ASP.NET Core cookie auth'da yok; OnValidatePrincipal + IssueDate ile manuel uygulanır.
var isProduction = builder.Environment.IsProduction();
var securePolicy = isProduction ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
// Cross-origin (CORS whitelist dolu) → SameSite=None gerekli.
// Same-origin (nginx reverse proxy) → Lax yeterli + daha güvenli.
var corsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();
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
builder.Services.AddSingleton<FikirPlatformu.Api.Endpoints.HassasVeriSifreleme>();

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

var app = builder.Build();

// Güvenlik header'ları (Sprint 5 — ek savunma katmanı).
// X-Content-Type-Options: MIME sniffing engeli
// X-Frame-Options: clickjacking koruması
// Referrer-Policy: referrer bilgisi sızıntısı azaltma
// Permissions-Policy: gereksiz tarayıcı özelliklerini kapatma
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()";
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
app.UseAuthentication();
app.UseAuthorization();

// CORS: sadece whitelist doluysa aktif (cross-origin deployment için).
if (corsOrigins.Length > 0)
{
    app.UseCors(FrontendCorsPolicy);
}

app.MapGet("/api/health", (IClock clock) => Results.Ok(new
{
    status = "healthy",
    application = "Geleceğin Fikri API",
    utcTime = clock.UtcNow
}));

app.MapGet("/api/health/db", async (FikirPlatformuDbContext db, CancellationToken cancellationToken) =>
{
    var connected = await db.Database.CanConnectAsync(cancellationToken);
    return connected
        ? Results.Ok(new { status = "connected", database = "PostgreSQL" })
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
