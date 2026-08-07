import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadFilesService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads');
  private readonly baseUrl = process.env.BACKEND_URL!;
  constructor() {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async uploadImages(files: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map((file) => {
      return new Promise<string>((resolve, reject) => {
        try {
          const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
          const filePath = path.join(this.uploadPath, fileName);

          fs.writeFileSync(filePath, file.buffer);

          // Full URL path return kora hocche jate frontend theke direct access kora jay
          const fileUrl = `${this.baseUrl}/uploads/${fileName}`;
          resolve(fileUrl);
        } catch (error) {
          reject(new InternalServerErrorException('Local Upload Failed'));
        }
      });
    });

    return Promise.all(uploadPromises);
  }
  async uploadSingleImage(
    file: Express.Multer.File,
    folder: string = 'profiles',
  ) {
    try {
      const specificFolder = path.join(this.uploadPath, folder);
      if (!fs.existsSync(specificFolder)) {
        fs.mkdirSync(specificFolder, { recursive: true });
      }

      const publicId = uuidv4();
      const fileName = `${publicId}${path.extname(file.originalname)}`;
      const filePath = path.join(specificFolder, fileName);

      fs.writeFileSync(filePath, file.buffer);

      return {
        url: `${this.baseUrl}/uploads/${folder}/${fileName}`,
        public_id: publicId,
      };
    } catch (error) {
      throw new InternalServerErrorException('Local Upload Failed');
    }
  }
}
