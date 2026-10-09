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

/**
 * Sprint 11.92 — Dönemin TEK kazananını seç.
 *
 * İki kademe birbirinden AYRIDIR (Onur, 9 Eki 2026):
 *   1. `selectForPeriod` → her kategoriden 1 **aday** (bakanlığa gönderilir)
 *   2. `selectPeriodWinner` → bu adaylar arasından **tek kazanan** (anasayfada yayınlanır)
 *
 * Önceden tek adımdı: UI'daki "👑 Ayın Fikri Seç" butonu yalnızca 1. adımı
 * çağırıyordu, `period_winners` hiç yazılmıyordu ve ana sayfa boş kalıyordu.
 */
export async function selectPeriodWinner(
  periodId: string,
  ideaId: string,
): Promise<{ message: string; periodId: string; ideaId: string; oncekiFikirId: string | null }> {
  return apiRequest(`/api/ministry/periods/${periodId}/kazanan`, {
    method: "POST",
    body: { ideaId },
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
