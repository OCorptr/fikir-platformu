// Backend API tipleri — DTO'lar ile birebir uyumlu.

export type IdeaStatus =
  | "Draft"
  | "Submitted"
  | "InEvaluation"
  | "EvaluationCompleted"
  | "Locked"
  | "Planned"
  | "ImplementationInProgress"
  | "ImplementationCompleted"
  | "ImplementationFailed"
  | "Deleted";

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  Draft: "Taslak",
  Submitted: "Gönderildi",
  InEvaluation: "Değerlendirmede",
  EvaluationCompleted: "Değerlendirildi",
  Locked: "Kilitli",
  Planned: "Planlandı",
  ImplementationInProgress: "Uygulamada",
  ImplementationCompleted: "Uygulandı",
  ImplementationFailed: "Başarısız",
  Deleted: "Silindi",
};

export interface CategoryRef {
  id: number;
  name: string;
}

export interface ProvinceRef {
  id: number;
  name: string;
}

// /api/auth/me — kimlik doğrulamasız da çağrılabilir
// plan §49: aynı tarayıcıda öğrenci + il + bakanlık oturumu aynı anda bulunabilir.
export interface MeSession {
  context: "student" | "province" | "ministry" | "unknown";
  email: string;
  firstName: string;
  lastName: string;
  emailConfirmed: boolean;
  roles: string[];
  profile: StudentProfileDto | null;
}

export interface MeAuthenticated {
  authenticated: true;
  sessions: MeSession[];
}

export interface MeAnonymous {
  authenticated: false;
}

export type MeResponse = MeAuthenticated | MeAnonymous;

// Eski tekil erişim için yardımcı (sayfa kendi context'ini seçer)
export function sessionForContext(me: MeResponse, ctx: MeSession["context"]): MeSession | null {
  if (!me.authenticated) return null;
  return me.sessions.find((s) => s.context === ctx) ?? null;
}

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

// İl AR-GE paneli (Aşama 4)

// /api/province/inbox — gelen kutusu
export interface InboxEntry {
  ideaId: string;
  categoryId: number;
  categoryName: string;
  provinceId: number;
  provinceName: string;
  content: string;
  submittedAt: string;
  studentFirstName: string;
  studentLastName: string;
  studentSchool: string | null;
  studentGrade: number | null;
  studentNumber: string | null;
  assignedEvaluatorUserIds: string[];
  isReadByMe: boolean;
  readAtByMe: string | null;
  evaluationCount: number;
  lastEvaluatedAt: string | null;
  averageScore: number | null;
  isMinistrySelected: boolean;
}

// Aday eşiği — plan §26: ortalama puan eşiği geçen fikirler bakanlığa aday olur.
export const ADAY_ESIK = 3.5;

export type SonucDurumu = "ayinFikri" | "aday" | "yetersiz" | "beklemede";

export function sonucDurumu(e: Pick<InboxEntry, "isMinistrySelected" | "averageScore" | "evaluationCount">): SonucDurumu {
  if (e.isMinistrySelected) return "ayinFikri";
  if (e.evaluationCount === 0 || e.averageScore == null) return "beklemede";
  if (e.averageScore >= ADAY_ESIK) return "aday";
  return "yetersiz";
}

// Aday ⭐, Ayın Fikri 👑 — iki ayrı ikon, ayırt edilebilir.
export const SONUC_DURUM_IKON: Record<SonucDurumu, { ikon: string; etiket: string; sinif: "altin" | "yesil" | "turuncu" | "mavi" }> = {
  ayinFikri: { ikon: "👑", etiket: "Ayın Fikri", sinif: "altin" },
  aday: { ikon: "🌟", etiket: "Aday", sinif: "yesil" },
  yetersiz: { ikon: "⚠️", etiket: "Yetersiz Puan", sinif: "turuncu" },
  beklemede: { ikon: "⏳", etiket: "Beklemede", sinif: "mavi" },
};

// /api/province/ideas/{id} — başvuru detayı
export interface IdeaDetailStudentProfile {
  applicationUserId: string;
  firstName: string;
  lastName: string;
  provinceId: number;
  provinceName: string;
  district: string | null;
  school: string | null;
  grade: number | null;
  studentNumber: string | null;
}

export interface IdeaDetailIdea {
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
  studentProfile: IdeaDetailStudentProfile;
}

export interface IdeaDetailResponse {
  idea: IdeaDetailIdea;
  readByMe: boolean;
  readAt: string | null;
  assignedEvaluatorIds: string[];
}

// /api/province/evaluators — ProvinceManager için değerlendirici listesi
export interface ProvinceEvaluatorRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// POST /api/province/ideas/{id}/read — okundu işaretleme cevabı
export interface ReadMarkResponse {
  ideaId: string;
  readAt: string;
}

// POST /api/province/ideas/{id}/assign — atama cevabı
export interface AssignResponse {
  ideaId: string;
  evaluatorUserId: string;
  assignedAt: string;
}

// Aşama 5 — Değerlendirme

export type EvaluationCriterion =
  | "Yenilikcilik"
  | "Uygulanabilirlik"
  | "Etki"
  | "Ozgunluk";

export const EVALUATION_CRITERIA: EvaluationCriterion[] = [
  "Yenilikcilik",
  "Uygulanabilirlik",
  "Etki",
  "Ozgunluk",
];

