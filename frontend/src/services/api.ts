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

// Onur dashboard'nda VITE_API_BASE_URL henüz set edilmediğinden
// production için hardcoded fallback gerekli. Gelecekte özel domain
// (fikrimnet.gov.tr) aktifleşince env variable'ı set etmek yeterli.
const PRODUCTION_BACKEND_ORIGIN = "https://fikir-platformu.onrender.com";

export function backendOrigin(): string {
  if (API_BASE) return API_BASE; // env variable varsa onu kullan
  // Dev server'da (Vite proxy `/api` → :5000) kendi origin doğru.
  // Production'da `https://fikir-platformu-web.onrender.com` origin'i
  // `/api/...` için static SPA fallback olur — backend origin'i şart.
  return PRODUCTION_BACKEND_ORIGIN;
}

export function backendApiUrl(path: string): string {
  const temiz = path.replace(/^\/+/, "");
  return `${backendOrigin()}/${temiz}`;
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
  // Backend'in özel mesajı varsa onu tercih et (en anlamlı bilgi).
  if (body) {
    if (body.message && body.message.trim().length > 0) {
      return body.message;
    }
    // Validation problem details (.NET DataAnnotations): { errors: { FieldName: ["mesaj1", "mesaj2"] } }
    if (body.errors) {
      const ilk = Object.values(body.errors).flat()[0];
      if (ilk) return ilk;
    }
    if (body.title && body.title.trim().length > 0) {
      return body.title;
    }
  }
  // Fallback: HTTP status'a göre anlaşılır Türkçe mesaj.
  if (status === 401) return "Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.";
  if (status === 403) return "Bu işlem için yetkiniz yok.";
  if (status === 404) return "İstenen kaynak bulunamadı.";
  if (status === 423) return "Çok fazla hatalı deneme. Hesap geçici olarak kilitlendi.";
  if (status === 429) return "Çok fazla istek gönderildi. Lütfen biraz bekleyin.";
  if (status >= 500) return "Sunucu hatası. Lütfen daha sonra tekrar deneyin.";
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

  // Default 25s timeout: SMTP bağlantısı yavaş olduğunda kullanıcı takılmasın.
  // Signal zaten verildiyse onu kullan, ek AbortController oluşturma.
  const controller = signal ? null : new AbortController();
  const fetchSignal = signal ?? controller?.signal;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (controller) {
    timeoutHandle = setTimeout(() => controller.abort(), 25_000);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers,
      body: payload,
      credentials: "include",
      signal: fetchSignal,
    });
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

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
