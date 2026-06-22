import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import OpenAI from 'openai';
import * as fs from 'fs';
import { TrackMealResponse } from '../track-meal/dto/meal.schema';
import { GenerateHealthGoalsPayload, HistoricalLogsInput, RecommendationInput } from './schema/goalGenerate';



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


}