export const CRITERION_LABELS: Record<EvaluationCriterion, string> = {
  Yenilikcilik: "Yenilikçilik",
  Uygulanabilirlik: "Uygulanabilirlik",
  Etki: "Etki",
  Ozgunluk: "Özgünlük",
};

export interface EvaluationEntry {
  ideaId: string;
  evaluatorUserId: string;
  evaluatorFirstName: string | null;
  evaluatorLastName: string | null;
  criterion: EvaluationCriterion;
  score: number;
  comment: string | null;
  evaluatedAt: string;
}

export interface IdeaEvaluationsResponse {
  evaluations: EvaluationEntry[];
  averages: Partial<Record<EvaluationCriterion, number>>;
  threshold: number;
}

export interface CandidateSummary {
  ideaId: string;
  categoryId: number;
  categoryName: string;
  content: string;
  averageScore: number;
  completedAt: string;
}

export interface SubmitEvaluationItem {
  criterion: EvaluationCriterion;
  score: number;
  comment?: string | null;
}

export interface SubmitEvaluationsRequest {
  scores: SubmitEvaluationItem[];
}

export interface ApproveResponse {
  ideaId: string;
  approvedAt: string;
}

// Aşama 6 — Bakanlık

export type PeriodStatus = "Open" | "SelectionComplete" | "Archived";

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  Open: "Açık",
  SelectionComplete: "Seçim Tamamlandı",
  Archived: "Arşivlendi",
};

// 3 aylık dönem etiketi: "2026 III. Dönem (Temmuz-Eylül)"
// Calendar quarter mantığı: başlangıç ayının ait olduğu çeyreğin tam aralığı.
// Eylül başlangıç → III. Dönem (Temmuz-Eylül), Ekim başlangıç → IV. Dönem (Ekim-Aralık).
// label backend'den saçma gelirse (örn "Dönem 2026-09-20") StartAt'tan yeniden hesaplar.
const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
function ceyrekAraligi(ay: number): string {
  const q = Math.floor(ay / 3);
  return `${AY_ADLARI[q * 3]}–${AY_ADLARI[q * 3 + 2]}`;
}
function ceyrekNo(ay: number): 1 | 2 | 3 | 4 {
  return (Math.floor(ay / 3) + 1) as 1 | 2 | 3 | 4;
}
const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

export function donemEtiketi(p: Pick<Period, "label" | "startAt" | "endAt">): string {
  const baslangic = new Date(p.startAt);
  const yil = baslangic.getFullYear();
  const sira = ROMAN[ceyrekNo(baslangic.getMonth())] ?? "I";
  const yeni = `${yil} ${sira}. Dönem (${ceyrekAraligi(baslangic.getMonth())})`;
  // backend etiketi zaten temiz formatdaysa (örn "2026 IV. Dönem (Ekim-Aralık)") onu kabul et,
  // ama "Dönem 2026-XX-XX" gibi saçma ise yeni formatla değiştir.
  if (!p.label || /^D[öo]nem \d{4}-\d{2}-\d{2}$/i.test(p.label.trim())) return yeni;
  return p.label;
}

// Sağ üst rozette kullanılan kısa etiket: "IV. Dönem · 2026"
export function donemRozet(p: Pick<Period, "label" | "startAt">): string {
  const baslangic = new Date(p.startAt);
  const sira = ROMAN[ceyrekNo(baslangic.getMonth())] ?? "I";
  return `${sira}. Dönem · ${baslangic.getFullYear()}`;
}

export interface Period {
  id: string;
  label: string;
  startAt: string;
  endAt: string;
  status: PeriodStatus;
  createdAt: string;
}

export interface PeriodCandidate {
  id: string;
  provinceId: number;
  provinceName: string;
  content: string;
  updatedAt: string;
  isLocked: boolean;
  isSelected: boolean;
}

export interface PeriodCategoryGroup {
  categoryId: number;
  categoryName: string;
  selected: boolean;
  selectedIdeaId?: string;
  ideas: PeriodCandidate[];
}

export interface PeriodCandidatesResponse {
  period: Period;
  categories: PeriodCategoryGroup[];
}

export interface SelectedIdea {
  CategoryId: number;
  Idea: PeriodCandidate | null;
  SelectedAt: string;
  SelectedByUserId: string;
}

export interface PeriodSelectedResponse {
  period: Period;
  selections: SelectedIdea[];
}

// Aşama 8 — Hayata geçirme

export type ImplementationStatus =
  | "NotStarted"
  | "InProgress"
  | "Completed"
  | "Failed";

export const IMPLEMENTATION_STATUSES: ImplementationStatus[] = [
  "NotStarted",
  "InProgress",
  "Completed",
  "Failed",
];

export const IMPLEMENTATION_LABELS: Record<ImplementationStatus, string> = {
  NotStarted: "Başlamadı",
  InProgress: "Uygulamada",
  Completed: "Tamamlandı",
  Failed: "Başarısız",
};

export interface ImplementationReport {
  id: string;
  ideaId: string;
  status: ImplementationStatus;
  note: string;
  reportedByUserId: string;
  reportedAt: string;
}

export interface ImplementationSummary {
  ideaId: string;
  categoryId: number;
  categoryName: string;
  provinceId: number;
  provinceName: string;
  content: string;
  status: { Status: string; PeriodLabel: string };
  updatedAt: string;
}

export interface SubmitImplementationRequest {
  status: ImplementationStatus;
  note?: string;
}
