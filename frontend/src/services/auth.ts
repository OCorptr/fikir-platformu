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

// ---- MFA (Sprint 10 — method choice: TOTP veya Email) ----

export type MfaMethod = "Totp" | "Email" | "None";

export interface MfaSetupTotpResponse {
  method: "Totp";
  secret: string;
  otpauthUrl: string;
  digits: number;
  period: number;
  issuer: string;
}

export interface MfaSetupEmailResponse {
  method: "Email";
  emailHint: string; // "onu***" gibi maskeli email UI için
}

export type MfaSetupResponse = MfaSetupTotpResponse | MfaSetupEmailResponse;

/** MFA kurulumu başlat — method parametresi ile (Sprint 10). */
export async function mfaSetupBaslat(method: MfaMethod): Promise<MfaSetupResponse> {
  return apiRequest<MfaSetupResponse>("/api/auth/mfa/setup", {
    method: "POST",
    body: { method: method === "Totp" ? "Totp" : "Email" },
  });
}

/** MFA kodu doğrula (kurulum tamamla). Body: {code} */
export async function mfaVerifyKod(code: string): Promise<{ message: string; method?: string; context?: string; email?: string; firstName?: string; lastName?: string }> {
  return apiRequest("/api/auth/mfa/verify-setup", {
    method: "POST",
    body: { code },
  });
}

/** Login sonrası MFA code doğrula (MFA zaten enabled). Body: {code} */
export async function mfaLoginVerify(code: string): Promise<{ message: string; method?: string; context?: string; email?: string; firstName?: string; lastName?: string }> {
  return apiRequest("/api/auth/mfa/verify", {
    method: "POST",
    body: { code },
  });
}

/** Login sonrası kullanıcının MFA method'unu döner (PreMfaScheme authenticated). */
export async function mfaGetMethod(): Promise<{ method: "Totp" | "Email" | "None"; enabled: boolean; email?: string }> {
  return apiRequest("/api/auth/mfa/method", { method: "GET" });
}

/** Email OTP için kod gönder (PreMfaScheme authenticated). Login akışında çağrılır.
 *  Development modunda response `devCode` alanı içerir (kullanıcı OTP kodunu görür —
 *  SMTP yapılandırılmamış demo ortamlarında log'a bakma zahmetinden kurtarır).
 *  Üretim (SmtpEmailSender) devCode=null döner. */
export async function mfaSendEmailOtp(): Promise<{ message: string; devCode?: string | null }> {
  return apiRequest("/api/auth/mfa/send-email-otp", { method: "POST" });
}
