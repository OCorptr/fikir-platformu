using System.ComponentModel.DataAnnotations;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Sistem yöneticisi (SystemAdmin) endpoint'leri (Sprint 9).
/// Tüm endpoint'ler "SystemAdminOnly" policy ile korunuyor: MFA doğrulanmış + SystemAdmin rolü.
/// - POST /api/admin/users: yeni kullanıcı oluştur (rol atanır, MFA zorunluysa zorla)
/// - GET /api/admin/users: kullanıcı listesi (filtre: rol, sayfalama)
/// </summary>
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/admin").WithTags("Sistem Yönetimi");

        // 1) Yeni kullanıcı oluştur (Sprint 9).
        grup.MapPost("/users", async (
            YeniKullaniciIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HttpContext http) =>
        {
            // Rol whitelist: Sistem yöneticisi sadece bu rolleri atayabilir.
            var izinliRoller = new[] { "SystemAdmin", "MinistryOfficial", "ProvinceManager", "ProvinceEvaluator" };
            if (!izinliRoller.Contains(istek.Role))
            {
                return Results.Json(new
                {
                    message = $"Geçersiz rol. İzinli roller: {string.Join(", ", izinliRoller)}"
                }, statusCode: 400);
            }

            // Email benzersizlik kontrolü.
            var mevcut = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
            if (mevcut is not null)
            {
                return Results.Json(new { message = "Bu e-posta adresi zaten kullanılıyor." }, statusCode: 409);
            }

            var kullanici = new ApplicationUser
            {
                UserName = istek.Email,
                Email = istek.Email,
                FirstName = istek.FirstName.Trim(),
                LastName = istek.LastName.Trim(),
                EmailConfirmed = true, // Admin tarafından oluşturulan kullanıcı için e-posta onaylı kabul.
                MustChangePassword = true, // İlk girişte şifre değiştirme zorunlu.
                PasswordChangedAt = DateTimeOffset.UtcNow
            };

            var sonuc = await kullaniciYoneticisi.CreateAsync(kullanici, istek.Password);
            if (!sonuc.Succeeded)
            {
                return Results.ValidationProblem(sonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            await kullaniciYoneticisi.AddToRoleAsync(kullanici, istek.Role);

            // Sprint 11.12: ProvinceManager / ProvinceEvaluator için il ataması
            // (ProvinceUserAssignment tablosuna INSERT). İl bilgisi UI'dan gelir;
            // zorunlu, ama yine de defensif kontrol yapalım.
            if (istek.Role == "ProvinceManager" || istek.Role == "ProvinceEvaluator")
            {
                if (!istek.IlKodu.HasValue || istek.IlKodu.Value <= 0)
                {
                    // Rollback: user'ı sil. Aksi halde rol atanmış ama ili olmayan user oluşur.
                    await kullaniciYoneticisi.DeleteAsync(kullanici);
                    return Results.Json(new
                    {
                        message = $"{istek.Role} rolü için il ataması zorunludur."
                    }, statusCode: 400);
                }
                var ilVarmi = await veritabani.Provinces.AnyAsync(p => p.Id == istek.IlKodu.Value, http.RequestAborted);
                if (!ilVarmi)
                {
                    await kullaniciYoneticisi.DeleteAsync(kullanici);
                    return Results.Json(new { message = "Geçersiz il kodu." }, statusCode: 400);
                }
                var atama = Domain.Identity.ProvinceUserAssignment.Create(
                    kullanici.Id, istek.IlKodu.Value, istek.Role,
                    http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
                    DateTimeOffset.UtcNow);
                veritabani.Set<Domain.Identity.ProvinceUserAssignment>().Add(atama);
            }

            // Audit log.
            veritabani.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = kullanici.Id,
                Email = KisiselVeriYardimci.EmailMaskele(kullanici.Email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.UserCreated,
                Success = true,
                FailureReason = $"role={istek.Role};il={(istek.IlKodu?.ToString() ?? "-")}",
                CreatedAt = DateTime.UtcNow
            });
            await veritabani.SaveChangesAsync(http.RequestAborted);

            return Results.Json(new
            {
                message = "Kullanıcı oluşturuldu.",
                userId = kullanici.Id,
                email = kullanici.Email,
                role = istek.Role,
                ilKodu = istek.IlKodu,
                mfaSetupRequired = true // Privileged roller için MFA kurulumu zorunlu.
            }, statusCode: 201);
        }).RequireAuthorization("SystemAdminOnly");

        // 2) Kullanıcı listesi (Sprint 9, Sprint 11.1'de Student filtreleme eklendi).
        grup.MapGet("/users", async (
            string? role,
            int sayfa,
            int sayfaBasina,
            int? ilKodu,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani) =>
        {
            sayfa = sayfa <= 0 ? 1 : sayfa;
            sayfaBasina = sayfaBasina <= 0 || sayfaBasina > 500 ? 100 : sayfaBasina;

            // Sprint 11.1 whitelist: rol parametresi whitelist'te olmalı (Student filtreleme).
            var whitelistRollar = new[] { "SystemAdmin", "MinistryOfficial", "ProvinceManager", "ProvinceEvaluator" };
            if (!string.IsNullOrWhiteSpace(role) && !whitelistRollar.Contains(role))
            {
                return Results.Json(new { message = $"Geçersiz rol filtresi. İzinli: {string.Join(", ", whitelistRollar)}" }, statusCode: 400);
            }

            // Student rolündeki kullanıcıları çıkar (Onur emri — gizlilik).
            var studentRolId = await veritabani.Roles
                .Where(r => r.Name == "Student")
                .Select(r => r.Id)
                .FirstOrDefaultAsync();
            HashSet<string>? studentIds = null;
            if (studentRolId is not null)
            {
                studentIds = (await veritabani.Set<IdentityUserRole<string>>()
                    .Where(ur => ur.RoleId == studentRolId)
                    .Select(ur => ur.UserId)
                    .ToListAsync()).ToHashSet();
            }

            // Belirli bir rol filtresi için rol-UserId eşlemesini önceden çek.
            IReadOnlyCollection<string>? rolUserIds = null;
            if (!string.IsNullOrWhiteSpace(role))
            {
                var hedefRolId = await veritabani.Roles
                    .Where(r => r.Name == role)
                    .Select(r => r.Id)
                    .FirstOrDefaultAsync();
                if (hedefRolId is null)
                {
                    return Results.Ok(new { toplam = 0, sayfa, sayfaBasina, kullanicilar = Array.Empty<object>() });
                }
                rolUserIds = await veritabani.Set<IdentityUserRole<string>>()
                    .Where(ur => ur.RoleId == hedefRolId)
                    .Select(ur => ur.UserId)
                    .ToListAsync();
            }

            // İl filtresi — ProvinceUserAssignment join.
            IReadOnlyCollection<string>? ilUserIds = null;
            if (ilKodu.HasValue && ilKodu.Value > 0)
            {
                ilUserIds = await veritabani.Set<Domain.Identity.ProvinceUserAssignment>()
                    .Where(p => p.ProvinceId == ilKodu.Value)
                    .Select(p => p.UserId)
                    .ToListAsync();
                if (ilUserIds.Count == 0)
                {
                    return Results.Ok(new { toplam = 0, sayfa, sayfaBasina, kullanicilar = Array.Empty<object>() });
                }
            }

            var sorgu = kullaniciYoneticisi.Users.AsQueryable();
            if (rolUserIds is not null)
            {
                var ids = rolUserIds; // closure için yerel değişkene al
                sorgu = sorgu.Where(u => ids.Contains(u.Id));
            }
            if (ilUserIds is not null)
            {
                var ilIds = ilUserIds;
                sorgu = sorgu.Where(u => ilIds.Contains(u.Id));
            }
            // Student çıkar.
            if (studentIds is { Count: > 0 })
            {
                var excludeIds = studentIds;
                sorgu = sorgu.Where(u => !excludeIds.Contains(u.Id));
            }

            var toplam = await sorgu.CountAsync();

            // Sprint 11.7 — her user için roller + il ataması.
            // Önce sayfada görünecek user id'lerini alalım, sonra toplu join yapalım
            // (N+1 query yerine toplu fetch).
            var sayfaUserIds = await sorgu
                .OrderBy(u => u.Email)
                .Skip((sayfa - 1) * sayfaBasina)
                .Take(sayfaBasina)
                .Select(u => u.Id)
                .ToListAsync();

            // Roller (IdentityUserRole join).
            var rolUserIdsSet = sayfaUserIds.ToHashSet();
            var userRolesDict = await veritabani.Set<IdentityUserRole<string>>()
                .Where(ur => rolUserIdsSet.Contains(ur.UserId))
                .Join(veritabani.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                .GroupBy(x => x.UserId)
                .Select(g => new { UserId = g.Key, Roles = g.Select(x => x.Name).ToArray() })
                .ToDictionaryAsync(g => g.UserId, g => g.Roles);

            // İl atamaları (ProvinceUserAssignment join + Province adı).
            var ilAtamalari = await veritabani.Set<Domain.Identity.ProvinceUserAssignment>()
                .Where(p => rolUserIdsSet.Contains(p.UserId))
                .Join(veritabani.Provinces, p => p.ProvinceId, pr => pr.Id, (p, pr) => new
                {
                    p.UserId,
                    p.Role,
                    IlKodu = pr.Id,
                    IlAdi = pr.Name
                })
                .ToListAsync();
            var ilDict = ilAtamalari
                .GroupBy(x => x.UserId)
                .ToDictionary(g => g.Key, g => g.Select(x => new { x.Role, x.IlKodu, x.IlAdi }).ToArray());

            // Son giriş.
            var sonGirisDict = await veritabani.AuthEvents
                .Where(e => rolUserIdsSet.Contains(e.UserId)
                            && e.Success
                            && e.EventType == Domain.Auth.AuthEventType.LoginSuccess)
                .GroupBy(e => e.UserId)
                .Select(g => new { UserId = g.Key, SonGirisAt = g.Max(e => e.CreatedAt) })
                .ToDictionaryAsync(g => g.UserId, g => g.SonGirisAt);

            var liste = await sorgu
                .Where(u => rolUserIdsSet.Contains(u.Id))
                .OrderBy(u => u.Email)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FirstName,
                    u.LastName,
                    u.TwoFactorEnabled,
                    u.MustChangePassword,
                    u.EmailConfirmed,
                    u.LockoutEnabled,
                    // Aşağıdaki alanlar lookup dict'lerden sonradan enjekte edilir.
                })
                .ToListAsync();

            // Liste objelerini zenginleştir.
            var listeZengin = liste.Select(u => new
            {
                u.Id,
                u.Email,
                u.FirstName,
                u.LastName,
                u.TwoFactorEnabled,
                u.MustChangePassword,
                u.EmailConfirmed,
                u.LockoutEnabled,
                Roller = userRolesDict.TryGetValue(u.Id, out var rr) ? rr : Array.Empty<string>(),
                IlAtamalari = ilDict.TryGetValue(u.Id, out var il) ? il : Array.Empty<object>(),
                SonGirisAt = sonGirisDict.TryGetValue(u.Id, out var sg) ? (DateTime?)sg : null,
            }).ToList();

            return Results.Ok(new
            {
                toplam,
                sayfa,
                sayfaBasina,
                kullanicilar = listeZengin
            });
        }).RequireAuthorization("SystemAdminOnly");

        // ==================== Sprint 11.1 — User CRUD (tamamla) ====================
        // Onur Sprint 11 onayı:
        // - Privacy: Student rolündeki kullanıcılara admin erişimi yok (gizlilik).
        // - Rol atama: atama only, mevcut rolün üzerine yaz (geçiş yok — hata riski).
        // - Whitelist roller: SystemAdmin, MinistryOfficial, ProvinceManager, ProvinceEvaluator.
        var whitelist = new[] { "SystemAdmin", "MinistryOfficial", "ProvinceManager", "ProvinceEvaluator" };

        // 3) Tekil kullanıcı görüntüleme.
        grup.MapGet("/users/{id}", async (
            string id,
            UserManager<ApplicationUser> um,
            FikirPlatformuDbContext db) =>
        {
            var user = await um.FindByIdAsync(id);
            if (user is null) return Results.NotFound(new { message = "Kullanıcı bulunamadı." });

            // Privacy: Student rolünde ise 403 (Onur emri).
            if (await um.IsInRoleAsync(user, "Student"))
            {
                return Results.Json(new { message = "Bu kullanıcı öğrenci rolünde — admin erişimi yok." }, statusCode: 403);
            }

            var userRoles = await um.GetRolesAsync(user);
            var provincesQuery = db.Set<Microsoft.AspNetCore.Identity.IdentityUserRole<string>>()
                .Where(ur => ur.UserId == id);
            // İl kodu veya başka profil alanı (varsa) — şu an Sprint 11'de yoksa boş.

            // Son başarılı login zamanı (AuthEvents).
            var sonGiris = await db.AuthEvents
                .Where(e => e.UserId == id && e.Success && e.EventType == Domain.Auth.AuthEventType.LoginSuccess)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => (DateTime?)e.CreatedAt)
                .FirstOrDefaultAsync();

            return Results.Ok(new
            {
                id = user.Id,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName,
                twoFactorEnabled = user.TwoFactorEnabled,
                mustChangePassword = user.MustChangePassword,
                emailConfirmed = user.EmailConfirmed,
                lockoutEnabled = user.LockoutEnabled,
                roles = userRoles,
                sonGirisAt = sonGiris,
            });
        }).RequireAuthorization("SystemAdminOnly");

        // 4) Kullanıcı güncelle (firstName, lastName, email).
        grup.MapPut("/users/{id}", async (
            string id,
            KullaniciGuncelleIstegi istek,
            UserManager<ApplicationUser> um,
            FikirPlatformuDbContext db,
            HttpContext http) =>
        {
            var user = await um.FindByIdAsync(id);
            if (user is null) return Results.NotFound(new { message = "Kullanıcı bulunamadı." });

            // Privacy: Student rolünde ise 403.
            if (await um.IsInRoleAsync(user, "Student"))
            {
                return Results.Json(new { message = "Bu kullanıcı öğrenci rolünde — admin erişimi yok." }, statusCode: 403);
            }

            // Email değişiyorsa benzersizlik kontrolü.
            if (!string.Equals(user.Email, istek.Email, StringComparison.OrdinalIgnoreCase))
            {
                var mevcutEmail = await um.FindByEmailAsync(istek.Email);
                if (mevcutEmail is not null && mevcutEmail.Id != user.Id)
                {
                    return Results.Json(new { message = "Bu e-posta zaten başka bir kullanıcıda kayıtlı." }, statusCode: 409);
                }
                user.Email = istek.Email;
                user.UserName = istek.Email;
                user.NormalizedEmail = istek.Email.ToUpperInvariant();
                user.NormalizedUserName = istek.Email.ToUpperInvariant();
            }

            user.FirstName = istek.FirstName.Trim();
            user.LastName = istek.LastName.Trim();

            var sonuc = await um.UpdateAsync(user);
            if (!sonuc.Succeeded)
            {
                return Results.ValidationProblem(sonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            // Audit.
            db.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Email = KisiselVeriYardimci.EmailMaskele(user.Email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.UserUpdated,
                Success = true,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(http.RequestAborted);

            return Results.Ok(new { message = "Kullanıcı güncellendi.", id = user.Id });
        }).RequireAuthorization("SystemAdminOnly");

        // 5) Kullanıcı sil.
        grup.MapDelete("/users/{id}", async (
            string id,
            UserManager<ApplicationUser> um,
            FikirPlatformuDbContext db,
            HttpContext http) =>
        {
            var user = await um.FindByIdAsync(id);
            if (user is null) return Results.NotFound(new { message = "Kullanıcı bulunamadı." });

            // Privacy: Student rolünde ise 403.
            if (await um.IsInRoleAsync(user, "Student"))
            {
                return Results.Json(new { message = "Bu kullanıcı öğrenci rolünde — admin erişimi yok." }, statusCode: 403);
            }

            // Kendini silemez (SystemAdmin kendi hesabını silemez, audit için).
            var mevcutKullaniciId = um.GetUserId(http.User);
            if (string.Equals(mevcutKullaniciId, id, StringComparison.Ordinal))
            {
                return Results.Json(new { message = "Kendi hesabınızı silemezsiniz." }, statusCode: 400);
            }

            // EmailMaskele için kullanıcı bilgisi kullanıyoruz — Identity framework User nesnesi.
            var maskedEmail = KisiselVeriYardimci.EmailMaskele(user.Email);

            var sonuc = await um.DeleteAsync(user);
            if (!sonuc.Succeeded)
            {
                return Results.ValidationProblem(sonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            // Audit.
            db.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = mevcutKullaniciId ?? "(deleted)",
                Email = maskedEmail,
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.UserDeleted,
                Success = true,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(http.RequestAborted);

            return Results.Ok(new { message = "Kullanıcı silindi.", id });
        }).RequireAuthorization("SystemAdminOnly");

        // 6) Rol atama (atama only — mevcut rolün üzerine yazar, geçiş yok).
        grup.MapPost("/users/{id}/change-role", async (
            string id,
            RolAtamaIstegi istek,
            UserManager<ApplicationUser> um,
            FikirPlatformuDbContext db,
            HttpContext http) =>
        {
            if (!whitelist.Contains(istek.NewRole))
            {
                return Results.Json(new { message = $"Geçersiz rol. İzinli: {string.Join(", ", whitelist)}" }, statusCode: 400);
            }

            var user = await um.FindByIdAsync(id);
            if (user is null) return Results.NotFound(new { message = "Kullanıcı bulunamadı." });

            // Privacy: Student rolünde ise 403.
            if (await um.IsInRoleAsync(user, "Student"))
            {
                return Results.Json(new { message = "Bu kullanıcı öğrenci rolünde — admin erişimi yok." }, statusCode: 403);
            }

            var mevcutRoller = await um.GetRolesAsync(user);
            if (mevcutRoller.Contains(istek.NewRole))
            {
                return Results.Json(new { message = "Kullanıcı zaten bu role sahip." }, statusCode: 409);
            }

            // Mevcut rolleri kaldır (atama only — Onur: "geçiş olmasın", sadece hedef rol yazılır).
            // Çoklu rol ihtimali olabilir — Identity framework AddToRole ile birden fazla yönetilebilir.
            // Burada "tek aktif rol" semantiği uygulandı (whitelist tekli).
            if (mevcutRoller.Count > 0)
            {
                var kaldirSonuc = await um.RemoveFromRolesAsync(user, mevcutRoller);
                if (!kaldirSonuc.Succeeded)
                {
                    return Results.ValidationProblem(kaldirSonuc.Errors
                        .GroupBy(e => e.Code)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
                }
            }
            var ekleSonuc = await um.AddToRoleAsync(user, istek.NewRole);
            if (!ekleSonuc.Succeeded)
            {
                return Results.ValidationProblem(ekleSonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            // Audit.
            db.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Email = KisiselVeriYardimci.EmailMaskele(user.Email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.UserUpdated,
                Success = true,
                FailureReason = $"role-change: {string.Join(",", mevcutRoller)} -> {istek.NewRole}",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(http.RequestAborted);

            return Results.Ok(new
            {
                message = "Rol atandı.",
                id = user.Id,
                yeniRol = istek.NewRole,
                oncekiRoller = mevcutRoller,
            });
        }).RequireAuthorization("SystemAdminOnly");

        // ==================== Sprint 11.2 — MFA reset + Force password reset ====================
        // 7) MFA reset (telefon kayıp senaryosu): Kullanıcının TOTP authenticator
        // sıfırlanır. Sonraki login'de yeniden MFA setup ekranı çıkar.
        grup.MapPost("/users/{id}/reset-mfa", async (
            string id,
            UserManager<ApplicationUser> um,
            FikirPlatformuDbContext db,
            HttpContext http) =>
        {
            var user = await um.FindByIdAsync(id);
            if (user is null) return Results.NotFound(new { message = "Kullanıcı bulunamadı." });
            if (await um.IsInRoleAsync(user, "Student"))
            {
                return Results.Json(new { message = "Bu kullanıcı öğrenci rolünde — admin erişimi yok." }, statusCode: 403);
            }

            // Identity authenticator reset:
            // - TwoFactorEnabled = false
            // - AuthenticatorKey null
            // - RecoveryCodes iptal (user tekrar üretebilir)
            var resetSonuc = await um.ResetAuthenticatorKeyAsync(user);
            var kapatSonuc = await um.SetTwoFactorEnabledAsync(user, false);

            if (!resetSonuc.Succeeded || !kapatSonuc.Succeeded)
            {
                var errors = resetSonuc.Errors.Concat(kapatSonuc.Errors).ToList();
                return Results.ValidationProblem(errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            db.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Email = KisiselVeriYardimci.EmailMaskele(user.Email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.MfaDisabled,
                Success = true,
                FailureReason = "admin-force-reset",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(http.RequestAborted);

            return Results.Ok(new
            {
                message = "MFA sıfırlandı. Kullanıcı sonraki login'de MFA setup ekranına yönlendirilecek.",
                id = user.Id,
            });
        }).RequireAuthorization("SystemAdminOnly");

        // 8) Force password reset: Sistem Admin tek kullanımlık reset token üretir.
        // Frontend bu token'ı /sifremi-sifirla?token=... URL'inde yakalar, yeni şifre girilir.
        grup.MapPost("/users/{id}/reset-password", async (
            string id,
            UserManager<ApplicationUser> um,
            IConfiguration cfg,
            FikirPlatformuDbContext db,
            HttpContext http) =>
        {
            var user = await um.FindByIdAsync(id);
            if (user is null) return Results.NotFound(new { message = "Kullanıcı bulunamadı." });
            if (await um.IsInRoleAsync(user, "Student"))
            {
                return Results.Json(new { message = "Bu kullanıcı öğrenci rolünde — admin erişimi yok." }, statusCode: 403);
            }

            // Identity framework password reset token (raw token döner, URL safe).
            var token = await um.GeneratePasswordResetTokenAsync(user);

            // Reset URL — frontend absolute path.
            var frontendBase = (cfg["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
            var resetUrl = $"{frontendBase}/sifre-sifirla?token={Uri.EscapeDataString(token)}&userId={Uri.EscapeDataString(user.Id)}";

            // Audit.
            db.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Email = KisiselVeriYardimci.EmailMaskele(user.Email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.PasswordChanged,
                Success = true,
                FailureReason = "admin-force-reset-token",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(http.RequestAborted);

            // Production'da resetUrl kullanıcıya email ile gönderilir. Şu an Sprint 11.2'de
            // response'da dönüyor — frontend admin UI token'ı alıp kopyalayabilir veya
            // doğrudan mail gönderebilir.
            return Results.Ok(new
            {
                message = "Şifre sıfırlama token'ı üretildi. Kullanıcıya iletin veya email ile gönderin.",
                id = user.Id,
                resetUrl,
                expiresIn = "1 gün",
            });
        }).RequireAuthorization("SystemAdminOnly");

        // ==================== Sprint 11.5 P2 — Bulk CSV import ====================
        // Onur YEGİTEK için: 81 il AR-GE birimini tek tek eklemek yerine
        // CSV'den toplu oluşturma. 400+ satır.
        // CSV formatı: email,firstName,lastName,role,provinceCode,temporaryPassword
        // Her satırda role whitelist'te olmalı (Sistem Admin, MinistryOfficial,
        // ProvinceManager, ProvinceEvaluator). Student rolü kabul edilmez (Onur emri).

        grup.MapPost("/users/bulk", async (
            HttpContext http,
            UserManager<ApplicationUser> um,
            FikirPlatformuDbContext db,
            ILogger<Program> logger) =>
        {
            if (!http.Request.HasFormContentType)
            {
                return Results.Json(new { message = "multipart/form-data bekleniyor." }, statusCode: 400);
            }

            var form = await http.Request.ReadFormAsync(http.RequestAborted);
            var dosya = form.Files.GetFile("file");
            if (dosya is null || dosya.Length == 0)
            {
                return Results.Json(new { message = "CSV dosyası bulunamadı." }, statusCode: 400);
            }

            if (dosya.Length > 5 * 1024 * 1024) // 5 MB üst sınır.
            {
                return Results.Json(new { message = "Dosya 5 MB'dan büyük olamaz." }, statusCode: 400);
            }

            // CSV parse (basit split — virgülle ayrılmış, başlık satırı beklenir).
            var csvMetni = await new StreamReader(dosya.OpenReadStream()).ReadToEndAsync();
            var satirlar = csvMetni.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            if (satirlar.Length < 2)
            {
                return Results.Json(new { message = "CSV dosyasında başlık + en az 1 veri satırı gerekli." }, statusCode: 400);
            }

            var baslik = satirlar[0].Trim();
            // Türkçe karakter'e duyarsız başlık normalize.
            var baslikAlanlar = baslik.Split(',').Select(s => s.Trim().Trim('"').ToLowerInvariant()).ToArray();
            int Col(string ad) => Array.FindIndex(baslikAlanlar, x => x == ad);

            var emailCol = Col("email");
            var firstNameCol = Col("firstname");
            var lastNameCol = Col("lastname");
            var roleCol = Col("role");
            var provinceCodeCol = Col("provincecode");
            var passwordCol = Col("temporarypassword");
            // Alternatif alan isimleri (Türkçe):
            if (emailCol < 0) emailCol = Col("e-posta") >= 0 ? Col("e-posta") : Col("eposta");
            if (firstNameCol < 0) firstNameCol = Col("ad");
            if (lastNameCol < 0) lastNameCol = Col("soyad");
            if (roleCol < 0) roleCol = Col("rol");
            if (passwordCol < 0) passwordCol = Col("gecici") >= 0 ? Col("gecici") : Col("sifre");

            if (emailCol < 0 || firstNameCol < 0 || lastNameCol < 0 || roleCol < 0 || passwordCol < 0)
            {
                return Results.Json(new
                {
                    message = "CSV başlığında zorunlu sütunlar eksik. Gerekli: email,firstName,lastName,role,temporaryPassword",
                    baslik = baslikAlanlar,
                }, statusCode: 400);
            }

            var whitelist = new[] { "SystemAdmin", "MinistryOfficial", "ProvinceManager", "ProvinceEvaluator" };
            var basarili = new List<object>();
            var hatalar = new List<object>();

            for (var i = 1; i < satirlar.Length; i++)
            {
                var satirNo = i + 1;
                var rawSatir = satirlar[i];
                if (string.IsNullOrWhiteSpace(rawSatir)) continue;

                // Basit CSV split: virgüller. Tırnak kaçışı yok (ileride).
                var hucreler = rawSatir.Split(',').Select(s => s.Trim().Trim('"')).ToArray();
                var emailVal = emailCol < hucreler.Length ? hucreler[emailCol] : "";
                var firstNameVal = firstNameCol < hucreler.Length ? hucreler[firstNameCol] : "";
                var lastNameVal = lastNameCol < hucreler.Length ? hucreler[lastNameCol] : "";
                var roleVal = roleCol < hucreler.Length ? hucreler[roleCol] : "";
                var passwordVal = passwordCol < hucreler.Length ? hucreler[passwordCol] : "";
                var provinceCodeVal = provinceCodeCol >= 0 && provinceCodeCol < hucreler.Length
                    ? hucreler[provinceCodeCol]
                    : null;

                try
                {
                    if (!whitelist.Contains(roleVal))
                    {
                        hatalar.Add(new { satir = satirNo, email = emailVal, hata = $"Geçersiz rol: {roleVal}. İzinli: {string.Join(", ", whitelist)}" });
                        continue;
                    }
                    if (string.IsNullOrWhiteSpace(emailVal) || !emailVal.Contains('@'))
                    {
                        hatalar.Add(new { satir = satirNo, email = emailVal, hata = "Geçersiz e-posta." });
                        continue;
                    }
                    if (passwordVal.Length < 8)
                    {
                        hatalar.Add(new { satir = satirNo, email = emailVal, hata = "Geçici şifre en az 8 karakter." });
                        continue;
                    }

                    // Email benzersizlik kontrolü.
                    var mevcut = await um.FindByEmailAsync(emailVal);
                    if (mevcut is not null)
                    {
                        hatalar.Add(new { satir = satirNo, email = emailVal, hata = "Bu e-posta zaten kayıtlı." });
                        continue;
                    }

                    var user = new ApplicationUser
                    {
                        UserName = emailVal,
                        Email = emailVal,
                        FirstName = firstNameVal.Trim(),
                        LastName = lastNameVal.Trim(),
                        EmailConfirmed = true,
                        MustChangePassword = true,
                        PasswordChangedAt = DateTimeOffset.UtcNow,
                    };
                    var olusturma = await um.CreateAsync(user, passwordVal);
                    if (!olusturma.Succeeded)
                    {
                        var desc = string.Join(", ", olusturma.Errors.Select(e => e.Description));
                        hatalar.Add(new { satir = satirNo, email = emailVal, hata = desc });
                        continue;
                    }
                    await um.AddToRoleAsync(user, roleVal);
                    basarili.Add(new { satir = satirNo, email = emailVal, role = roleVal, id = user.Id });
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "[BULK] Satır {SatirNo} beklenmeyen hata.", satirNo);
                    hatalar.Add(new { satir = satirNo, email = emailVal, hata = ex.Message });
                }
            }

            // Audit (sadece özet — her satır için ayrıca eklemiyoruz, zaten AuthEvents
            // UserCreated event'leri olabilir ama bulk için yeterince detaylı).
            var mevcutKullaniciId = um.GetUserId(http.User);
            db.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = mevcutKullaniciId ?? "(unknown)",
                Email = "(bulk-import)",
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.UserCreated,
                Success = true,
                FailureReason = $"bulk-import: basari={basarili.Count}, hata={hatalar.Count}",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(http.RequestAborted);

            return Results.Ok(new
            {
                toplam = satirlar.Length - 1, // başlık hariç
                basariliSayisi = basarili.Count,
                hataSayisi = hatalar.Count,
                basarili,
                hatalar,
            });
        }).RequireAuthorization("SystemAdminOnly");

        return app;
    }

    public sealed record KullaniciGuncelleIstegi(
        [Required, EmailAddress, StringLength(256)] string Email,
        [Required, StringLength(50, MinimumLength = 2)] string FirstName,
        [Required, StringLength(50, MinimumLength = 2)] string LastName);

    public sealed record RolAtamaIstegi(
        [Required] string NewRole);

    public sealed record YeniKullaniciIstegi(
        [Required, EmailAddress, StringLength(256)] string Email,
        [Required, StringLength(100, MinimumLength = 8)] string Password,
        [Required, StringLength(50, MinimumLength = 2)] string FirstName,
        [Required, StringLength(50, MinimumLength = 2)] string LastName,
        [Required] string Role,
        /// <summary>Sprint 11.12: ProvinceManager/Evaluator için zorunlu il ataması. Diğer roller için null olabilir.</summary>
        int? IlKodu = null);
}
