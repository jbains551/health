import type { Goals, WeightEntry, NutritionEntry, DashboardStats, MealPlan } from './types';

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
};
