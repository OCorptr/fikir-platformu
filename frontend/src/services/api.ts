// fetch wrapper — cookie auth (credentials: 'include') + ortak hata yönetimi.
// Development: Vite proxy /api → http://localhost:5000 (vite.config.ts).
// Production:  VITE_API_BASE_URL env variable ile absolute backend URL'i kullanılır.

import type { ApiError } from "../types";

/// <summary>
/// API base URL'i: env variable varsa onu, yoksa "/api" (Vite proxy).
/// Production deploy'da VITE_API_BASE_URL=https://fikir-platformu.onrender.com
/// gibi absolute URL verilir — frontend kendi domainindeki static path'e değil
/// doğrudan backend'e istek gönderir.
/// </summary>
const API_BASE: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  // path "/api/..." veya "api/..." olabilir
  const temiz = path.replace(/^\/+/, "");
  return API_BASE ? `${API_BASE}/${temiz}` : `/${temiz}`;
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly body: ApiError | null;

  constructor(status: number, message: string, body: ApiError | null) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function parseBody(response: Response): Promise<ApiError | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return (await response.json()) as ApiError;
  } catch {
    return null;
  }
}

function buildMessage(status: number, body: ApiError | null): string {
  if (body) {
    if (body.message && body.message.trim().length > 0) {
      return body.message;
    }
    if (body.errors) {
      const ilk = Object.values(body.errors).flat()[0];
      if (ilk) return ilk;
    }
    if (body.title && body.title.trim().length > 0) {
      return body.title;
    }
  }
  return `İstek başarısız (HTTP ${status}).`;
}

export async function apiRequest<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;

  // Relative path ise (/api/...), absolute backend URL'ine ekle.
  // Absolute path ise (http/https://...) olduğu gibi bırak.
  let fullUrl = url;
  if (url.startsWith("/")) {
    fullUrl = API_BASE ? `${API_BASE}${url}` : url;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body: payload,
    credentials: "include",
    signal,
  });

  // 204 No Content — gövde yok
  if (response.status === 204) {
    return undefined as T;
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    throw new ApiHttpError(response.status, buildMessage(response.status, parsed), parsed);
  }

  return parsed as T;
}
