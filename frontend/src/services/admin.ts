// Admin servisleri (Sprint 9 — SystemAdmin only).
// Tüm endpoint'ler MfaCompleted + SystemAdminOnly policy ile korunuyor.

import { apiRequest } from "./api";

export type AdminRole =
  | "SystemAdmin"
  | "MinistryOfficial"
  | "ProvinceManager"
  | "ProvinceEvaluator";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  emailConfirmed: boolean;
  lockoutEnabled: boolean;
}

export interface AdminUserListResponse {
  toplam: number;
  sayfa: number;
  sayfaBasina: number;
  kullanicilar: AdminUser[];
}

export async function adminListUsers(
  params: { rol?: AdminRole | ""; sayfa?: number; sayfaBasina?: number } = {}
): Promise<AdminUserListResponse> {
  const arama = new URLSearchParams();
  if (params.rol) arama.set("rol", params.rol);
  if (params.sayfa) arama.set("sayfa", String(params.sayfa));
  if (params.sayfaBasina) arama.set("sayfaBasina", String(params.sayfaBasina));
  const query = arama.toString();
  return apiRequest<AdminUserListResponse>(
    `/api/admin/users${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
}

export interface YeniKullaniciIstegi {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
}

export interface YeniKullaniciCevabi {
  message: string;
  userId: string;
  email: string;
  role: string;
  mfaSetupRequired: boolean;
}

export async function adminCreateUser(payload: YeniKullaniciIstegi): Promise<YeniKullaniciCevabi> {
  return apiRequest<YeniKullaniciCevabi>("/api/admin/users", {
    method: "POST",
    body: payload,
  });
}
