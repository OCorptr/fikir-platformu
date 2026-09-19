// Referans verileri — kategoriler ve iller.

import { apiRequest } from "./api";
import type { CategoryRef, ProvinceRef } from "../types";

export async function getCategories(signal?: AbortSignal): Promise<CategoryRef[]> {
  return apiRequest<CategoryRef[]>("/api/reference/categories", { signal });
}

export async function getProvinces(signal?: AbortSignal): Promise<ProvinceRef[]> {
  return apiRequest<ProvinceRef[]>("/api/reference/provinces", { signal });
}
