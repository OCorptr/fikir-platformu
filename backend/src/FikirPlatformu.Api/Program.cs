using FikirPlatformu.Api.Endpoints;
using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Moderation;
using FikirPlatformu.Application.Provinces;
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

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.AddAuthorization();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromDays(14);
    options.SlidingExpiration = true;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
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
}

app.Run();

public partial class Program;
