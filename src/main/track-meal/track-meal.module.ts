import { Module } from '@nestjs/common';
import { TrackMealController } from './track-meal.controller';
import { TrackMealService } from './track-meal.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  controllers: [TrackMealController],
  providers: [TrackMealService, OpenaiService],
})
export class TrackMealModule {}
