using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Evaluations;
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
    /// Plan §42 #3: rol bazlı tek il atanır; bu sprint'te demo seed hesaplar için sabit İstanbul (id 34) döner.
    /// Üretimde AspNetUsers → ProvinceStaff ayrı tablosu ile değiştirilecek.
    /// </summary>
    private static async Task<int> GetProvinceForStaffAsync(
        FikirPlatformuDbContext db,
        string userId,
        CancellationToken cancellationToken) => await Task.FromResult(34);

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

        // POST /api/province/ideas/{id}/evaluations — puanlama gönder (Evaluator veya Manager)
        grup.MapPost("/ideas/{id:guid}/evaluations", async (
            Guid id,
            PuanlamaIstegi istek,
            HttpContext http,
            FikirPlatformuDbContext db,
            SubmitEvaluationService service,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);

            var scores = (istek.Scores ?? new List<PuanlamaIstegi.ScoreItem>())
                .Select(s => new EvaluationScoreInput(s.Criterion, s.Score, s.Comment))
                .ToList();

            var sonuc = await service.SubmitAsync(
                new SubmitEvaluationCommand(id, ilId, userId, scores),
                cancellationToken);

            return sonuc switch
            {
                SubmitEvaluationResult.Ok ok => Results.Ok(new { ideaId = id, evaluatedAt = ok.EvaluatedAt }),
                SubmitEvaluationResult.NotFound => Results.NotFound(new { message = "Fikir bulunamadı veya başka ile ait." }),
                SubmitEvaluationResult.Locked => Results.ValidationProblem(new Dictionary<string, string[]> { ["ideaId"] = ["Onaylanmış fikir puanlanamaz."] }),
                SubmitEvaluationResult.NoScores => Results.ValidationProblem(new Dictionary<string, string[]> { ["scores"] = ["En az bir kriter puanı zorunludur."] }),
                SubmitEvaluationResult.InvalidScore => Results.ValidationProblem(new Dictionary<string, string[]> { ["scores"] = ["Puanlar 1-5 arasında olmalıdır."] }),
                _ => Results.StatusCode(500),
            };
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceEvaluator", "ProvinceManager"));

        // GET /api/province/ideas/{id}/evaluations — fikrin tüm puanları
        grup.MapGet("/ideas/{id:guid}/evaluations", async (
            Guid id,
            HttpContext http,
            FikirPlatformuDbContext db,
            IIdeaEvaluationRepository repo,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);

            var fikirMi = await db.Ideas.AnyAsync(i => i.Id == id && i.ProvinceId == ilId, cancellationToken);
            if (!fikirMi) return Results.NotFound();

            var tumu = await repo.GetForIdeaAsync(id, cancellationToken);
            var ortalamalar = await repo.GetAveragesAsync(id, cancellationToken);
            return Results.Ok(new
            {
                evaluations = tumu,
                averages = ortalamalar,
                threshold = SubmitEvaluationService.CandidateThreshold,
            });
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceEvaluator", "ProvinceManager"));

        // GET /api/province/candidates — otomatik aday havuzu
        grup.MapGet("/candidates", async (
            HttpContext http,
            FikirPlatformuDbContext db,
            ICandidatesQueryService service,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);
            var liste = await service.ListAsync(ilId, cancellationToken);
            return Results.Ok(liste);
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceManager"));

        // POST /api/province/ideas/{id}/approve — Manager onayı
        grup.MapPost("/ideas/{id:guid}/approve", async (
            Guid id,
            HttpContext http,
            FikirPlatformuDbContext db,
            ApproveIdeaService service,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);
            var sonuc = await service.ApproveAsync(new ApproveIdeaCommand(id, ilId, userId), cancellationToken);
            return sonuc switch
            {
                ApproveIdeaResult.Ok ok => Results.Ok(new { ideaId = id, approvedAt = ok.ApprovedAt }),
                ApproveIdeaResult.NotFound => Results.NotFound(new { message = "Fikir bulunamadı veya başka ile ait." }),
                _ => Results.StatusCode(500),
            };
        }).RequireAuthorization(policy => policy.RequireRole("ProvinceManager"));

        return app;
    }
}

public sealed record AssignEvaluatorIstegi(string EvaluatorUserId);

public sealed record PuanlamaIstegi(List<PuanlamaIstegi.ScoreItem>? Scores)
{
    public sealed record ScoreItem(EvaluationCriterion Criterion, int Score, string? Comment);
}
