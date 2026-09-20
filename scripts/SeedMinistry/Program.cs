using Npgsql;

var connString = "Host=localhost;Port=5432;Database=fikir_platformu;Username=postgres;Password=Fikir2026!";

await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();
Console.WriteLine("[OK] DB bağlantısı açıldı.");

// 1) mevcut durum: kaç öğrenci + kaç fikir
var (studentCount, ideaCount, lockedCount, plannedCount) = await ReadCounts(conn);
Console.WriteLine($"[INFO] Students={studentCount}, Ideas={ideaCount}, Locked={lockedCount}, Planned={plannedCount}");

// 2) IdeaCandidates: Locked olabilecek 3 fikir seç (Submitted durumda, kategori çeşitliliği için)
var candidates = await SelectLockCandidates(conn, take: 3);
if (candidates.Count < 3)
{
    Console.Error.WriteLine($"[HATA] En az 3 Submitted fikir gerekli. Bulunan={candidates.Count}");
    return 1;
}
Console.WriteLine($"[INFO] Locked adayları:");
foreach (var c in candidates)
    Console.WriteLine($"   - {c.Id} | kat={c.CategoryId} | prov={c.ProvinceId} | {Truncate(c.Content, 50)}");

// 3) 3 fikri Locked'a çek
foreach (var c in candidates)
{
    await Exec(conn,
        "UPDATE ideas SET status='Locked' WHERE id=@id",
        ("id", c.Id));
}
Console.WriteLine("[OK] 3 fikir Locked yapıldı.");

// 4) Period oluştur (3 aylık, Open durumda)
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

// 5) ministry@local kullanıcı id'sini bul
var ministryUserId = await ReadScalar(conn, "SELECT \"Id\" FROM \"AspNetUsers\" WHERE \"Email\"='ministry@local' LIMIT 1");
if (string.IsNullOrEmpty(ministryUserId))
{
    Console.Error.WriteLine("[HATA] ministry@local kullanıcısı bulunamadı. Önce seed çalıştırın.");
    return 1;
}
Console.WriteLine($"[INFO] ministry user id: {ministryUserId}");

// 6) PeriodSelections: 3 fikri farklı kategorilerde seç
var selectedAt = DateTimeOffset.UtcNow;
foreach (var c in candidates)
{
    await Exec(conn,
        @"INSERT INTO period_selections (period_id, category_id, idea_id, selected_by_user_id, selected_at)
          VALUES (@p, @c, @i, @u, @s)
          ON CONFLICT (period_id, category_id) DO NOTHING",
        ("p", periodId),
        ("c", c.CategoryId),
        ("i", c.Id),
        ("u", ministryUserId),
        ("s", selectedAt));
}
Console.WriteLine("[OK] PeriodSelections eklendi (3 kategori).");

// 7) doğrulama
var (s2, i2, l2, p2) = await ReadCounts(conn);
Console.WriteLine($"[INFO] Son durum: Students={s2}, Ideas={i2}, Locked={l2}, Planned={p2}");

var periodCount = await ReadScalar(conn, "SELECT COUNT(*) FROM periods");
var selCount = await ReadScalar(conn, "SELECT COUNT(*) FROM period_selections");
Console.WriteLine($"[INFO] periods={periodCount}, period_selections={selCount}");

Console.WriteLine("\n=== SEED TAMAMLANDI ===");
Console.WriteLine($"Bakanlık panelinde göreceklerin:");
Console.WriteLine($"  - Period: 2026-Q4 (Ekim-Aralık) [Open]");
Console.WriteLine($"  - 3 Locked fikir (kategorilerine göre aday havuzunda)");
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

static async Task<List<IdeaRow>> SelectLockCandidates(NpgsqlConnection conn, int take)
{
    var list = new List<IdeaRow>();
    await using var cmd = new NpgsqlCommand(
        @"SELECT id, category_id, province_id, content
          FROM ideas
          WHERE status='Submitted'
          ORDER BY category_id, submitted_at
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
