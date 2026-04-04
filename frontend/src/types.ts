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
  todayWorkouts: { total_workouts: number; total_minutes: number; total_calories: number };
  weeklyProtein: { date: string; total_protein: number }[];
  weightHistory: { date: string; weight: number }[];
  allWeightHistory: { date: string; weight: number }[];
  latestWeight: number;
  recentWorkouts: WorkoutEntry[];
  weeklyWorkouts: { date: string; activity_type: string; duration_minutes: number; calories_burned: number }[];
  workoutsByType: { activity_type: string; count: number; avg_duration: number; total_calories: number }[];
  monthlyWorkoutStats: { total_workouts: number; total_minutes: number; total_calories: number; avg_duration: number };
  workoutStreak: number;
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

export interface WorkoutEntry {
  id: number;
  date: string;
  activity_type: string;
  duration_minutes: number;
  calories_burned: number;
  distance?: number;
  distance_unit?: string;
  source: string;
  notes?: string;
}

export interface ImportResult {
  weights: number;
  workouts: number;
  skipped: number;
  errors: string[];
}

export interface LabResult {
  test_name: string;
  value: string;
  reference_range: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  explanation: string;
  improvement: string;
}

export interface HealthRecord {
  id: number;
  filename: string;
  file_type: string;
  record_date?: string;
  category: string;
  raw_text?: string;
  summary?: string;
  key_findings?: string[];
  recommendations?: string[];
  lab_results?: LabResult[];
  analyzed_at?: string;
  created_at: string;
}

export interface HealthRecordUploadResult {
  results: Array<{
    id?: number;
    filename: string;
    summary?: string;
    key_findings?: string[];
    recommendations?: string[];
    lab_results?: LabResult[];
    category?: string;
    record_date?: string;
    error?: string;
  }>;
}
