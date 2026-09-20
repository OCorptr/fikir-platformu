// Hayata geçirme servisleri (Aşama 8).

import { apiRequest } from "./api";
import type {
  ImplementationReport,
  ImplementationSummary,
  SubmitImplementationRequest,
} from "../types";

export async function submitImplementationReport(
  ideaId: string,
  payload: SubmitImplementationRequest,
): Promise<{ ideaId: string; reportId: string; reportedAt: string }> {
  return apiRequest(`/api/province/ideas/${ideaId}/implementations`, {
    method: "POST",
    body: payload,
  });
}

export async function getImplementationReports(
  ideaId: string,
  signal?: AbortSignal,
): Promise<ImplementationReport[]> {
  return apiRequest<ImplementationReport[]>(`/api/province/ideas/${ideaId}/implementations`, { signal });
}

export async function getImplementationSummary(
  signal?: AbortSignal,
): Promise<ImplementationSummary[]> {
  return apiRequest<ImplementationSummary[]>("/api/ministry/implementations", { signal });
}
