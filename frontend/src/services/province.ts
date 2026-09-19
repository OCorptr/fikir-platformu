// İl AR-GE paneli servisleri (Aşama 4).

import { apiRequest } from "./api";
import type {
  AssignResponse,
  IdeaDetailResponse,
  InboxEntry,
  ProvinceEvaluatorRef,
  ReadMarkResponse,
} from "../types";

export async function getInbox(signal?: AbortSignal): Promise<InboxEntry[]> {
  return apiRequest<InboxEntry[]>("/api/province/inbox", { signal });
}

export async function getProvinceIdea(
  id: string,
  signal?: AbortSignal,
): Promise<IdeaDetailResponse> {
  return apiRequest<IdeaDetailResponse>(`/api/province/ideas/${id}`, { signal });
}

export async function markRead(id: string): Promise<ReadMarkResponse> {
  return apiRequest<ReadMarkResponse>(`/api/province/ideas/${id}/read`, {
    method: "POST",
  });
}

export async function listEvaluators(): Promise<ProvinceEvaluatorRef[]> {
  return apiRequest<ProvinceEvaluatorRef[]>("/api/province/evaluators");
}

export async function assignEvaluator(
  id: string,
  evaluatorUserId: string,
): Promise<AssignResponse> {
  return apiRequest<AssignResponse>(`/api/province/ideas/${id}/assign`, {
    method: "POST",
    body: { evaluatorUserId },
  });
}
