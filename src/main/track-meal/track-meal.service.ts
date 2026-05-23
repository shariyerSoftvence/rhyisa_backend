import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { TrackMealTextDto } from './dto/track-meal.dto';

@Injectable()
export class TrackMealService {
  constructor(private readonly openaiService: OpenaiService) {}

  async trackFromText(dto: TrackMealTextDto) {
    try {
      const mealData = await this.openaiService.processTextToMealData(dto.text);
      
      if (!mealData.isValidMeal) {
        throw new BadRequestException('The provided text could not be recognized as a valid meal item');
      }

      return {
        success: true,
        data: mealData,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to track meal from text: ${error.message}`);
    }
  }

  async trackFromVoice(filePath: string) {
    if (!filePath) {
      throw new BadRequestException('Voice audio path context missing');
    }

    try {
      // Step 1: Convert audio to raw text transcription
      const transcriptionResult = await this.openaiService.voiceToText(filePath);
      
      // Step 2: Extract professional nutrition metrics from transcription string
      const mealData = await this.openaiService.processTextToMealData(transcriptionResult.text);

      if (!mealData.isValidMeal) {
        throw new BadRequestException('The transcribed audio description could not be recognized as a valid food item');
      }

      return {
        success: true,
        data: mealData,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to track meal from voice configuration: ${error.message}`);
    }
  }

  async trackFromImage(filePath: string) {
    if (!filePath) {
      throw new BadRequestException('Image attachment path context missing');
    }

    try {
      // Step 1: Pass image to GPT to analyze and output food details text description
      const descriptionResult = await this.openaiService.imageToText(filePath);
      
      // Step 2: Pipeline that detailed description to get strict nutrition object schema
      const mealData = await this.openaiService.processTextToMealData(descriptionResult.text);

      if (!mealData.isValidMeal) {
        throw new BadRequestException('The uploaded food image could not be verified or recognized');
      }

      return {
        success: true,
        data: mealData,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to track meal from image recognition: ${error.message}`);
    }
  }
}