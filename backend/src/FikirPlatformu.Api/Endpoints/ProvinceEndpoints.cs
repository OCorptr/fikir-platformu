using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class ProvinceEndpoints
{
    /// <summary>
    /// Öğrencinin bağlı olduğu ilin kimliğini döner; profildeki il değiştirilince fikirler de yeni ile geçer (plan §42 #1).
    /// </summary>
    private static async Task<int?> GetStudentProvinceIdOrNullAsync(
        FikirPlatformuDbContext db,
        string userId,
        CancellationToken cancellationToken)
    {
        var profilId = await db.StudentProfiles
            .Where(p => p.ApplicationUserId == userId)
            .Select(p => (int?)p.ProvinceId)
            .FirstOrDefaultAsync(cancellationToken);
        return profilId;
    }

    /// <summary>İl AR-GE sorumlusunun yönettiği ilin kimliğini döner. Şimdilik seed hesaplar için tek il atanır (İstanbul).</summary>
    private static async Task<int> GetProvinceForStaffAsync(
        FikirPlatformuDbContext db,
        string userId,
        CancellationToken cancellationToken)
    {
        // Şimdilik demo amaçlı: kullanıcının öğrenci profili varsa onun ili kullanılır (plan §42 #3 kararı: rol bazlı tek il atanır; burada test seed hesaplar için öğrenci profili oluşturulmaz, ayrı tabloda tutulur).
        // Bu endpoint henüz geliştirme aşamasında — gerçek dağıtımda AspNetUser → ProvinceId bağlantısı ayrı tabloda tutulacak (plan §42 #3).
        // Test seed'ı için sabit İstanbul (id 34) kullanılır; gerçek atama sonradan yapılacak.
        return 34;
    }

    public static IEndpointRouteBuilder MapProvinceEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/province").WithTags("İl AR-GE");

        // GET /api/province/inbox — kendi ilinin gönderilmiş fikirleri
        grup.MapGet("/inbox", async (
            HttpContext http,
            FikirPlatformuDbContext db,
            IProvinceInboxQueryService inboxService,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            // Önce ilgili kullanıcının hangi ile bağlı olduğunu belirle.
            // Rol bazlı: ProvinceManager/ProvinceEvaluator ayrı bir tabloda tutulacak (plan §42 #3).
            // Şimdilik demo: seed hesap İstanbul'a bağlı (id 34).
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);
            var liste = await inboxService.ListAsync(ilId, userId, cancellationToken);
            return Results.Ok(liste);
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceEvaluator", "ProvinceManager"));

        // POST /api/province/ideas/{id}/read — kullanıcı bazlı okundu işaretle
        grup.MapPost("/ideas/{id:guid}/read", async (
            Guid id,
            HttpContext http,
            IIdeaReadReceiptRepository receipts,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            await receipts.MarkReadAsync(id, userId, clock.UtcNow, cancellationToken);
            await receipts.SaveChangesAsync(cancellationToken);
            return Results.Ok(new { ideaId = id, readAt = clock.UtcNow });
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceEvaluator", "ProvinceManager"));

        // POST /api/province/ideas/{id}/assign — değerlendirici atama (sadece ProvinceManager)
        grup.MapPost("/ideas/{id:guid}/assign", async (
            Guid id,
            AssignEvaluatorIstegi istek,
            HttpContext http,
            FikirPlatformuDbContext db,
            AssignEvaluatorService assignService,
            UserManager<ApplicationUser> userManager,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            // Atanacak kişinin gerçekten ProvinceEvaluator rolünde olduğunu doğrula
            var hedef = await userManager.FindByIdAsync(istek.EvaluatorUserId);
            if (hedef is null) return Results.NotFound(new { message = "Değerlendirici bulunamadı." });
            if (!await userManager.IsInRoleAsync(hedef, "ProvinceEvaluator"))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["evaluatorUserId"] = ["Değerlendirici rolünde olmayan kullanıcıya atama yapılamaz."],
                });

            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);
            var sonuc = await assignService.AssignAsync(
                new AssignEvaluatorCommand(id, ilId, istek.EvaluatorUserId, userId),
                cancellationToken);

            return sonuc switch
            {
                AssignEvaluatorResult.Ok ok => Results.Ok(new { ideaId = id, evaluatorUserId = istek.EvaluatorUserId, assignedAt = ok.AssignedAt }),
                AssignEvaluatorResult.NotFound => Results.NotFound(new { message = "Fikir bulunamadı veya başka ile ait." }),
                _ => Results.StatusCode(500),
            };
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceManager"));

        // GET /api/province/evaluators — bu ildeki ProvinceEvaluator listesi (sadece ProvinceManager)
        grup.MapGet("/evaluators", async (
            FikirPlatformuDbContext db,
            UserManager<ApplicationUser> userManager) =>
        {
            // Plan §42 #3: rol bazlı tek il atanır; şimdilik demo için İstanbul (id 34) varsayılır.
            const int ilId = 34;
            var evaluatorRoleId = await db.Roles
                .Where(r => r.Name == "ProvinceEvaluator")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();
            if (string.IsNullOrEmpty(evaluatorRoleId))
                return Results.Ok(Array.Empty<object>());

            var userIds = await db.UserRoles
                .Where(ur => ur.RoleId == evaluatorRoleId)
                .Select(ur => ur.UserId)
                .ToListAsync();

            var users = await db.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                })
                .ToListAsync();

            // Şimdilik tüm evaluator'ler İstanbul'a atanmış sayılır (plan §42 #3 henüz uygulanmadı).
            _ = ilId;
            return Results.Ok(users);
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceManager"));

        // GET /api/province/ideas/{id} — başvuru detayı
        grup.MapGet("/ideas/{id:guid}", async (
            Guid id,
            HttpContext http,
            FikirPlatformuDbContext db,
            IIdeaReadReceiptRepository receipts,
            IIdeaAssignmentRepository assignments,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);

            var fikir = await (
                from f in db.Ideas.AsNoTracking()
                where f.Id == id && f.ProvinceId == ilId
                join p in db.StudentProfiles.AsNoTracking() on f.StudentId equals p.Id
                join u in db.Users.AsNoTracking() on p.ApplicationUserId equals u.Id
                join cat in db.IdeaCategories.AsNoTracking() on f.CategoryId equals cat.Id
                join il in db.Provinces.AsNoTracking() on f.ProvinceId equals il.Id
                join pil in db.Provinces.AsNoTracking() on p.ProvinceId equals pil.Id
                select new
                {
                    f.Id,
                    f.CategoryId,
                    CategoryName = cat.Name,
                    f.ProvinceId,
                    ProvinceName = il.Name,
                    f.Content,
                    f.Status,
                    f.CreatedAt,
                    f.UpdatedAt,
                    f.SubmittedAt,
                    StudentProfile = new
                    {
                        p.ApplicationUserId,
                        FirstName = u.FirstName,
                        LastName = u.LastName,
                        p.ProvinceId,
                        ProvinceName = pil.Name,
                        p.District,
                        p.School,
                        p.Grade,
                        p.StudentNumber
                    }
                }
            ).FirstOrDefaultAsync(cancellationToken);

            if (fikir is null) return Results.NotFound(new { message = "Fikir bulunamadı veya başka ile ait." });

            var readAt = await receipts.GetReadAtAsync(id, userId, cancellationToken);
            var evaluatorIds = await assignments.GetEvaluatorIdsAsync(id, cancellationToken);

            return Results.Ok(new
            {
                idea = fikir,
                readByMe = readAt.HasValue,
                readAt,
                assignedEvaluatorIds = evaluatorIds,
            });
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceEvaluator", "ProvinceManager"));

        return app;
    }

    public sealed record AssignEvaluatorIstegi(string EvaluatorUserId);
}
