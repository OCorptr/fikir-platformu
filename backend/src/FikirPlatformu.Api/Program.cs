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
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddProblemDetails();

builder.Services.AddDbContext<FikirPlatformuDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("PostgreSQL")));
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

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = true;
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 5;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireDigit = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<FikirPlatformuDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    // Öğrenci: Identity'nin default scheme'i (Identity.Application).
    .AddCookie(IdentityConstants.ApplicationScheme, options =>
    {
        options.Cookie.Name = ".FikirStudent.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    })
    // İl AR-GE personeli: ayrı cookie — aynı tarayıcıda bakanlık hesabı açıkken
    // il-panel'e girildiğinde çakışmayı önler (plan §49).
    .AddCookie("ProvinceScheme", options =>
    {
        options.Cookie.Name = ".FikirProvince.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    })
    // Bakanlık: ayrı cookie.
    .AddCookie("MinistryScheme", options =>
    {
        options.Cookie.Name = ".FikirMinistry.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
        options.SlidingExpiration = true;
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
});

const string DevelopmentFrontendPolicy = "DevelopmentFrontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevelopmentFrontendPolicy, policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseCors(DevelopmentFrontendPolicy);
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
