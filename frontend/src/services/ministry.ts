// Bakanlık paneli servisleri (Aşama 6).

import { apiRequest } from "./api";
import type {
  Period,
  PeriodCandidatesResponse,
  PeriodSelectedResponse,
} from "../types";

export async function listPeriods(signal?: AbortSignal): Promise<Period[]> {
  return apiRequest<Period[]>("/api/ministry/periods", { signal });
}

export async function createPeriod(
  startAt?: string,
  label?: string,
): Promise<Period> {
  return apiRequest<Period>("/api/ministry/periods", {
    method: "POST",
    body: { startAt, label },
  });
}

export async function getPeriodCandidates(
  periodId: string,
  signal?: AbortSignal,
): Promise<PeriodCandidatesResponse> {
  return apiRequest<PeriodCandidatesResponse>(
    `/api/ministry/periods/${periodId}/candidates`,
    { signal },
  );
}

export async function selectForPeriod(
  periodId: string,
  categoryId: number,
  ideaId: string,
): Promise<{ periodId: string; categoryId: number; ideaId: string; selectedAt: string }> {
  return apiRequest(`/api/ministry/periods/${periodId}/select`, {
    method: "POST",
    body: { categoryId, ideaId },
  });
}

export async function getPeriodSelected(
  periodId: string,
  signal?: AbortSignal,
): Promise<PeriodSelectedResponse> {
  return apiRequest<PeriodSelectedResponse>(
    `/api/ministry/periods/${periodId}/selected`,
    { signal },
  );
}
