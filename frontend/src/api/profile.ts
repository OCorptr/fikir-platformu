import { apiRequest } from "./client";

export type StudentProfile = {
  provinceId: number;
  provinceName: string;
  district: string | null;
  school: string | null;
  grade: number | null;
  studentNumber: string | null;
};

export type ProfileResponse = {
  email: string;
  firstName: string;
  lastName: string;
  emailConfirmed: boolean;
  roles: string[];
  profile: StudentProfile | null;
};

export type UpdateProfileRequest = {
  provinceId: number;
  district: string;
  school: string;
  grade: number | null;
  studentNumber: string;
  firstName: string;
  lastName: string;
};

export function getProfile(signal?: AbortSignal) {
  return apiRequest<ProfileResponse>("/profile/", { signal });
}

export function updateProfile(request: UpdateProfileRequest) {
  return apiRequest<{ message: string }>("/profile/", {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
