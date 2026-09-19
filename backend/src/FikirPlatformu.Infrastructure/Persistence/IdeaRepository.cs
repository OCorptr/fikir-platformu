using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaRepository(FikirPlatformuDbContext context) : IIdeaRepository
{
    public Task<Idea?> GetOwnedAsync(
        Guid ideaId,
        Guid studentId,
        CancellationToken cancellationToken = default) =>
        context.Ideas.FirstOrDefaultAsync(
            idea => idea.Id == ideaId && idea.StudentId == studentId,
            cancellationToken);

    public Task<Idea?> GetForProvinceAsync(
        Guid ideaId,
        int provinceId,
        CancellationToken cancellationToken = default) =>
        context.Ideas.FirstOrDefaultAsync(
            idea => idea.Id == ideaId && idea.ProvinceId == provinceId,
            cancellationToken);

    public Task<Idea?> GetForAnyProvinceAsync(
        Guid ideaId,
        CancellationToken cancellationToken = default) =>
        context.Ideas.FirstOrDefaultAsync(
            idea => idea.Id == ideaId,
            cancellationToken);

    public async Task AddAsync(Idea idea, CancellationToken cancellationToken = default)
    {
        await context.Ideas.AddAsync(idea, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        context.SaveChangesAsync(cancellationToken);
}
