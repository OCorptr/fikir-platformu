// Gmail OAuth refresh token saklama entity'si (Sprint 10.7+++).
// Sistem mode'da çalışan Gmail API tek bir SystemAdmin hesabı üzerinden
// mail gönderir; bu tabloda tek satır saklanır. HassasVeriSifreleme ile
// encrypted saklanır (DB leak'inde attacker OAuth yetkisi kazanamaz).
//
// Akış:
//   1) /api/auth/gmail-oauth/start → Google consent → callback
//   2) Callback Google'dan code alır → token exchange → refresh_token
//   3) Refresh token EncryptedRefreshToken kolonuna yazılır (upsert).
//   4) GmailApiEmailSender her SendAsync'te önce env (Mail:Gmail:RefreshToken)
//      kontrol eder; boşsa DB'den okur, HassasVeriSifreleme ile çözer
//      ve Gmail API'ye sunar.

using System;

namespace FikirPlatformu.Infrastructure.Auth;

public sealed class GmailRefreshToken
{
    public int Id { get; set; } = 1; // PK = 1, singleton row (Sistem Sabit Gmail'i)
    public string EncryptedRefreshToken { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
}
