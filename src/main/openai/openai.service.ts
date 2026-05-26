import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import OpenAI from 'openai';
import * as fs from 'fs';
import { TrackMealResponse } from '../track-meal/dto/meal.schema';
import { GenerateHealthGoalsPayload } from './schema/goalGenerate';

@Injectable()
export class OpenaiService {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  async voiceToText(filePath: string) {
    try {
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });

      return {
        success: true,
        text: response.text,
      };
    } catch (error: any) {
      console.error(error);
      if (error?.status === 429) {
        throw new BadRequestException('OpenAI quota exceeded. Please add billing.');
      }
      throw new InternalServerErrorException('Failed to convert voice to text');
    } finally {
      this.deleteFile(filePath);
    }
  }

  async imageToText(filePath: string) {
    try {
      const base64Image = fs.readFileSync(filePath).toString('base64');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Identify the meal inside this image. Describe what the food item is and its components in detail so it can be parsed for nutritional values.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });

      return {
        success: true,
        text: response.choices[0].message.content || '',
      };
    } catch (error: any) {
      console.error(error);
      if (error?.status === 429) {
        throw new BadRequestException('OpenAI quota exceeded. Please add billing.');
      }
      throw new InternalServerErrorException('Failed to extract text from image');
    } finally {
      this.deleteFile(filePath);
    }
  }

  private deleteFile(filePath: string) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async processTextToMealData(rawText: string): Promise<TrackMealResponse> {
    try { 
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert, board-certified clinical dietitian and food data extraction engine. 
                  Your job is to analyze the food description provided by the user and convert it into structured macro-nutrient data.
                  Follow these strict guidelines for accuracy:
                  1. Estimate values based on standardized USDA food composition data.
                  2. Ensure mathematical integrity: Total calories must accurately align with the extracted macronutrients using the standard Atwater factor formula: Calories = (Protein * 4) + (Carbs * 4) + (Fat * 9).
                  3. Generate exactly 3-4 healthy meal recommendations related to or complementary to the tracked food under the "recommendations" array field. Provide accurate macro profiles for each recommendation.
                  4. If the input is empty, completely nonsensical, or does not contain any reference to food or meals, set "isValidMeal" to false and return fallback/null values. Do not hallucinate data.`,
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'professional_meal_analysis_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isValidMeal: { 
                  type: 'boolean', 
                  description: 'True if the input successfully describes an actual food item or recognizable meal, false otherwise.' 
                },
                mealName: { 
                  type: 'string', 
                  description: 'The standardized name of the dish or food item. If not a valid meal, return "Unknown/Invalid Input".' 
                },
                estimatedServing: { 
                  type: 'string', 
                  description: 'The estimated standard portion size, e.g., "1 bowl (approx 300g)", "1 medium piece". If invalid, return "N/A".' 
                },
                totalCalories: { 
                  type: 'number', 
                  description: 'Total calculated energy content in kcal. Must match macronutrient mathematical weights.' 
                },
                proteinInGrams: { 
                  type: 'number', 
                  description: 'Estimated protein content in grams.' 
                },
                carbsInGrams: { 
                  type: 'number', 
                  description: 'Estimated total carbohydrates content in grams.' 
                },
                fatInGrams: { 
                  type: 'number', 
                  description: 'Estimated total fats content in grams.' 
                },
                  recommendations: {
                  type: 'array',
                  description: 'A list of complementary or alternative healthy meal recommendations based on the current food profile.',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Name of the recommended food item, e.g., "Greek Yogurt Bowl".' },
                      time: { type: 'string', description: 'Suggested generic time context or standard meal gap placeholder, e.g., "8:30 AM" or "Snack".' },
                      calories: { type: 'number', description: 'Calories of the recommendation.' },
                      protein: { type: 'number', description: 'Protein in grams.' },
                      carbs: { type: 'number', description: 'Carbohydrates in grams.' },
                      fat: { type: 'number', description: 'Fat in grams.' }
                    },
                    required: ['name', 'time', 'calories', 'protein', 'carbs', 'fat'],
                    additionalProperties: false
                  }
                }
              },
              required: [
                'isValidMeal',
                'mealName', 
                'estimatedServing', 
                'totalCalories', 
                'proteinInGrams', 
                'carbsInGrams', 
                'fatInGrams',
                'recommendations'
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const parsedData = JSON.parse(response.choices[0].message.content || '{}');
      return parsedData as TrackMealResponse;
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to extract structured meal metrics: ${error.message}`);
    }
  }


  async generateDailyHealthGoals(
  payload: GenerateHealthGoalsPayload,
) {
  try {
    const response =
      await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',

        messages: [
          {
            role: 'system',
            content: `
          You are an elite clinical nutrition AI and fitness planning engine.
          Your task:
                Generate realistic daily health goals for a user.
          Rules:
          1. Goals must be realistic and safe.
          2. Use BMI, activity level, and goals.
          3. Protein should align with body weight and muscle goals.
          4. Water intake should scale with body weight.
          5. Weight loss goals should reduce calories moderately.
          6. Muscle gain goals should increase protein/calories.
          7. Return ONLY valid JSON.
            `,
          },

          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],

        response_format: {
          type: 'json_schema',

          json_schema: {
            name: 'daily_health_goals_schema',

            strict: true,

            schema: {
              type: 'object',

              properties: {
                calorieGoal: {
                  type: 'number',
                },

                proteinGoal: {
                  type: 'number',
                },

                carbsGoal: {
                  type: 'number',
                },

                fatGoal: {
                  type: 'number',
                },

                waterGoal: {
                  type: 'number',
                },

                stepsGoal: {
                  type: 'number',
                },

                sleepGoalHours: {
                  type: 'number',
                },

                reasoning: {
                  type: 'string',
                },
              },

              required: [
                'calorieGoal',
                'proteinGoal',
                'carbsGoal',
                'fatGoal',
                'waterGoal',
                'stepsGoal',
                'sleepGoalHours',
                'reasoning',
              ],

              additionalProperties: false,
            },
          },
        },
      });

    return JSON.parse(
      response.choices[0].message.content || '{}',
    );
  } catch (error: any) {
    throw new InternalServerErrorException(
      `Failed to generate AI health goals: ${error.message}`,
    );
  }
}
}