using System.Globalization;
using System.Text;

namespace FikirPlatformu.Infrastructure.Moderation;

public static class ProfanityTextMatcher
{
    private static readonly CultureInfo TurkishCulture = CultureInfo.GetCultureInfo("tr-TR");

    public static string NormalizeTerm(string term)
    {
        ArgumentNullException.ThrowIfNull(term);

        var canonical = Canonicalize(term);
        var result = new StringBuilder(canonical.Length);
        char? previous = null;

        foreach (var character in canonical)
        {
            if (!char.IsLetterOrDigit(character))
            {
                continue;
            }

            if (previous == character)
            {
                continue;
            }

            result.Append(character);
            previous = character;
        }

        return result.ToString();
    }

    public static bool IsMatch(string content, string normalizedTerm)
    {
        if (string.IsNullOrWhiteSpace(content) || string.IsNullOrWhiteSpace(normalizedTerm))
        {
            return false;
        }

        var canonical = Canonicalize(content);

        for (var start = 0; start < canonical.Length; start++)
        {
            if (canonical[start] != normalizedTerm[0]
                || start > 0 && char.IsLetterOrDigit(canonical[start - 1]))
            {
                continue;
            }

            var contentIndex = start;
            var termIndex = 0;

            while (termIndex < normalizedTerm.Length && contentIndex < canonical.Length)
            {
                var expected = normalizedTerm[termIndex];
                if (canonical[contentIndex] != expected)
                {
                    break;
                }

                while (contentIndex < canonical.Length && canonical[contentIndex] == expected)
                {
                    contentIndex++;
                }

                termIndex++;
                if (termIndex < normalizedTerm.Length)
                {
                    while (contentIndex < canonical.Length
                           && !char.IsLetterOrDigit(canonical[contentIndex]))
                    {
                        contentIndex++;
                    }
                }
            }

            if (termIndex == normalizedTerm.Length
                && (contentIndex == canonical.Length
                    || !char.IsLetterOrDigit(canonical[contentIndex])))
            {
                return true;
            }
        }

        return false;
    }

    private static string Canonicalize(string value)
    {
        var lower = value.Normalize(NormalizationForm.FormKC).ToLower(TurkishCulture);
        var result = new StringBuilder(lower.Length);

        foreach (var character in lower)
        {
            result.Append(character switch
            {
                '0' => 'o',
                '1' => 'i',
                '3' => 'e',
                '4' => 'a',
                '5' => 's',
                '7' => 't',
                '8' => 'b',
                _ => character
            });
        }

        return result.ToString();
    }
}
