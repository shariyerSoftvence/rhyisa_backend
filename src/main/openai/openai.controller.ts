import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { OpenaiService } from './openai.service';

@ApiTags('OpenAI')
@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenaiService) {}

  @Post('voice-to-text')
  @ApiOperation({
    summary: 'Voice file to text',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('audio', {
      dest: './uploads',
    }),
  )
  async voiceToText(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    return this.openaiService.voiceToText(file.path);
  }

  @Post('image-to-text')
  @ApiOperation({
    summary: 'Image file to text',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      dest: './uploads',
    }),
  )
  async imageToText(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return this.openaiService.imageToText(file.path);
  }
}
