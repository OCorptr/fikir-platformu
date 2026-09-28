# ADR 0001: Sistem Sabit Gmail vs Per-User Gmail

**Tarih:** 2026-09-25
**Durum:** ⚠️ Kabul edildi (Sprint 10.7) — Sprint 12'de per-user mimarisine geçiş planlanıyor.
**Karar veren:** Onur Corptr (proje sahibi)
**Bağlam:** MFA Email OTP için mail gönderim mimarisi.

---

## 🧩 Bağlam

Fikir Platformu'nda MFA Email OTP yöntemi kullanılıyor (TOTP + Email seçenekleri). Kullanıcı E-posta seçtiğinde, sistem kullanıcının e-postasına 6 haneli OTP gönderir. Bu mail gönderimi için **hangi Gmail hesabı** kullanılacak?

**Olası seçenekler:**

1. **Sistem Sabit Gmail** — `fikir.platformu.iletisim@gmail.com` (proje için ayrılmış). Tüm OTP mailleri bu hesaptan gider.
2. **Per-User Gmail** — Her kullanıcı kendi Gmail'ini OAuth ile bağlar. OTP kendi e-postasına kendi hesabından gider.

Sprint 10 başında Onur **Sistem Sabit Gmail**'i tercih etti. Sprint 10.7 sonunda **itiraz edip sorguladı**: "acaba yanlış seçim mi yaptım herkes kendi gmaili ile mi olması gerekiyordu."

## 🔍 Araştırma bulguları (Sprint 10.7 internet search)

İnternetteki standart pattern'ler:

- **Google for Developers Gmail API docs:** "Refresh tokens are **per-user**. Each user must authorize access to their own Gmail account."
- **Microsoft Entra External ID OTP sender:** "Use delegated permissions; OTP sender is the **end user's own mailbox**."
- **Agentic Fabriq case study:** "Gmail OAuth integration is **naturally per-user designed**; system account patterns require service-account impersonation."
- **OAuth 2.0 generic pattern (RFC 6749):** Refresh tokens are **per end user** by design.

Hepsi **per-user** diyor.

### Sistem sabit Gmail'in problemleri

1. **UX oddness:** OTP `system35bilisim@gmail.com`'dan geliyor — kullanıcı kendi e-postasına yazmadığı birinden OTP alıyor. Şüpheli görünebilir.
2. **Güven:** "Bu mail gerçekten sistemden mi geldi?" sorusu. Doğrulama daha zayıf.
3. **Gmail API quota:** Sistem sabit hesaptan tüm user'lara mail göndermek rate-limit'e yaklaşabilir.
4. **Audit:** "Kim hangi OTP'yi aldı" takibi sadece DB log'da, Gmail log'da tek bir gönderici.

### Per-user Gmail'in problemleri

1. **Onboarding friction:** Her kullanıcı MFA setup'ta OAuth handshake yapmak zorunda.
2. **Token expiration:** Google Test Mode refresh token 7 gün, Production domain verification sonrası 6 ay. Re-handshake gerekebilir.
3. **Gmail kullanmayan kullanıcılar:** Microsoft 365 / Yahoo / Outlook kullananlar için çözüm yok.
4. **Implementasyon karmaşıklığı:** UserGmailToken entity, factory pattern, encryption, OAuth callback user-tied state.

## ✅ Sprint 10.7 kararı

**Sistem Sabit Gmail** ile başla. Sebepler:
1. Hızlı MVP — ilk sprint'lerde platform launch gerekli.
2. Test user (`onur35bilisim@gmail.com`) zaten Gmail kullanıyor.
3. Sistem sabit hesap (`fikir.platformu.iletisim@gmail.com`) YEGİTEK için ayrılmış, domain doğrulanmamış.
4. Per-user mimari Sprint 12+'ye bırakılabilir (migration path açık).

**Geçiş planı (Sprint 12):**

| # | Task | Scope |
|---|---|---|
| 1 | Yeni entity `UserGmailToken` (userId FK, encryptedRefreshToken, scope, UpdatedAt) | Sprint 12.P0 |
| 2 | `GmailApiEmailSender` → factory pattern. `ForUserAsync(userId, ct)`. Refresh token user'a özel DB'den çözülür. | Sprint 12.P0 |
| 3 | `mfaGetMethod` user-specific. User'ın kendi `UserGmailToken`'ı var mı kontrol. Yoksa `needsGmailOAuth:true`. | Sprint 12.P1 |
| 4 | `mfaSendEmailOtp` user-authenticated. PreMfa scheme authenticated → user id → sender user-specific. | Sprint 12.P1 |
| 5 | `AuthEndpoints` OAuth callback user-tied. State userId içerir (encrypted cookie). Callback user.id ile DB upsert. | Sprint 12.P0 |
| 6 | Frontend `MfaLoginPage` / `MfaSetupPage` per-user. Handshake tetikleme aynı, user zaten authenticated. | Sprint 12.P1 |
| 7 | Migration dosyaları Sandbox dışı CI'da üret. | Sprint 12.P2 |

**Geri dönüş planı:** Sistem sabit Gmail fallback olarak kalır (per-user handshake yapılmamış user'lar için). Hybrid mode: user-specific Gmail varsa onu kullan, yoksa sistem sabit fallback.

## ⚖️ Sonuç

**Kabul edildi (geçici).** Sprint 10.7-11 boyunca Sistem Sabit Gmail çalışacak. Sprint 12'de Per-User mimarisine geçiş planlanıyor.

**Trade-offs:**
- ✅ Hızlı MVP, YEGİTEK launch için uygun.
- ✅ Tüm mail'ler tek audit trail (sistem sabit hesap).
- ❌ UX suboptimal (kullanıcı tanımadığı bir gönderici).
- ❌ Gmail Test Mode refresh token 7 gün (yeniden handshake gerekli).

**Revizyon tetikleyicileri:**
- 100+ user aktif olduğunda Gmail quota riski.
- YEGİTEK "kendi e-postamdan gönderilsin" talep ederse.
- Production domain (`fikrimnet.gov.tr`) doğrulandığında refresh token 6 ay olur.

---

## 📎 İlgili dosyalar

- `backend/src/FikirPlatformu.Infrastructure/Email/GmailApiEmailSender.cs` — Sistem sabit sender implementasyonu.
- `backend/src/FikirPlatformu.Infrastructure/Auth/GmailRefreshToken.cs` — DB persist entity (Sprint 11.36+).
- `backend/src/FikirPlatformu.Infrastructure/Security/HassasVeriSifreleme.cs` — PBKDF2 encrypt.
- `frontend/src/pages/admin/OAuthAyarlaPage.tsx` — OAuth handshake trigger UI.
- `docs/GOOGLE-OAUTH-SETUP.md` — OAuth setup adımları.
- `HANDOVER.md` — Sprint 11+ per-user planı detayı.

---

*Bu ADR Sprint 12'de "Geçildi" statüsüne güncellenecek.*
