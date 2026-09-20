using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Ministry;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class ProvinceInboxQueryService(FikirPlatformuDbContext db) : IProvinceInboxQueryService
{
    // Aday havuzu eşiği (plan §26): ortalama puan bu eşiği geçen fikirler bakanlığa aday olur.
    private const double AdayEsik = 3.5;

    public async Task<IReadOnlyList<InboxEntry>> ListAsync(
        int provinceId,
        string currentUserId,
        CancellationToken cancellationToken = default)
    {
        // Sadece gönderilmiş fikirler (taslak/silinmiş hariç) ve bu ile ait olanlar.
        // StudentProfile + ApplicationUser join ile öğrenci bilgisi çekilir (Idea'da navigation yok).
        var raw = await (
            from fikir in db.Ideas.AsNoTracking()
            where fikir.ProvinceId == provinceId
                && (fikir.Status == IdeaSubmissionStatus.Submitted
                    || fikir.Status == IdeaSubmissionStatus.InEvaluation
                    || fikir.Status == IdeaSubmissionStatus.EvaluationCompleted)
            join profil in db.StudentProfiles.AsNoTracking() on fikir.StudentId equals profil.Id
            join kullanici in db.Users.AsNoTracking() on profil.ApplicationUserId equals kullanici.Id
            join il in db.Provinces.AsNoTracking() on profil.ProvinceId equals il.Id
            join kategori in db.IdeaCategories.AsNoTracking() on fikir.CategoryId equals kategori.Id
            join fikirIl in db.Provinces.AsNoTracking() on fikir.ProvinceId equals fikirIl.Id
            orderby (fikir.SubmittedAt ?? fikir.UpdatedAt) descending
            select new
            {
                fikir.Id,
                fikir.CategoryId,
                CategoryName = kategori.Name,
                fikir.ProvinceId,
                ProvinceName = fikirIl.Name,
                fikir.Content,
                SubmittedAt = fikir.SubmittedAt ?? fikir.UpdatedAt,
                kullanici.FirstName,
                kullanici.LastName,
                profil.School,
                profil.Grade,
                profil.StudentNumber,
            }
        ).ToListAsync(cancellationToken);

        if (raw.Count == 0) return Array.Empty<InboxEntry>();

        var ideaIds = raw.Select(r => r.Id).ToList();

        var assignments = await db.IdeaAssignments
            .AsNoTracking()
            .Where(a => ideaIds.Contains(a.IdeaId))
            .Select(a => new { a.IdeaId, a.EvaluatorUserId })
            .ToListAsync(cancellationToken);

        var reads = await db.IdeaReadReceipts
            .AsNoTracking()
            .Where(r => ideaIds.Contains(r.IdeaId) && r.UserId == currentUserId)
            .Select(r => new { r.IdeaId, r.ReadAt })
            .ToListAsync(cancellationToken);

        // Ortalama puan + değerlendirme sayısı + son tarih tek sorguda.
        var evaluations = await db.Evaluations
            .AsNoTracking()
            .Where(e => ideaIds.Contains(e.IdeaId))
            .GroupBy(e => e.IdeaId)
            .Select(g => new
            {
                IdeaId = g.Key,
                Count = g.Count(),
                LastAt = g.Max(e => (DateTimeOffset?)e.EvaluatedAt),
                Avg = g.Average(e => (double?)e.Score),
            })
            .ToListAsync(cancellationToken);

        // Aktif dönemde bakanlık tarafından seçilmiş fikirler (Ayın Fikri rozeti).
        var aktifDonemId = await db.Periods.AsNoTracking()
            .Where(p => p.Status == PeriodStatus.Open)
            .OrderByDescending(p => p.StartAt)
            .Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync(cancellationToken);
        var secilmisIdeaIds = aktifDonemId.HasValue
            ? await db.PeriodSelections.AsNoTracking()
                .Where(s => s.PeriodId == aktifDonemId.Value)
                .Select(s => s.IdeaId)
                .ToListAsync(cancellationToken)
            : new List<Guid>();

        var assignmentMap = assignments
            .GroupBy(a => a.IdeaId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(a => a.EvaluatorUserId).ToList());
        var readMap = reads.ToDictionary(r => r.IdeaId, r => r.ReadAt);
        var evalMap = evaluations.ToDictionary(e => e.IdeaId);
        var secilmisSet = secilmisIdeaIds.ToHashSet();

        return raw.Select(r => new InboxEntry(
            r.Id,
            r.CategoryId,
            r.CategoryName,
            r.ProvinceId,
            r.ProvinceName,
            r.Content,
            r.SubmittedAt,
            r.FirstName,
            r.LastName,
            r.School,
            r.Grade,
            r.StudentNumber,
            assignmentMap.TryGetValue(r.Id, out var evals) ? evals : Array.Empty<string>(),
            readMap.ContainsKey(r.Id),
            readMap.TryGetValue(r.Id, out var readAt) ? readAt : null,
            evalMap.TryGetValue(r.Id, out var ev) ? ev.Count : 0,
            evalMap.TryGetValue(r.Id, out var ev2) ? ev2.LastAt : null,
            evalMap.TryGetValue(r.Id, out var ev3) && ev3.Avg.HasValue ? Math.Round(ev3.Avg.Value, 2) : (double?)null,
            secilmisSet.Contains(r.Id))).ToList();
    }
}
