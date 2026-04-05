import type { Goals, WeightEntry, NutritionEntry, DashboardStats, MealPlan, WorkoutEntry, ImportResult, HealthRecord, HealthRecordUploadResult } from './types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Goals
  getGoals: () => request<Goals>('/goals'),
  updateGoals: (data: Partial<Goals>) =>
    request<{ success: boolean }>('/goals', { method: 'PUT', body: JSON.stringify(data) }),

  // Weight
  getWeights: () => request<WeightEntry[]>('/weight'),
  addWeight: (data: { date: string; weight: number; notes?: string }) =>
    request<WeightEntry>('/weight', { method: 'POST', body: JSON.stringify(data) }),
  deleteWeight: (id: number) =>
    request<{ success: boolean }>(`/weight/${id}`, { method: 'DELETE' }),

  // Nutrition
  getNutrition: (date?: string) =>
    request<NutritionEntry[]>('/nutrition' + (date ? `?date=${date}` : '')),
  addNutrition: (data: Omit<NutritionEntry, 'id'>) =>
    request<NutritionEntry>('/nutrition', { method: 'POST', body: JSON.stringify(data) }),
  deleteNutrition: (id: number) =>
    request<{ success: boolean }>(`/nutrition/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request<DashboardStats>('/stats'),

  // Meal Plans
  getLatestMealPlan: () =>
    request<{ plan: MealPlan; generated_at: string } | null>('/mealplan/latest'),
  generateMealPlan: () =>
    request<{ plan: MealPlan; generated_at: string }>('/mealplan/generate', { method: 'POST' }),

  // Workouts
  getWorkouts: (date?: string) =>
    request<WorkoutEntry[]>('/workouts' + (date ? `?date=${date}` : '')),
  addWorkout: (data: Omit<WorkoutEntry, 'id' | 'source'>) =>
    request<WorkoutEntry>('/workouts', { method: 'POST', body: JSON.stringify(data) }),
  deleteWorkout: (id: number) =>
    request<{ success: boolean }>(`/workouts/${id}`, { method: 'DELETE' }),

  // Apple Health Import
  importAppleHealth: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/import/apple-health`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Import failed');
    }
    return res.json();
  },

  // Health Records
  getHealthRecords: () => request<HealthRecord[]>('/health-records'),
  getHealthRecord: (id: number) => request<HealthRecord>(`/health-records/${id}`),
  deleteHealthRecord: (id: number) =>
    request<{ success: boolean }>(`/health-records/${id}`, { method: 'DELETE' }),
  // Health Q&A
  askHealth: (question: string, history: { role: string; content: string }[]) =>
    request<{ answer: string }>('/ask', { method: 'POST', body: JSON.stringify({ question, history }) }),

  uploadHealthRecords: async (files: File[]): Promise<HealthRecordUploadResult> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${BASE}/health-records/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },
};
