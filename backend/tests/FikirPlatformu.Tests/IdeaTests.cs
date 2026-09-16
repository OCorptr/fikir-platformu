using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Tests;

public sealed class IdeaTests
{
    private static readonly DateTimeOffset InitialTime =
        new(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void CreateDraft_AllowsExactlyMaximumLength()
    {
        var idea = Idea.CreateDraft(
            Guid.NewGuid(),
            provinceId: 6,
            categoryId: 3,
            new string('a', Idea.MaxContentLength),
            InitialTime);

        Assert.Equal(Idea.MaxContentLength, idea.Content.Length);
        Assert.Equal(IdeaSubmissionStatus.Draft, idea.Status);
    }

    [Fact]
    public void CreateDraft_RejectsContentOverMaximumLength()
    {
        var exception = Assert.Throws<ArgumentOutOfRangeException>(() => Idea.CreateDraft(
            Guid.NewGuid(),
            provinceId: 6,
            categoryId: 3,
            new string('a', Idea.MaxContentLength + 1),
            InitialTime));

        Assert.Contains("1500", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void CreateDraft_CountsLeadingAndTrailingSpacesInLimit()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Idea.CreateDraft(
            Guid.NewGuid(),
            provinceId: 6,
            categoryId: 3,
            $" {new string('a', Idea.MaxContentLength - 1)} ",
            InitialTime));
    }

    [Fact]
    public void Submit_CopiesProvinceAtSubmissionTime()
    {
        var idea = Idea.CreateDraft(
            Guid.NewGuid(),
            provinceId: 6,
            categoryId: 3,
            "Okulumuz için geri dönüşüm fikri",
            InitialTime);
        var submittedAt = InitialTime.AddHours(2);

        idea.Submit(provinceId: 34, submittedAt);

        Assert.Equal(34, idea.ProvinceId);
        Assert.Equal(IdeaSubmissionStatus.Submitted, idea.Status);
        Assert.Equal(submittedAt, idea.SubmittedAt);
        Assert.Equal(submittedAt, idea.UpdatedAt);
    }

    [Fact]
    public void Submit_RejectsEmptyDraft()
    {
        var idea = Idea.CreateDraft(
            Guid.NewGuid(),
            provinceId: 6,
            categoryId: 3,
            "   ",
            InitialTime);

        Assert.Throws<InvalidOperationException>(() => idea.Submit(6, InitialTime.AddMinutes(1)));
    }

    [Fact]
    public void SubmittedIdea_CannotBeEditedOrDeletedByStudent()
    {
        var idea = Idea.CreateDraft(
            Guid.NewGuid(),
            provinceId: 6,
            categoryId: 3,
            "Bir fikir",
            InitialTime);
        idea.Submit(6, InitialTime.AddMinutes(1));

        Assert.Throws<InvalidOperationException>(() =>
            idea.UpdateDraft(4, "Değiştirildi", InitialTime.AddMinutes(2)));
        Assert.Throws<InvalidOperationException>(() =>
            idea.DeleteDraft(InitialTime.AddMinutes(2)));
    }
}
