using System.ComponentModel.DataAnnotations;
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
}
