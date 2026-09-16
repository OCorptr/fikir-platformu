export type HealthResponse = {
  status: string;
  application: string;
  utcTime: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API sağlık kontrolü başarısız: ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
