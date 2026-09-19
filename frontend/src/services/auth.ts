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
}): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: payload,
  });
}

export async function login(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email: payload.email, password: payload.password, rememberMe: payload.rememberMe ?? true },
  });
}

export async function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/auth/logout", { method: "POST" });
}

export async function me(signal?: AbortSignal): Promise<MeResponse> {
  return apiRequest<MeResponse>("/api/auth/me", { signal });
}
