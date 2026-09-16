import { apiRequest } from "./client";

export type ReferenceItem = {
  id: number;
  name: string;
};

export function getProvinces(signal?: AbortSignal) {
  return apiRequest<ReferenceItem[]>("/reference/provinces", { signal });
}

export function getCategories(signal?: AbortSignal) {
  return apiRequest<ReferenceItem[]>("/reference/categories", { signal });
}
