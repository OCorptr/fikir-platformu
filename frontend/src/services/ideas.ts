// Öğrenci fikir servisleri — list, get, taslak kaydet/güncelle/sil, gönder.

import { apiRequest } from "./api";
import type {
  DraftCreatedResponse,
  DraftUpdatedResponse,
  StudentIdeaDto,
  SubmitResponse,
} from "../types";

// ===== Sprint 11.92 — KVKK yayım rızası (ver/geri çek) =====
// Kanun 3. madde gereği açık rıza HER ZAMAN geri alınabilir.

export async function getPublishConsent(signal?: AbortSignal): Promise<{ yayimRizasiVar: boolean }> {
  return apiRequest<{ yayimRizasiVar: boolean }>("/api/student/ideas/yayim-risasi", { signal });
}

export async function setPublishConsent(
  onay: boolean,
): Promise<{ yayimRizasiVerildi: boolean; mesaj: string }> {
  return apiRequest<{ yayimRizasiVerildi: boolean; mesaj: string }>(
    "/api/student/ideas/yayim-risasi",
    { method: "POST", body: { onay } },
  );
}

export async function listMyIdeas(signal?: AbortSignal): Promise<StudentIdeaDto[]> {
  return apiRequest<StudentIdeaDto[]>("/api/student/ideas", { signal });
}

export async function getMyIdea(id: string, signal?: AbortSignal): Promise<StudentIdeaDto> {
  return apiRequest<StudentIdeaDto>(`/api/student/ideas/${id}`, { signal });
}

export async function saveDraft(payload: {
  categoryId: number;
  content: string;
}): Promise<DraftCreatedResponse> {
  return apiRequest<DraftCreatedResponse>("/api/student/ideas/drafts", {
    method: "POST",
    body: payload,
  });
}

export async function updateDraft(
  id: string,
  payload: { categoryId: number; content: string },
): Promise<DraftUpdatedResponse> {
  return apiRequest<DraftUpdatedResponse>(`/api/student/ideas/drafts/${id}`, {
    method: "PUT",
    body: payload,
  });
}

export async function submitIdea(id: string): Promise<SubmitResponse> {
  return apiRequest<SubmitResponse>(`/api/student/ideas/${id}/submit`, { method: "POST" });
}

export async function deleteIdea(id: string): Promise<void> {
  await apiRequest<void>(`/api/student/ideas/${id}`, { method: "DELETE" });
}
