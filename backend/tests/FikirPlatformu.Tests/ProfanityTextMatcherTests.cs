using FikirPlatformu.Infrastructure.Moderation;

namespace FikirPlatformu.Tests;

public sealed class ProfanityTextMatcherTests
{
    [Theory]
    [InlineData("Bu metinde kaba bir söz var.")]
    [InlineData("Bu metinde KABA bir söz var.")]
    [InlineData("Bu metinde k-a-b-a bir söz var.")]
    [InlineData("Bu metinde k...aaa...b-a bir söz var.")]
    [InlineData("Bu metinde k4b4 bir söz var.")]
    public void IsMatch_DetectsNormalizedAndObfuscatedWholeWord(string content)
    {
        var term = ProfanityTextMatcher.NormalizeTerm("kaba");

        Assert.True(ProfanityTextMatcher.IsMatch(content, term));
    }

    [Theory]
    [InlineData("Bu bir kabahat değildir.")]
    [InlineData("Bu metin tamamen uygundur.")]
    [InlineData("")]
    public void IsMatch_DoesNotMatchInsideAnotherWord(string content)
    {
        var term = ProfanityTextMatcher.NormalizeTerm("kaba");

        Assert.False(ProfanityTextMatcher.IsMatch(content, term));
    }
}
