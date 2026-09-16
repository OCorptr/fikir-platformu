import { apiRequest } from "./client";

export type AuthSummary = {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

export type RegisterRequest = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  provinceId: number;
};

export function register(request: RegisterRequest) {
  return apiRequest<{ message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function login(email: string, password: string, rememberMe: boolean) {
  return apiRequest<AuthSummary>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  });
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, token: string, newPassword: string) {
  return apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, token, newPassword }),
  });
}
