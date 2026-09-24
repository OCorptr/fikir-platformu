// Kimlik servisi — register, login, logout, me.

import { apiRequest } from "./api";
import type {
  LoginResponse,
  MeResponse,
  RegisterResponse,
} from "../types";

export async function register(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  provinceId: number;
  school?: string | null;
  grade?: number | null;
  studentNumber?: string | null;
  captchaId?: string;
  captchaAnswer?: string;
}): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password,
      provinceId: payload.provinceId,
      school: payload.school ?? null,
      grade: payload.grade ?? null,
      studentNumber: payload.studentNumber ?? null,
      captchaId: payload.captchaId ?? "",
      captchaAnswer: payload.captchaAnswer ?? "",
    },
  });
}

/** Giriş context'i: öğrenci / il / bakanlık — URL'den algılanır, login çağrısına iletilir. */
export type LoginContext = "student" | "province" | "ministry";

export async function login(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
  context?: LoginContext; // hangi panele giriş yapıldığı
  captchaId?: string;
  captchaAnswer?: string;
}): Promise<LoginResponse> {
  const url = payload.context
    ? `/api/auth/login?role=${encodeURIComponent(payload.context)}`
    : "/api/auth/login";
  return apiRequest<LoginResponse>(url, {
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
      rememberMe: payload.rememberMe ?? true,
      captchaId: payload.captchaId ?? "",
      captchaAnswer: payload.captchaAnswer ?? "",
    },
  });
}

export async function logout(context?: LoginContext): Promise<{ message: string; context: string }> {
  const url = context ? `/api/auth/logout?role=${encodeURIComponent(context)}` : "/api/auth/logout";
  return apiRequest<{ message: string; context: string }>(url, { method: "POST" });
}

/** URL path'inden login context'ini çıkarır. */
export function contextFromPath(pathname: string): LoginContext | undefined {
  if (pathname.startsWith("/il-panel")) return "province";
  if (pathname.startsWith("/bakanlik")) return "ministry";
  if (pathname.startsWith("/fikir")) return "student";
  return undefined;
}

export async function me(signal?: AbortSignal): Promise<MeResponse> {
  return apiRequest<MeResponse>("/api/auth/me", { signal });
}

// ---- MFA (Sprint 9) ----

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  digits: number;
  period: number;
  issuer: string;
}

/** MFA kurulumu başlat — server secret üretir, otpauth URL döner (PreMfaScheme authenticated). */
export async function mfaSetupBaslat(): Promise<MfaSetupResponse> {
  return apiRequest<MfaSetupResponse>("/api/auth/mfa/setup", { method: "POST" });
}

/** MFA kodu doğrula (kurulum tamamla veya login 2. adım). Body: {code} */
export async function mfaVerifyKod(code: string): Promise<{ message: string; context?: string; email?: string; firstName?: string; lastName?: string }> {
  return apiRequest("/api/auth/mfa/verify-setup", {
    method: "POST",
    body: { code },
  });
}

/** Login sonrası MFA code doğrula (MFA zaten enabled). Body: {code} */
export async function mfaLoginVerify(code: string): Promise<{ message: string; context?: string; email?: string; firstName?: string; lastName?: string }> {
  return apiRequest("/api/auth/mfa/verify", {
    method: "POST",
    body: { code },
  });
}
