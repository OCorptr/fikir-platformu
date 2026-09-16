const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

type ErrorPayload = {
  message?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ErrorPayload | T)
    : undefined;

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ErrorPayload;
    const firstFieldError = Object.values(errorPayload.errors ?? {}).flat()[0];
    throw new ApiError(
      errorPayload.message
        ?? firstFieldError
        ?? errorPayload.title
        ?? "İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.",
      response.status,
      errorPayload.errors,
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
}
