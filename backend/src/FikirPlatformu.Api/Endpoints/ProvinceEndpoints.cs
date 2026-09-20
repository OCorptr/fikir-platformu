using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Implementations;
using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Implementations;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class ProvinceEndpoints
{
    /// <summary>
    /// Plan §42 #3 düzeltmesi (Sprint 6): manager/evaluator kendi ili province_user_assignments
    /// tablosundan çekilir. Kullanıcının birden fazla rol ataması varsa Manager kaydı öncelikli.
    /// Atanmamış kullanıcı için 0 döner (endpoint 404 verir).
    /// </summary>
    private static async Task<int> GetProvinceForStaffAsync(
        FikirPlatformuDbContext db,
        string userId,
        CancellationToken cancellationToken)
    {
        var atama = await db.ProvinceUserAssignments
            .Where(a => a.UserId == userId
                && (a.Role == "ProvinceManager" || a.Role == "ProvinceEvaluator"))
            .OrderBy(a => a.Role == "ProvinceManager" ? 0 : 1) // Manager öncelikli
            .FirstOrDefaultAsync(cancellationToken);
        return atama?.ProvinceId ?? 0;
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
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);
            var liste = await inboxService.ListAsync(ilId, userId, cancellationToken);
            return Results.Ok(liste);
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

        // GET /api/province/evaluators — bu ildeki atanmış ProvinceEvaluator listesi (sadece ProvinceManager)
        // Sprint 6: sadece kendi ilindeki evaluator'ler (province_user_assignments tablosundan)
        grup.MapGet("/evaluators", async (
            HttpContext http,
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(currentUserId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, currentUserId, cancellationToken);
            if (ilId == 0) return Results.Forbid();

            // Sadece manager kendi ilindeki atanmış evaluator'leri görebilir
            var managerMi = await db.ProvinceUserAssignments
                .AnyAsync(a => a.UserId == currentUserId && a.Role == "ProvinceManager" && a.ProvinceId == ilId, cancellationToken);
            if (!managerMi) return Results.Forbid();

            var liste = await (
                from a in db.ProvinceUserAssignments
                join u in db.Users on a.UserId equals u.Id
                where a.ProvinceId == ilId && a.Role == "ProvinceEvaluator"
                orderby a.AssignedAt descending
                select new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    AssignedAt = a.AssignedAt,
                }
            ).ToListAsync(cancellationToken);

            return Results.Ok(liste);
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

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
        }).RequireAuthorization("ProvinceOnly");

        // POST /api/province/ideas/{id}/implementations — uygulama raporu (ProvinceManager)
        grup.MapPost("/ideas/{id:guid}/implementations", async (
            Guid id,
            UygulamaRaporuIstegi istek,
            HttpContext http,
            FikirPlatformuDbContext db,
            SubmitImplementationReportService service,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);

            var sonuc = await service.SubmitAsync(
                new SubmitImplementationReportCommand(id, ilId, istek.Status, istek.Note ?? "", userId),
                cancellationToken);

            return sonuc switch
            {
                SubmitImplementationReportResult.Ok ok => Results.Ok(new { ideaId = id, reportId = ok.ReportId, reportedAt = ok.ReportedAt }),
                SubmitImplementationReportResult.NotFound => Results.NotFound(new { message = "Fikir bulunamadı veya başka ile ait." }),
                _ => Results.StatusCode(500),
            };
        }).RequireAuthorization("ProvinceOnly");

        // GET /api/province/ideas/{id}/implementations — uygulama raporları geçmişi
        grup.MapGet("/ideas/{id:guid}/implementations", async (
            Guid id,
            HttpContext http,
            FikirPlatformuDbContext db,
            IImplementationReportRepository repo,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, userId, cancellationToken);

            var fikirMi = await db.Ideas.AnyAsync(i => i.Id == id && i.ProvinceId == ilId, cancellationToken);
            if (!fikirMi) return Results.NotFound();

            var liste = await repo.GetForIdeaAsync(id, cancellationToken);
            return Results.Ok(liste);
        }).RequireAuthorization("ProvinceOnly");

        // POST /api/province/evaluators — yeni evaluator oluştur + kendi iline ata (sadece ProvinceManager)
        // Sprint 6 düzeltme: önceden UserId ile atama yapılıyordu (her fikre tek tek saçma);
        // artık manager email+şifre+ad ile yeni kullanıcı oluşturur, otomatik ProvinceEvaluator
        // rolü + il ataması alır.
        grup.MapPost("/evaluators", async (
            YeniEvaluatorIstegi istek,
            HttpContext http,
            FikirPlatformuDbContext db,
            UserManager<ApplicationUser> userManager,
            IClock clock,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(currentUserId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, currentUserId, cancellationToken);
            if (ilId == 0) return Results.Forbid();

            var managerMi = await db.ProvinceUserAssignments
                .AnyAsync(a => a.UserId == currentUserId && a.Role == "ProvinceManager" && a.ProvinceId == ilId, cancellationToken);
            if (!managerMi) return Results.Forbid();

            // Email zaten kayıtlı mı?
            var mevcutKullanici = await userManager.FindByEmailAsync(istek.Email);
            if (mevcutKullanici is not null)
                return Results.BadRequest(new { message = "Bu e-posta zaten kayıtlı." });

            // Yeni kullanıcı oluştur
            var yeniKullanici = new ApplicationUser
            {
                UserName = istek.Email,
                Email = istek.Email,
                FirstName = istek.FirstName,
                LastName = istek.LastName,
                EmailConfirmed = true,
            };
            var createResult = await userManager.CreateAsync(yeniKullanici, istek.Password);
            if (!createResult.Succeeded)
                return Results.BadRequest(new
                {
                    message = string.Join("; ", createResult.Errors.Select(e => e.Description))
                });

            // ProvinceEvaluator rolü ekle
            var roleResult = await userManager.AddToRoleAsync(yeniKullanici, "ProvinceEvaluator");
            if (!roleResult.Succeeded)
                return Results.BadRequest(new
                {
                    message = string.Join("; ", roleResult.Errors.Select(e => e.Description))
                });

            // İl ataması
            var atama = FikirPlatformu.Domain.Identity.ProvinceUserAssignment.Create(
                yeniKullanici.Id, ilId, "ProvinceEvaluator", currentUserId, clock.UtcNow);
            db.ProvinceUserAssignments.Add(atama);
            await db.SaveChangesAsync(cancellationToken);

            return Results.Ok(new
            {
                userId = yeniKullanici.Id,
                email = yeniKullanici.Email,
                provinceId = ilId
            });
        }).RequireAuthorization("ProvinceOnly");

        // DELETE /api/province/evaluators/{userId} — evaluator atamasını kaldır (sadece ProvinceManager)
        grup.MapDelete("/evaluators/{userId}", async (
            string userId,
            HttpContext http,
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            var currentUserId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(currentUserId)) return Results.Unauthorized();
            var ilId = await GetProvinceForStaffAsync(db, currentUserId, cancellationToken);
            if (ilId == 0) return Results.Forbid();

            var managerMi = await db.ProvinceUserAssignments
                .AnyAsync(a => a.UserId == currentUserId && a.Role == "ProvinceManager" && a.ProvinceId == ilId, cancellationToken);
            if (!managerMi) return Results.Forbid();

            var atama = await db.ProvinceUserAssignments
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Role == "ProvinceEvaluator" && a.ProvinceId == ilId, cancellationToken);
            if (atama is null) return Results.NotFound();
            db.ProvinceUserAssignments.Remove(atama);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        }).RequireAuthorization("ProvinceOnly");

        return app;
    }

    public sealed record EvaluatorAtamaDto(string UserId, string Email, string FirstName, string LastName, DateTimeOffset AssignedAt);
    public sealed record EvaluatorAtaIstegi(string UserId);
    public sealed record YeniEvaluatorIstegi(string Email, string Password, string FirstName, string LastName);

    public sealed record UygulamaRaporuIstegi(ImplementationStatus Status, string? Note);
}

public sealed record AssignEvaluatorIstegi(string EvaluatorUserId);

public sealed record PuanlamaIstegi(List<PuanlamaIstegi.ScoreItem>? Scores)
{
    public sealed record ScoreItem(EvaluationCriterion Criterion, int Score, string? Comment);
}
