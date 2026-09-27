// Sprint 11.7 — Identity 9 default password validator DI override.
// IdentityPasswordValidators collection'a eklenir. AlwaysValidPolicy bypass.
//
// NEDEN: Identity 9 default IPasswordValidator<ApplicationUser>, IdentityOptions.Password
// üzerinden davranır. Default olarak eklenen validatorlar Identity'nin kendi kombinasyonu
// (LowercaseUppercaseDigitNonAlphanumeric). Bypass etmek için kendi IPasswordValidator'ı
// ekleyerek zincirin sonuna 'her zaman başarılı' validator ekleyebiliriz — IdentityValidators
// collection'da validator varsa default çalışmaz.
// Bkz: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-configuration

using Microsoft.AspNetCore.Identity;

namespace FikirPlatformu.Api.Endpoints;

public sealed class BypassPasswordValidator<TUser> : IPasswordValidator<TUser>
    where TUser : class
{
    public Task<IdentityResult> ValidateAsync(UserManager<TUser> manager, TUser user, string? password)
    {
        return Task.FromResult(IdentityResult.Success);
    }
}
