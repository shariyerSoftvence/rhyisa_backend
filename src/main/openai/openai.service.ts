import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import OpenAI from 'openai';

import * as fs from 'fs';

@Injectable()
export class OpenaiService {
  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  async voiceToText(filePath: string) {
    try {
      const response =
        await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'whisper-1',
        });

      return {
        success: true,
        text: response.text,
      };
    } catch (error: any) {
      console.log(error);

      if (error?.status === 429) {
        throw new BadRequestException(
          'OpenAI quota exceeded. Please add billing.',
        );
      }

      throw new InternalServerErrorException(
        'Failed to convert voice to text',
      );
    } finally {
      this.deleteFile(filePath);
    }
  }

  async imageToText(filePath: string) {
    try {
      const base64Image = fs
        .readFileSync(filePath)
        .toString('base64');

      const response =
        await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this image',
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
        text:
          response.choices[0].message.content,
      };
    } catch (error: any) {
      console.log(error);

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
}