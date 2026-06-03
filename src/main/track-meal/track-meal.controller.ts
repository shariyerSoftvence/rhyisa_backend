import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TrackMealService } from './track-meal.service';
import { TrackMealTextDto } from './dto/track-meal.dto';

@ApiTags('Track Meal Analytics Engine')
@Controller('track-meal')
export class TrackMealController {
  constructor(private readonly trackMealService: TrackMealService) {}

  @Post('text')
  @ApiOperation({ summary: 'Analyze meal metrics directly using text string' })
  async fromText(@Body() dto: TrackMealTextDto) {
    return this.trackMealService.trackFromText(dto);
  }

  @Post('voice')
  @ApiOperation({
    summary:
      'Transcribe and compute meal metrics out from recorded audio files',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('audio', { dest: './uploads' }))
  async fromVoice(@UploadedFile() file: Express.Multer.File) {
    if (!file)
      throw new BadRequestException(
        'Audio clip asset missing from body payload',
      );
    return this.trackMealService.trackFromVoice(file.path);
  }

  @Post('image')
  @ApiOperation({
    summary: 'Run computer vision extraction on captured food image plates',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', { dest: './uploads' }))
  async fromImage(@UploadedFile() file: Express.Multer.File) {
    if (!file)
      throw new BadRequestException(
        'Image visual reference missing from body payload',
      );
    return this.trackMealService.trackFromImage(file.path);
  }
}
