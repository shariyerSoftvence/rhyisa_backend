export interface GenerateHealthGoalsPayload {
  age: number;
  gender: string;
  height: number;
  weight: number;
  currentActivityLevel: string;
  currentDiet: string;
  primaryGoal: string[];
  motivationLevel: number;
  supplements: string[];
}

export interface RecommendationInput {
  goals: {
    calorieGoal: number;
    waterGoal: number;
    proteinGoal: number;
    carbsGoal: number;
    fatGoal: number;
    stepsGoal: number;
    sleepGoalHours: number;
  };
  progress: {
    calories: number;
    waterGlasses: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    steps: number;
    sleepHours: number;
  };
}

export interface HistoricalLogsInput {
  logs: Array<{
    date: Date;
    healthScore: number;
    calories: number;
    waterGlasses: number;
    steps: number;
    sleepHours: number;
  }>;
}
