import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import OpenAI from 'openai';
import * as fs from 'fs';
import { TrackMealResponse } from '../track-meal/dto/meal.schema';
import {
  GenerateHealthGoalsPayload,
  HistoricalLogsInput,
  RecommendationInput,
} from './schema/goalGenerate';

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
        throw new BadRequestException(
          'OpenAI quota exceeded. Please add billing.',
        );
      }
      throw new InternalServerErrorException('Failed to convert voice to text');
    } finally {
      this.deleteFile(filePath);
    }
  }

  async processVoiceToMealDataDirect(
    filePath: string,
  ): Promise<TrackMealResponse> {
    try {
      // 1. Transcribe the audio file first using Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });

      if (!transcription.text) {
        return {
          isValidMeal: false,
          overall: {
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
          },
          detectedMeals: [],
          nutritionQualityScore: 0,
          nutritionSummary: 'No audio transcription text could be identified.',
        };
      }

      // 2. Feed the transcription directly into the structured model completion pipeline
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert clinical dietitian and structured food data extraction engine. 
          Your job is to analyze the text meal description transcribed from voice audio and convert it into structured macro-nutrient metadata.
          Follow these strict rules:
          1. Detect all individual food items or distinct constituent dishes present within the description.
          2. For each individual item, populate an entry in the 'detectedMeals' collection indicating its name, estimated slice size/portion metric parameters, and direct macronutrient weight properties.
          3. Summate individual weights accurately to establish the metrics calculated within the core 'overall' object scope.
          4. Assign a qualitative 'nutritionQualityScore' scaling from 0 to 100 adhering to official global clinical health models.
          5. Synthesize a singular concise sentence 'nutritionSummary' tracking macro balances or highlighting fiber indicators.
          6. Maintain perfect mathematical truth rules: overall.totalCalories = (overall.totalProtein * 4) + (overall.totalCarbs * 4) + (overall.totalFat * 9).`,
          },
          {
            role: 'user',
            content: transcription.text,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'multi_meal_voice_analysis_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isValidMeal: {
                  type: 'boolean',
                  description:
                    'True if recognizable food contents are detected within input text parameters.',
                },
                overall: {
                  type: 'object',
                  properties: {
                    totalCalories: { type: 'number' },
                    totalProtein: { type: 'number' },
                    totalCarbs: { type: 'number' },
                    totalFat: { type: 'number' },
                  },
                  required: [
                    'totalCalories',
                    'totalProtein',
                    'totalCarbs',
                    'totalFat',
                  ],
                  additionalProperties: false,
                },
                detectedMeals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      estimatedServing: { type: 'string' },
                      calories: { type: 'number' },
                      protein: { type: 'number' },
                      carbs: { type: 'number' },
                      fat: { type: 'number' },
                    },
                    required: [
                      'name',
                      'estimatedServing',
                      'calories',
                      'protein',
                      'carbs',
                      'fat',
                    ],
                    additionalProperties: false,
                  },
                },
                nutritionQualityScore: {
                  type: 'number',
                  description: 'A mathematical scale from 0 to 100.',
                },
                nutritionSummary: {
                  type: 'string',
                  description:
                    'A short qualitative evaluation summary matching structural insights.',
                },
              },
              required: [
                'isValidMeal',
                'overall',
                'detectedMeals',
                'nutritionQualityScore',
                'nutritionSummary',
              ],
              additionalProperties: false,
            },
          },
        },
      });

      return JSON.parse(
        response.choices[0].message.content || '{}',
      ) as TrackMealResponse;
    } catch (error: any) {
      if (error?.status === 429) {
        throw new BadRequestException(
          'OpenAI quota exceeded. Please add billing.',
        );
      }
      throw new InternalServerErrorException(
        `Failed to process meal infrastructure voice transcription parsing pipeline: ${error.message}`,
      );
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
        throw new BadRequestException(
          'OpenAI quota exceeded. Please add billing.',
        );
      }
      throw new InternalServerErrorException(
        'Failed to extract text from image',
      );
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
            content: `You are an expert clinical dietitian and structured food data extraction engine. 
                    Your job is to analyze the text meal description provided by the user and convert it into structured macro-nutrient metadata.
                    Follow these strict rules:
                    1. Detect all individual food items or distinct constituent dishes present within the textual description.
                    2. For each individual item, populate an entry in the 'detectedMeals' collection indicating its name, estimated slice size/portion metric parameters, and direct macronutrient weight properties.
                    3. Summate individual weights accurately to establish the metrics calculated within the core 'overall' object scope.
                    4. Assign a qualitative 'nutritionQualityScore' scaling from 0 to 100 adhering to official global clinical health models.
                    5. Synthesize a singular concise sentence 'nutritionSummary' tracking macro balances or highlighting fiber indicators.
                    6. Maintain perfect mathematical truth rules: overall.totalCalories = (overall.totalProtein * 4) + (overall.totalCarbs * 4) + (overall.totalFat * 9).`,
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'multi_meal_text_analysis_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isValidMeal: {
                  type: 'boolean',
                  description:
                    'True if recognizable food contents are detected within input text parameters.',
                },
                overall: {
                  type: 'object',
                  properties: {
                    totalCalories: { type: 'number' },
                    totalProtein: { type: 'number' },
                    totalCarbs: { type: 'number' },
                    totalFat: { type: 'number' },
                  },
                  required: [
                    'totalCalories',
                    'totalProtein',
                    'totalCarbs',
                    'totalFat',
                  ],
                  additionalProperties: false,
                },
                detectedMeals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      estimatedServing: { type: 'string' },
                      calories: { type: 'number' },
                      protein: { type: 'number' },
                      carbs: { type: 'number' },
                      fat: { type: 'number' },
                    },
                    required: [
                      'name',
                      'estimatedServing',
                      'calories',
                      'protein',
                      'carbs',
                      'fat',
                    ],
                    additionalProperties: false,
                  },
                },
                nutritionQualityScore: {
                  type: 'number',
                  description: 'A mathematical scale from 0 to 100.',
                },
                nutritionSummary: {
                  type: 'string',
                  description:
                    'A short qualitative evaluation summary matching structural insights.',
                },
              },
              required: [
                'isValidMeal',
                'overall',
                'detectedMeals',
                'nutritionQualityScore',
                'nutritionSummary',
              ],
              additionalProperties: false,
            },
          },
        },
      });

      return JSON.parse(
        response.choices[0].message.content || '{}',
      ) as TrackMealResponse;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to extract structured meal metrics from text: ${error.message}`,
      );
    }
  }

  async processImageToMealDataDirect(filePath: string): Promise<any> {
    try {
      const base64Image = fs.readFileSync(filePath).toString('base64');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert clinical dietitian and AI computer vision food analysis engine. 
                    Your job is to analyze the user-provided meal image and extract structural macro-nutrient metadata.
                    Follow these strict rules:
                    1. Detect all individual food items or distinct constituent dishes present within the image frame workspace.
                    2. For each individual item, populate an entry in the 'detectedMeals' collection indicating its name, estimated slice size/portion metric parameters, and direct macronutrient weight properties.
                    3. Summate individual weights accurately to establish the metrics calculated within the core 'overall' object scope.
                    4. Assign a qualitative 'nutritionQualityScore' scaling from 0 to 100 adhering to official global clinical health models.
                    5. Synthesize a singular concise sentence 'nutritionSummary' tracking macro balances or highlighting fiber indicators.
                    6. Maintain perfect mathematical truth rules: overall.totalCalories = (overall.totalProtein * 4) + (overall.totalCarbs * 4) + (overall.totalFat * 9).`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Process this food composition asset image and return raw JSON data complying precisely with schema definitions.',
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
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'multi_meal_vision_analysis_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                isValidMeal: {
                  type: 'boolean',
                  description:
                    'True if recognizable food contents are detected within image array pixels.',
                },
                overall: {
                  type: 'object',
                  properties: {
                    totalCalories: { type: 'number' },
                    totalProtein: { type: 'number' },
                    totalCarbs: { type: 'number' },
                    totalFat: { type: 'number' },
                  },
                  required: [
                    'totalCalories',
                    'totalProtein',
                    'totalCarbs',
                    'totalFat',
                  ],
                  additionalProperties: false,
                },
                detectedMeals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      estimatedServing: { type: 'string' },
                      calories: { type: 'number' },
                      protein: { type: 'number' },
                      carbs: { type: 'number' },
                      fat: { type: 'number' },
                    },
                    required: [
                      'name',
                      'estimatedServing',
                      'calories',
                      'protein',
                      'carbs',
                      'fat',
                    ],
                    additionalProperties: false,
                  },
                },
                nutritionQualityScore: {
                  type: 'number',
                  description: 'A mathematical scale from 0 to 100.',
                },
                nutritionSummary: {
                  type: 'string',
                  description:
                    'A short qualitative evaluation summary matching structural insights.',
                },
              },
              required: [
                'isValidMeal',
                'overall',
                'detectedMeals',
                'nutritionQualityScore',
                'nutritionSummary',
              ],
              additionalProperties: false,
            },
          },
        },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      if (error?.status === 429) {
        throw new BadRequestException(
          'OpenAI quota exceeded. Please add billing.',
        );
      }
      throw new InternalServerErrorException(
        `Failed to process meal infrastructure image parsing pipeline: ${error.message}`,
      );
    } finally {
      this.deleteFile(filePath);
    }
  }

  async generateDailyHealthGoals(payload: GenerateHealthGoalsPayload) {
    try {
      const response = await this.openai.chat.completions.create({
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

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to generate AI health goals: ${error.message}`,
      );
    }
  }

  async generateDailyRecommendations(data: RecommendationInput) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an elite clinical nutrition AI. Analyze the user's progress against their daily goals and provide exactly 4 actionable insights.
            Follow these strict rules:
            1. Provide 4 recommendations matching user gaps (e.g., lower hydration, protein requirements, sleep improvements).
            2. For each recommendation, provide a "title", a "type" ('nutrition' | 'hydration' | 'activity' | 'sleep'), and an "impact" ('High Impact' | 'Medium Impact' | 'Great Job!').
            3. Return ONLY valid JSON matching the requested schema structure.`,
          },
          {
            role: 'user',
            content: JSON.stringify(data),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'daily_recommendations_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                recommendations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      type: {
                        type: 'string',
                        enum: ['nutrition', 'hydration', 'activity', 'sleep'],
                      },
                      impact: {
                        type: 'string',
                        enum: ['High Impact', 'Medium Impact', 'Great Job!'],
                      },
                    },
                    required: ['title', 'type', 'impact'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['recommendations'],
              additionalProperties: false,
            },
          },
        },
      });

      return JSON.parse(
        response.choices[0].message.content || '{"recommendations": []}',
      );
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to generate AI clinical health updates: ${error.message}`,
      );
    }
  }

  async generateHistoricalIntelligenceAnalysis(data: HistoricalLogsInput) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert clinical health informatics scientist and wellness intelligence engine. 
          Your job is to analyze the user's historical 30-day health logs dataset and compile structural insights.
          Follow these strict rules:
          1. Evaluate the trends in healthScore, sleep, steps, and hydration across the timeline.
          2. Generate an overall evaluation message summarising the multi-week progression trajectory.
          3. Isolate the key areas working well and the core vulnerabilities needing immediate programmatic behavioral corrections.
          4. Return ONLY valid JSON matching the strict schema layout.`,
          },
          {
            role: 'user',
            content: JSON.stringify(data),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'historical_intelligence_analysis_schema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                historicalSummary: {
                  type: 'string',
                  description:
                    'A comprehensive qualitative review tracking the 30-day trajectory trends.',
                },
                keyStrengths: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'List of behavioral indicators matching positive metrics compliance over the past month.',
                },
                vulnerabilities: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'List of critical gaps discovered across the multi-week logging loop parameters.',
                },
              },
              required: [
                'historicalSummary',
                'keyStrengths',
                'vulnerabilities',
              ],
              additionalProperties: false,
            },
          },
        },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to compile AI insights on the historical tracking timeline data array: ${error.message}`,
      );
    }
  }
}
