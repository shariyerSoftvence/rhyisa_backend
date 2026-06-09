import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TrackMealService } from './track-meal.service';
import { TrackMealTextDto } from './dto/track-meal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RoleType } from '../../../generated/prisma/enums';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Track Meal Analytics Engine')
@Controller('track-meal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.USER)
@ApiBearerAuth()
export class TrackMealController {
  constructor(private readonly trackMealService: TrackMealService) {}

  @Post('text')
  @ApiOperation({ summary: 'Analyze meal metrics directly using text string' })
  async fromText(@Req() req: any, @Body() dto: TrackMealTextDto) {
    return this.trackMealService.trackFromText(req.user.id, dto);
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
  async fromVoice(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Audio clip asset missing from body payload',
      );
    }
    return this.trackMealService.trackFromVoice(req.user.id, file.path);
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
  async fromImage(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Image visual reference missing from body payload',
      );
    }
    return this.trackMealService.trackFromImage(req.user.id, file.path);
  }

  @Post('confirm')
  @ApiOperation({
    summary:
      'Commit temporary tracked metadata values securely to the daily health logs tracking records registry',
  })
  async confirmMeal(@Req() req: any) {
    return this.trackMealService.confirmAndLogMeal(req.user.id);
  }
}
