using System.Text.Json.Serialization;

namespace FikirPlatformu.Domain.Evaluations;

/// <summary>
/// Plan §20: değerlendirme kriterleri. Sıra ve Türkçe isimler kaynak belgede yer alan
/// listeden alınmıştır; değişiklik karar günlüğü §44'te işlenir.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EvaluationCriterion
{
    Yenilikcilik = 1,
    Uygulanabilirlik = 2,
    Etki = 3,
    Ozgunluk = 4,
}
