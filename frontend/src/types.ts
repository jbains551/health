export interface Goals {
  id: number;
  current_weight: number;
  goal_weight: number;
  protein_per_lb: number;
  workout_days: string;
}

export interface WeightEntry {
  id: number;
  date: string;
  weight: number;
  notes?: string;
}

export interface NutritionEntry {
  id: number;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface DashboardStats {
  goals: Goals;
  today: {
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
    protein_goal: number;
    protein_pct: number;
  };
  weeklyProtein: { date: string; total_protein: number }[];
  weightHistory: { date: string; weight: number }[];
  latestWeight: number;
}

export interface Meal {
  name: string;
  items: string[];
  protein: number;
  calories: number;
  prep: string;
}

export interface DayPlan {
  day: string;
  isWorkoutDay: boolean;
  meals: {
    breakfast: Meal;
    lunch: Meal;
    dinner: Meal;
    snacks: Meal[];
  };
  totals: { protein: number; calories: number };
}

export interface MealPlan {
  days: DayPlan[];
  shopping_list: string[];
  tips: string[];
}
