using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaRepository(FikirPlatformuDbContext context) : IIdeaRepository
{
    public async Task AddAsync(Idea idea, CancellationToken cancellationToken = default)
    {
        await context.Ideas.AddAsync(idea, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }
}
