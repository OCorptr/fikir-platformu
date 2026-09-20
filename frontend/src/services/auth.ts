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
}): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: payload,
  });
}

/** Giriş context'i: öğrenci / il / bakanlık — URL'den algılanır, login çağrısına iletilir. */
export type LoginContext = "student" | "province" | "ministry";

export async function login(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
  context?: LoginContext; // hangi panele giriş yapıldığı
}): Promise<LoginResponse> {
  const url = payload.context
    ? `/api/auth/login?role=${encodeURIComponent(payload.context)}`
    : "/api/auth/login";
  return apiRequest<LoginResponse>(url, {
    method: "POST",
    body: { email: payload.email, password: payload.password, rememberMe: payload.rememberMe ?? true },
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
