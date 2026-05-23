export interface TrackMealResponse {
  isValidMeal: boolean;
  mealName: string;
  estimatedServing: string;
  totalCalories: number;
  carbsInGrams: number;
  fatInGrams: number;
  recommendations: RecommendationItem[];
}

export interface RecommendationItem {
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}