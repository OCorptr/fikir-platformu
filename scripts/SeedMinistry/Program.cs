using Npgsql;

var connString = "Host=localhost;Port=5432;Database=fikir_platformu;Username=postgres;Password=Fikir2026!";

await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();
Console.WriteLine("[OK] DB bağlantısı açıldı.");

// 0) ÖNCE temizle: mevcut Locked + PeriodSelection'ı sıfırla (idempotent)
var lockedIds = await ReadIds(conn, "SELECT id FROM ideas WHERE status='Locked'");
foreach (var id in lockedIds)
{
    await Exec(conn, "UPDATE ideas SET status='Submitted' WHERE id=@id", ("id", id));
}
if (lockedIds.Count > 0)
    Console.WriteLine($"[CLEAN] {lockedIds.Count} Locked → Submitted geri alındı.");

var newPeriodIds = await ReadIds(conn, "SELECT id FROM periods WHERE label LIKE '2026-Q4%'");
foreach (var pid in newPeriodIds)
{
    await Exec(conn, "DELETE FROM period_selections WHERE period_id=@p", ("p", pid));
    await Exec(conn, "DELETE FROM periods WHERE id=@p", ("p", pid));
}
if (newPeriodIds.Count > 0)
    Console.WriteLine($"[CLEAN] {newPeriodIds.Count} 2026-Q4 period + seçimleri silindi.");

// 1) mevcut durum
var (studentCount, ideaCount, lockedCount, plannedCount) = await ReadCounts(conn);
Console.WriteLine($"[INFO] Students={studentCount}, Ideas={ideaCount}, Locked={lockedCount}, Planned={plannedCount}");

// 2) 3 farklı kategoriden Locked adayı seç
var candidates = await SelectLockCandidatesByCategory(conn, take: 3);
if (candidates.Count < 3)
{
    Console.Error.WriteLine($"[HATA] En az 3 farklı kategori gerekli. Bulunan={candidates.Count}");
    return 1;
}
Console.WriteLine($"[INFO] {candidates.Count} farklı kategoriden Locked adayları:");
foreach (var c in candidates)
    Console.WriteLine($"   - kat={c.CategoryId} prov={c.ProvinceId} | {Truncate(c.Content, 60)}");

// 3) Locked'a çek
foreach (var c in candidates)
{
    await Exec(conn, "UPDATE ideas SET status='Locked' WHERE id=@id", ("id", c.Id));
}
Console.WriteLine("[OK] 3 fikir (3 farklı kategori) Locked yapıldı.");

// 4) Period oluştur
var periodId = Guid.NewGuid();
var startAt = DateTimeOffset.UtcNow.AddDays(-7);
var endAt = startAt.AddMonths(3);
await Exec(conn,
    @"INSERT INTO periods (id, label, start_at, end_at, status, created_at)
      VALUES (@id, @label, @start, @end, 'Open', @created)",
    ("id", periodId),
    ("label", $"2026-Q4 (Ekim-Aralık)"),
    ("start", startAt),
    ("end", endAt),
    ("created", DateTimeOffset.UtcNow));
Console.WriteLine($"[OK] Period oluşturuldu: {periodId}");

// 5) ministry kullanıcı
var ministryUserId = await ReadScalar(conn, "SELECT \"Id\" FROM \"AspNetUsers\" WHERE \"Email\"='ministry@local' LIMIT 1");
if (string.IsNullOrEmpty(ministryUserId))
{
    Console.Error.WriteLine("[HATA] ministry@local bulunamadı.");
    return 1;
}
Console.WriteLine($"[INFO] ministry user id: {ministryUserId}");

// 6) PeriodSelections: her bir Locked fikri kendi kategorisinde seç
var selectedAt = DateTimeOffset.UtcNow;
foreach (var c in candidates)
{
    await Exec(conn,
        @"INSERT INTO period_selections (period_id, category_id, idea_id, selected_by_user_id, selected_at)
          VALUES (@p, @c, @i, @u, @s)",
        ("p", periodId),
        ("c", c.CategoryId),
        ("i", c.Id),
        ("u", ministryUserId),
        ("s", selectedAt));
}
Console.WriteLine("[OK] PeriodSelections eklendi (3 farklı kategori).");

// 7) doğrulama
var (s2, i2, l2, p2) = await ReadCounts(conn);
Console.WriteLine($"[INFO] Son durum: Students={s2}, Ideas={i2}, Locked={l2}, Planned={p2}");
Console.WriteLine($"[INFO] periods={await ReadScalar(conn, "SELECT COUNT(*) FROM periods")}, " +
                  $"period_selections={await ReadScalar(conn, "SELECT COUNT(*) FROM period_selections")}");

Console.WriteLine("\n=== SEED TAMAMLANDI ===");
Console.WriteLine($"Bakanlık panelinde göreceklerin:");
Console.WriteLine($"  - Period: 2026-Q4 (Ekim-Aralık) [Open]");
Console.WriteLine($"  - 3 Locked fikir (her biri farklı kategoride)");
return 0;

static string Truncate(string s, int n) => s.Length <= n ? s : s.Substring(0, n) + "...";

static async Task<(int s, int i, int l, int p)> ReadCounts(NpgsqlConnection conn)
{
    await using var cmd = new NpgsqlCommand(
        @"SELECT
            (SELECT COUNT(*) FROM ""AspNetUsers"" WHERE ""Email"" LIKE '%@local') AS s,
            (SELECT COUNT(*) FROM ideas) AS i,
            (SELECT COUNT(*) FROM ideas WHERE status='Locked') AS l,
            (SELECT COUNT(*) FROM ideas WHERE status='Planned') AS p", conn);
    await using var r = await cmd.ExecuteReaderAsync();
    await r.ReadAsync();
    return (r.GetInt32(0), r.GetInt32(1), r.GetInt32(2), r.GetInt32(3));
}

static async Task<List<Guid>> ReadIds(NpgsqlConnection conn, string sql)
{
    var list = new List<Guid>();
    await using var cmd = new NpgsqlCommand(sql, conn);
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync()) list.Add(r.GetGuid(0));
    return list;
}

static async Task<List<IdeaRow>> SelectLockCandidatesByCategory(NpgsqlConnection conn, int take)
{
    var list = new List<IdeaRow>();
    await using var cmd = new NpgsqlCommand(
        @"SELECT DISTINCT ON (category_id) id, category_id, province_id, content
          FROM ideas
          WHERE status='Submitted'
          ORDER BY category_id, submitted_at ASC
          LIMIT @n", conn);
    cmd.Parameters.AddWithValue("n", take);
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync())
    {
        list.Add(new IdeaRow(r.GetGuid(0), r.GetInt32(1), r.GetInt32(2), r.GetString(3)));
    }
    return list;
}

static async Task<string?> ReadScalar(NpgsqlConnection conn, string sql)
{
    await using var cmd = new NpgsqlCommand(sql, conn);
    var v = await cmd.ExecuteScalarAsync();
    return v?.ToString();
}

static async Task Exec(NpgsqlConnection conn, string sql, params (string name, object val)[] parameters)
{
    await using var cmd = new NpgsqlCommand(sql, conn);
    foreach (var (name, val) in parameters)
        cmd.Parameters.AddWithValue(name, val);
    await cmd.ExecuteNonQueryAsync();
}

record IdeaRow(Guid Id, int CategoryId, int ProvinceId, string Content);
