using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Ideas;

public interface IIdeaRepository
{
    Task AddAsync(Idea idea, CancellationToken cancellationToken = default);
}
