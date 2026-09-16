using FikirPlatformu.Application.Moderation;
using FikirPlatformu.Domain.Moderation;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Moderation;

public sealed class DatabaseProfanityFilter(FikirPlatformuDbContext context) : IProfanityFilter
{
    public async Task<ProfanityFilterResult> CheckAsync(
        string content,
        CancellationToken cancellationToken = default)
    {
        var terms = await context.BlockedTerms
            .AsNoTracking()
            .Where(term => term.IsActive)
            .Select(term => new { term.NormalizedTerm, term.Action })
            .ToListAsync(cancellationToken);

        var requiresReview = false;
        foreach (var term in terms)
        {
            if (!ProfanityTextMatcher.IsMatch(content, term.NormalizedTerm))
            {
                continue;
            }

            if (term.Action == BlockedTermAction.Block)
            {
                return new ProfanityFilterResult(IsBlocked: true, RequiresReview: false);
            }

            requiresReview = true;
        }

        return new ProfanityFilterResult(IsBlocked: false, RequiresReview: requiresReview);
    }
}
