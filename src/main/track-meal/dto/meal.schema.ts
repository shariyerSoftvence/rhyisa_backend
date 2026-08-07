export interface TrackMealResponse {
  isValidMeal: boolean;
  overall: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  };
  detectedMeals: Array<{
    name: string;
    estimatedServing: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  nutritionQualityScore: number;
  nutritionSummary: string;
}

// export interface RecommendationItem {
//   name: string;
//   time: string;
//   calories: number;
//   protein: number;
//   carbs: number;
//   fat: number;
// }
