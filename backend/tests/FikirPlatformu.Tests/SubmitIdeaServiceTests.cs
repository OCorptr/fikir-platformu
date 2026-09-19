using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Moderation;
using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Tests;

public sealed class SubmitIdeaServiceTests
{
    [Fact]
    public async Task SubmitAsync_WhenAllowed_SubmitsOwnedDraftForCurrentProvince()
    {
        var studentId = Guid.NewGuid();
        var idea = Idea.CreateDraft(
            studentId,
            provinceId: 6,
            categoryId: 3,
            "Enerji tasarrufu fikri",
            TestClock.Time.AddHours(-1));
        var repository = new FakeIdeaRepository(idea);
        var service = new SubmitIdeaService(
            repository,
            new FakeProfanityFilter(ProfanityFilterResult.Allowed),
            new TestClock());

        var result = await service.SubmitAsync(new SubmitIdeaRequest(idea.Id, studentId, 34));

        Assert.True(result.IsSuccess);
        Assert.Equal(IdeaSubmissionStatus.Submitted, idea.Status);
        Assert.Equal(34, idea.ProvinceId);
        Assert.True(repository.WasSaved);
    }

    [Fact]
    public async Task SubmitAsync_WhenBlocked_LeavesDraftUnchanged()
    {
        var studentId = Guid.NewGuid();
        var idea = Idea.CreateDraft(
            studentId,
            provinceId: 6,
            categoryId: 3,
            "Engellenecek örnek metin",
            TestClock.Time.AddHours(-1));
        var repository = new FakeIdeaRepository(idea);
        var service = new SubmitIdeaService(
            repository,
            new FakeProfanityFilter(new ProfanityFilterResult(true, false)),
            new TestClock());

        var result = await service.SubmitAsync(new SubmitIdeaRequest(idea.Id, studentId, 34));

        Assert.False(result.IsSuccess);
        Assert.Equal(SubmitIdeaError.BlockedContent, result.ErrorCode);
        Assert.Equal(IdeaSubmissionStatus.Draft, idea.Status);
        Assert.False(repository.WasSaved);
    }

    [Fact]
    public async Task SubmitAsync_WhenDraftIsBlank_ReturnsValidationFailure()
    {
        var studentId = Guid.NewGuid();
        var idea = Idea.CreateDraft(
            studentId,
            provinceId: 6,
            categoryId: 3,
            "   ",
            TestClock.Time.AddHours(-1));
        var repository = new FakeIdeaRepository(idea);
        var service = new SubmitIdeaService(
            repository,
            new FakeProfanityFilter(ProfanityFilterResult.Allowed),
            new TestClock());

        var result = await service.SubmitAsync(new SubmitIdeaRequest(idea.Id, studentId, 6));

        Assert.False(result.IsSuccess);
        Assert.Equal(SubmitIdeaError.InvalidContent, result.ErrorCode);
        Assert.False(repository.WasSaved);
    }

    private sealed class FakeIdeaRepository(Idea idea) : IIdeaRepository
    {
        public bool WasSaved { get; private set; }

        public Task<Idea?> GetOwnedAsync(
            Guid ideaId,
            Guid studentId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<Idea?>(
                idea.Id == ideaId && idea.StudentId == studentId ? idea : null);

        public Task<Idea?> GetForProvinceAsync(
            Guid ideaId,
            int provinceId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<Idea?>(
                idea.Id == ideaId && idea.ProvinceId == provinceId ? idea : null);

        public Task AddAsync(Idea value, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            WasSaved = true;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeProfanityFilter(ProfanityFilterResult result) : IProfanityFilter
    {
        public Task<ProfanityFilterResult> CheckAsync(
            string content,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(result);
    }

    private sealed class TestClock : IClock
    {
        public static readonly DateTimeOffset Time =
            new(2026, 9, 16, 15, 0, 0, TimeSpan.Zero);

        public DateTimeOffset UtcNow => Time;
    }
}
