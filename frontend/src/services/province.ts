// İl AR-GE paneli servisleri (Aşama 4).

import { apiRequest } from "./api";
import type {
  ApproveResponse,
  AssignResponse,
  CandidateSummary,
  IdeaDetailResponse,
  IdeaEvaluationsResponse,
  InboxEntry,
  ProvinceEvaluatorRef,
  ReadMarkResponse,
  SubmitEvaluationsRequest,
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

export async function listEvaluators(signal?: AbortSignal): Promise<ProvinceEvaluatorRef[]> {
  return apiRequest<ProvinceEvaluatorRef[]>("/api/province/evaluators", { signal });
}

// Sprint 6: manager kendi iline evaluator atar (province_user_assignments)
export async function assignEvaluatorToProvince(
  userId: string,
): Promise<{ userId: string; provinceId: number }> {
  return apiRequest("/api/province/evaluators", {
    method: "POST",
    body: { userId },
  });
}

export async function removeEvaluatorFromProvince(
  userId: string,
): Promise<void> {
  await apiRequest(`/api/province/evaluators/${userId}`, {
    method: "DELETE",
  });
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

export async function submitEvaluations(
  id: string,
  scores: SubmitEvaluationsRequest["scores"],
): Promise<{ ideaId: string; evaluatedAt: string }> {
  return apiRequest(`/api/province/ideas/${id}/evaluations`, {
    method: "POST",
    body: { scores },
  });
}

export async function getEvaluations(
  id: string,
  signal?: AbortSignal,
): Promise<IdeaEvaluationsResponse> {
  return apiRequest<IdeaEvaluationsResponse>(`/api/province/ideas/${id}/evaluations`, { signal });
}

export async function getCandidates(signal?: AbortSignal): Promise<CandidateSummary[]> {
  return apiRequest<CandidateSummary[]>("/api/province/candidates", { signal });
}

export async function approveIdea(id: string): Promise<ApproveResponse> {
  return apiRequest<ApproveResponse>(`/api/province/ideas/${id}/approve`, {
    method: "POST",
  });
}
