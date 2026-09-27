// System Admin / Yönetim API helper'ları — Sprint 11.
//
// Backend: /api/admin/users* (Sprint 11 — User CRUD + MFA reset + Force password reset).
// Tümü SystemAdminOnly policy korumalı (Identity SystemAdmin rolü + MFA verified).

import { apiRequest } from "./api";

// Whitelist roller (Sprint 11 — Onur onayı).
export const ALLOWED_ROLES = [
  "SystemAdmin",
  "MinistryOfficial",
  "ProvinceManager",
  "ProvinceEvaluator",
] as const;
export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  emailConfirmed: boolean;
  lockoutEnabled: boolean;
  /** IdentityUserRole join — ör: ["ProvinceManager"] veya ["SystemAdmin"]. */
  roller: string[];
  /** ProvinceUserAssignment + Provinces join — ProvinceManager/Evaluator için. */
  ilAtamalari: AdminUserIlAtamasi[];
  sonGirisAt: string | null;
}

export interface AdminUserIlAtamasi {
  role: string; // "ProvinceManager" | "ProvinceEvaluator"
  ilKodu: number;
  ilAdi: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  roles: string[];
  sonGirisAt: string | null;
}

export interface UserListResponse {
  toplam: number;
  sayfa: number;
  sayfaBasina: number;
  kullanicilar: AdminUserListItem[];
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AllowedRole;
  /** Sprint 11.12: ProvinceManager / ProvinceEvaluator için zorunlu il kodu. Diğer roller için undefined. */
  ilKodu?: number;
}

export interface UpdateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
}

export interface ChangeRoleRequest {
  newRole: AllowedRole;
}

export interface ResetPasswordResponse {
  message: string;
  id: string;
  email?: string;
  /** Sprint 11.13: Mail gönderilemediğinde fallback olarak döner. */
  resetUrl?: string;
  mailHatasi?: boolean;
  /** Eski API uyumluluğu için opsiyonel. */
  expiresIn?: string;
}

export interface ResetMfaResponse {
  message: string;
  id: string;
}

// --- API helpers -----------------------------------------------------------

const ADMIN_BASE = "/api/admin";

export async function listUsers(opts: {
  role?: AllowedRole;
  sayfa?: number;
  sayfaBasina?: number;
  ilKodu?: number;
} = {}): Promise<UserListResponse> {
  const params = new URLSearchParams();
  if (opts.role) params.set("role", opts.role);
  if (opts.sayfa && opts.sayfa > 0) params.set("sayfa", String(opts.sayfa));
  if (opts.sayfaBasina && opts.sayfaBasina > 0)
    params.set("sayfaBasina", String(opts.sayfaBasina));
  if (opts.ilKodu && opts.ilKodu > 0) params.set("ilKodu", String(opts.ilKodu));
  const query = params.toString();
  return apiRequest<UserListResponse>(`${ADMIN_BASE}/users${query ? `?${query}` : ""}`);
}

export async function getUser(id: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>(`${ADMIN_BASE}/users/${encodeURIComponent(id)}`);
}

export async function createUser(req: CreateUserRequest): Promise<{
  message: string;
  userId: string;
  email: string;
  role: AllowedRole;
  mfaSetupRequired: boolean;
}> {
  return apiRequest(`${ADMIN_BASE}/users`, {
    method: "POST",
    body: req,
  });
}

export async function updateUser(
  id: string,
  req: UpdateUserRequest,
): Promise<{ message: string; id: string }> {
  return apiRequest(`${ADMIN_BASE}/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: req,
  });
}

export async function deleteUser(id: string): Promise<{ message: string; id: string }> {
  return apiRequest(`${ADMIN_BASE}/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function changeUserRole(
  id: string,
  req: ChangeRoleRequest,
): Promise<{
  message: string;
  id: string;
  yeniRol: AllowedRole;
  oncekiRoller: string[];
}> {
  return apiRequest(`${ADMIN_BASE}/users/${encodeURIComponent(id)}/change-role`, {
    method: "POST",
    body: req,
  });
}

export async function resetUserMfa(id: string): Promise<ResetMfaResponse> {
  return apiRequest<ResetMfaResponse>(
    `${ADMIN_BASE}/users/${encodeURIComponent(id)}/reset-mfa`,
    { method: "POST" },
  );
}

export async function resetUserPassword(id: string): Promise<ResetPasswordResponse> {
  return apiRequest<ResetPasswordResponse>(
    `${ADMIN_BASE}/users/${encodeURIComponent(id)}/reset-password`,
    { method: "POST" },
  );
}
