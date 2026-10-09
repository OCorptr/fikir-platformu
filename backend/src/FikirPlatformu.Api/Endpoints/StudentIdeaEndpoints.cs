using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class StudentIdeaEndpoints
{
    public static IEndpointRouteBuilder MapStudentIdeaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/student/ideas")
            .RequireAuthorization("StudentOnly")
            .WithTags("Öğrenci Fikirleri");

        // Sprint 11.92 — KVKK yayım rızası uçları.
        MapYayimRizasiEndpoints(group);

        group.MapGet("/", async (
            UserManager<ApplicationUser> userManager,
            FikirPlatformuDbContext database,
            HttpContext http) =>
        {
            var profile = await GetProfileAsync(userManager, database, http);
            if (profile is null)
            {
                return Results.NotFound(new { message = "Öğrenci profili bulunamadı." });
            }

            var records = await database.Ideas
                .AsNoTracking()
                .Where(idea => idea.StudentId == profile.Id
                    && idea.Status != IdeaSubmissionStatus.Deleted)
                .Join(
                    database.IdeaCategories,
                    idea => idea.CategoryId,
                    category => category.Id,
                    (idea, category) => new { idea, category })
                .Join(
                    database.Provinces,
                    record => record.idea.ProvinceId,
                    province => province.Id,
                    (record, province) => new
                    {
                        record.idea.Id,
                        record.idea.CategoryId,
                        CategoryName = record.category.Name,
                        record.idea.ProvinceId,
                        ProvinceName = province.Name,
                        record.idea.Content,
                        record.idea.Status,
                        record.idea.CreatedAt,
                        record.idea.UpdatedAt,
                        record.idea.SubmittedAt
                    })
                .OrderByDescending(idea => idea.UpdatedAt)
                .ToListAsync(http.RequestAborted);

            return Results.Ok(records.Select(idea => new
            {
                idea.Id,
                idea.CategoryId,
                idea.CategoryName,
                idea.ProvinceId,
                idea.ProvinceName,
                idea.Content,
                status = idea.Status.ToString(),
                idea.CreatedAt,
                idea.UpdatedAt,
                idea.SubmittedAt,
                canEdit = idea.Status == IdeaSubmissionStatus.Draft
            }));
        });

        group.MapGet("/{id:guid}", async (
            Guid id,
            UserManager<ApplicationUser> userManager,
            FikirPlatformuDbContext database,
            HttpContext http) =>
        {
            var profile = await GetProfileAsync(userManager, database, http);
            if (profile is null)
            {
                return Results.NotFound(new { message = "Öğrenci profili bulunamadı." });
            }

            var idea = await database.Ideas
                .AsNoTracking()
                .Where(record => record.Id == id
                    && record.StudentId == profile.Id
                    && record.Status != IdeaSubmissionStatus.Deleted)
                .Join(
                    database.IdeaCategories,
                    record => record.CategoryId,
                    category => category.Id,
                    (record, category) => new { record, category })
                .Join(
                    database.Provinces,
                    result => result.record.ProvinceId,
                    province => province.Id,
                    (result, province) => new
                    {
                        result.record.Id,
                        result.record.CategoryId,
                        CategoryName = result.category.Name,
                        result.record.ProvinceId,
                        ProvinceName = province.Name,
                        result.record.Content,
                        result.record.Status,
                        result.record.CreatedAt,
                        result.record.UpdatedAt,
                        result.record.SubmittedAt
                    })
                .FirstOrDefaultAsync(http.RequestAborted);

            return idea is null
                ? Results.NotFound(new { message = "Fikir bulunamadı." })
                : Results.Ok(new
                {
                    idea.Id,
                    idea.CategoryId,
                    idea.CategoryName,
                    idea.ProvinceId,
                    idea.ProvinceName,
                    idea.Content,
                    status = idea.Status.ToString(),
                    idea.CreatedAt,
                    idea.UpdatedAt,
                    idea.SubmittedAt,
                    canEdit = idea.Status == IdeaSubmissionStatus.Draft
                });
        });

        group.MapPost("/drafts", async (
            SaveDraftRequest request,
            UserManager<ApplicationUser> userManager,
            FikirPlatformuDbContext database,
            IIdeaRepository repository,
            IClock clock,
            HttpContext http) =>
        {
            var contentError = ValidateContent(request.Content);
            if (contentError is not null)
            {
                return contentError;
            }

            var profile = await GetProfileAsync(userManager, database, http);
            if (profile is null)
            {
                return Results.NotFound(new { message = "Öğrenci profili bulunamadı." });
            }

            if (!await IsActiveCategoryAsync(database, request.CategoryId, http.RequestAborted))
            {
                return InvalidCategory();
            }

            var idea = Idea.CreateDraft(
                profile.Id,
                profile.ProvinceId,
                request.CategoryId,
                request.Content,
                clock.UtcNow);
            await repository.AddAsync(idea, http.RequestAborted);

            return Results.Created($"/api/student/ideas/{idea.Id}", new
            {
                idea.Id,
                status = idea.Status.ToString(),
                idea.CreatedAt
            });
        });

        group.MapPut("/drafts/{id:guid}", async (
            Guid id,
            SaveDraftRequest request,
            UserManager<ApplicationUser> userManager,
            FikirPlatformuDbContext database,
            IClock clock,
            HttpContext http) =>
        {
            var contentError = ValidateContent(request.Content);
            if (contentError is not null)
            {
                return contentError;
            }

            var profile = await GetProfileAsync(userManager, database, http);
            if (profile is null)
            {
                return Results.NotFound(new { message = "Öğrenci profili bulunamadı." });
            }

            var idea = await database.Ideas.FirstOrDefaultAsync(
                record => record.Id == id && record.StudentId == profile.Id,
                http.RequestAborted);
            if (idea is null || idea.Status == IdeaSubmissionStatus.Deleted)
            {
                return Results.NotFound(new { message = "Fikir bulunamadı." });
            }

            if (idea.Status != IdeaSubmissionStatus.Draft)
            {
                return Conflict("Gönderilmiş fikir değiştirilemez.");
            }

            if (!await IsActiveCategoryAsync(database, request.CategoryId, http.RequestAborted))
            {
                return InvalidCategory();
            }

            idea.UpdateDraft(request.CategoryId, request.Content, clock.UtcNow);
            await database.SaveChangesAsync(http.RequestAborted);

            return Results.Ok(new
            {
                idea.Id,
                status = idea.Status.ToString(),
                idea.UpdatedAt
            });
        });

        group.MapPost("/{id:guid}/submit", async (
            Guid id,
            UserManager<ApplicationUser> userManager,
            FikirPlatformuDbContext database,
            SubmitIdeaService submitIdeaService,
            HttpContext http) =>
        {
            var profile = await GetProfileAsync(userManager, database, http);
            if (profile is null)
            {
                return Results.NotFound(new { message = "Öğrenci profili bulunamadı." });
            }

            var categoryId = await database.Ideas
                .Where(idea => idea.Id == id && idea.StudentId == profile.Id)
                .Select(idea => (int?)idea.CategoryId)
                .FirstOrDefaultAsync(http.RequestAborted);
            if (categoryId is null)
            {
                return Results.NotFound(new { message = "Fikir bulunamadı." });
            }

            if (!await IsActiveCategoryAsync(database, categoryId.Value, http.RequestAborted))
            {
                return InvalidCategory();
            }

            var result = await submitIdeaService.SubmitAsync(
                new SubmitIdeaRequest(id, profile.Id, profile.ProvinceId),
                http.RequestAborted);

            if (result.IsSuccess)
            {
                return Results.Ok(new
                {
                    result.IdeaId,
                    status = IdeaSubmissionStatus.Submitted.ToString(),
                    result.RequiresReview,
                    message = "Fikriniz İl AR-GE değerlendirmesine gönderildi."
                });
            }

            return result.ErrorCode switch
            {
                SubmitIdeaError.NotFound => Results.NotFound(new { message = result.Error }),
                SubmitIdeaError.NotDraft => Conflict(result.Error!),
                SubmitIdeaError.InvalidContent => Results.ValidationProblem(
                    new Dictionary<string, string[]> { ["content"] = [result.Error!] }),
                SubmitIdeaError.BlockedContent => Results.ValidationProblem(
                    new Dictionary<string, string[]> { ["content"] = [result.Error!] }),
                _ => Results.Problem(statusCode: StatusCodes.Status500InternalServerError)
            };
        });

        group.MapDelete("/{id:guid}", async (
            Guid id,
            UserManager<ApplicationUser> userManager,
            FikirPlatformuDbContext database,
            IClock clock,
            HttpContext http) =>
        {
            var profile = await GetProfileAsync(userManager, database, http);
            if (profile is null)
            {
                return Results.NotFound(new { message = "Öğrenci profili bulunamadı." });
            }

            var idea = await database.Ideas.FirstOrDefaultAsync(
                record => record.Id == id && record.StudentId == profile.Id,
                http.RequestAborted);
            if (idea is null || idea.Status == IdeaSubmissionStatus.Deleted)
            {
                return Results.NotFound(new { message = "Fikir bulunamadı." });
            }

            if (idea.Status != IdeaSubmissionStatus.Draft)
            {
                return Conflict("Bu aşamadaki fikir öğrenci tarafından silinemez.");
            }

            idea.DeleteDraft(clock.UtcNow);
            await database.SaveChangesAsync(http.RequestAborted);
            return Results.NoContent();
        });

        return app;
    }

    private static async Task<Domain.Students.StudentProfile?> GetProfileAsync(
        UserManager<ApplicationUser> userManager,
        FikirPlatformuDbContext database,
        HttpContext http)
    {
        var userId = userManager.GetUserId(http.User);
        if (userId is null)
        {
            return null;
        }

        return await database.StudentProfiles
            .FirstOrDefaultAsync(
                profile => profile.ApplicationUserId == userId,
                http.RequestAborted);
    }

    private static Task<bool> IsActiveCategoryAsync(
        FikirPlatformuDbContext database,
        int categoryId,
        CancellationToken cancellationToken) =>
        database.IdeaCategories.AnyAsync(
            category => category.Id == categoryId && category.IsActive,
            cancellationToken);

    private static IResult? ValidateContent(string? content)
    {
        if (content is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["content"] = ["Fikir metni zorunludur."]
            });
        }

        if (content.Length > Idea.MaxContentLength)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["content"] = [$"Fikir metni en fazla {Idea.MaxContentLength} karakter olabilir."]
            });
        }

        return null;
    }

    private static IResult InvalidCategory() =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["categoryId"] = ["Geçerli ve aktif bir kategori seçmelisiniz."]
        });

    private static IResult Conflict(string message) =>
        Results.Json(new { message }, statusCode: StatusCodes.Status409Conflict);

    public sealed record SaveDraftRequest(
        [Range(1, int.MaxValue)] int CategoryId,
        [Required, StringLength(2000, MinimumLength = 10)] string Content);

    // ===== Sprint 11.92 — KVKK yayım rızası =====
    public sealed record YayimRisasiIstegi([Required] bool Onay);

    /// <summary>
    /// Yayım açık rızasını ver / geri çek.
    /// Kanun 3. madde gereği rıza HER ZAMAN geri alınabilir. Geri çekildiğinde
    /// fikir değerlendirme akışında kalır, yalnızca ana sayfada yayımlanmaz
    /// (2026/1301 sayılı kamu kurumu paylaşım kararı: amaçla bağlantılı,
    /// sınırlı ve ölçülü olma ilkesi).
    /// </summary>
    private static void MapYayimRizasiEndpoints(RouteGroupBuilder grup)
    {
        grup.MapPost("/yayim-risasi", async (
            YayimRisasiIstegi istek,
            HttpContext http,
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var simdi = DateTimeOffset.UtcNow;
            var ip = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString());
            var ua = http.Request.Headers.UserAgent.ToString() ?? "";

            if (istek.Onay)
            {
                // Daha önce iptal edilmişse YENİDEN onay: iptal kaydı kapatılır.
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE kvkk_rizalari SET iptal_at = NULL WHERE user_id = {0} AND tur = 'yayim'",
                    cancellationToken, userId);

                var varMi = await db.Database.SqlQueryRawAsync<int>(
                        "SELECT COUNT(*) FROM kvkk_rizalari WHERE user_id = {0} AND tur = 'yayim'",
                        cancellationToken, userId)
                    .FirstOrDefaultAsync(cancellationToken);
                if (varMi == 0)
                {
                    await db.Database.ExecuteSqlRawAsync(
                        "INSERT INTO kvkk_rizalari (id, user_id, tur, metin_versiyonu, verildi_at, ip_adresi, user_agent) " +
                        "VALUES ({0}, {1}, 'yayim', '2026-09-10', {2}, {3}, {4})",
                        cancellationToken, Guid.NewGuid().ToString(), userId, simdi.UtcDateTime, ip, ua);
                }
            }
            else
            {
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE kvkk_rizalari SET iptal_at = {0} " +
                    "WHERE user_id = {1} AND tur = 'yayim' AND iptal_at IS NULL",
                    cancellationToken, simdi.UtcDateTime, userId);
            }

            return Results.Ok(new
            {
                yayimRizasiVerildi = istek.Onay,
                mesaj = istek.Onay
                    ? "Yayımlama izniniz alındı. Adınız maskeli olarak (örn. \"Elif Y.\") ana sayfada görünebilir."
                    : "Yayımlama izniniz geri çekildi. Fikriniz değerlendirmeye devam eder, ancak ana sayfada görünmez.",
            });
        });

        grup.MapGet("/yayim-risasi", async (
            HttpContext http,
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var varMi = await db.Database.SqlQueryRawAsync<int>(
                    "SELECT COUNT(*) FROM kvkk_rizalari " +
                    "WHERE user_id = {0} AND tur = 'yayim' AND iptal_at IS NULL",
                    cancellationToken, userId)
                .FirstOrDefaultAsync(cancellationToken);

            return Results.Ok(new { yayimRizasiVar = varMi > 0 });
        });
    }
}
