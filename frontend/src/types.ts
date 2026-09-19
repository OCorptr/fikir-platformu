// Backend API tipleri — DTO'lar ile birebir uyumlu.

export type IdeaStatus =
  | "Draft"
  | "Submitted"
  | "InEvaluation"
  | "EvaluationCompleted"
  | "Locked"
  | "Deleted";

export interface CategoryRef {
  id: number;
  name: string;
}

export interface ProvinceRef {
  id: number;
  name: string;
}

// /api/auth/me — kimlik doğrulamasız da çağrılabilir
export interface MeAuthenticated {
  authenticated: true;
  email: string;
  firstName: string;
  lastName: string;
  emailConfirmed: boolean;
  roles: string[];
  profile: StudentProfileDto | null;
}

export interface MeAnonymous {
  authenticated: false;
}

export type MeResponse = MeAuthenticated | MeAnonymous;

export interface StudentProfileDto {
  id: string;
  provinceId: number;
  provinceName: string;
  district: string | null;
  school: string | null;
  grade: number | null;
  studentNumber: string | null;
}

// Öğrencinin kendi fikir kaydı
export interface StudentIdeaDto {
  id: string;
  categoryId: number;
  categoryName: string;
  provinceId: number;
  provinceName: string;
  content: string;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  canEdit: boolean;
}

// POST /api/student/ideas/drafts — 201
export interface DraftCreatedResponse {
  id: string;
  status: IdeaStatus;
  createdAt: string;
}

// PUT /api/student/ideas/drafts/{id} — 200
export interface DraftUpdatedResponse {
  id: string;
  status: IdeaStatus;
  updatedAt: string;
}

// POST /api/student/ideas/{id}/submit — 200
export interface SubmitResponse {
  ideaId: string;
  status: IdeaStatus;
  requiresReview: boolean;
  message: string;
}

// POST /api/auth/register — 202
export interface RegisterResponse {
  message: string;
}

// POST /api/auth/login — 200
export interface LoginResponse {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

// Genel hata cevabı (RFC 7807 / ValidationProblem)
export interface ApiError {
  message?: string;
  errors?: Record<string, string[]>;
  detail?: string;
  title?: string;
  status?: number;
}
