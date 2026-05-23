import { Injectable, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateUserProfileDto } from './dto/create-profile.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaType, UserStatus } from '../../../generated/prisma/enums';
import { UploadFilesService } from '../../common/upload-files/upload-files.service';


@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService, private readonly uploadFilesService: UploadFilesService) {}

async createProfile(authId: string, dto: CreateUserProfileDto, file: Express.Multer.File) {
    try {
      const existingProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (existingProfile) {
        throw new ConflictException('Profile setup parameters already initialized for this user account');
      }

      if (!file) {
        throw new BadRequestException('A primary avatar profile image binary upload is required during account configuration');
      }

      const uploadedImage = await this.uploadFilesService.uploadSingleImage(file, 'users/avatars');

      return await this.prisma.$transaction(async (tx) => {
        const mediaRecord = await tx.media.create({
          data: {
            url: uploadedImage.url,
            key: uploadedImage.public_id,
            fileName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            type: MediaType.IMAGE,
          },
        });

        return await tx.userProfile.create({
          data: {
            authId,
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            address: dto.address,
            age: dto.age,
            height: dto.height,
            weight: dto.weight,
            bodyType: dto.bodyType,
            averageFatLevel: dto.averageFatLevel,
            healthConditions: dto.healthConditions || [],
            shortTermGoal: dto.shortTermGoal,
            longTermGoal: dto.longTermGoal,
            mealDescription: dto.mealDescription,
            profileImageId: mediaRecord.id,
          },
          include: {
            profileImage: true,
          },
        });
      });
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to build user demographic profile mapping logs: ${error.message}`);
    }
  }

  async getProfileByAuthId(authId: string) {
    try {
      const profile = await this.prisma.userProfile.findUnique({
        where: { authId },
        include: { auth: true, profileImage: true },
      });
      if (!profile) {
        throw new NotFoundException(`User profile linked to credential account context ${authId} was not found`);
      }
      return profile;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to pull target health profile metrics structural record');
    }
  }

  async updateProfile(authId: string, dto: UpdateUserProfileDto, file?: Express.Multer.File) {
    try {
      const profile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!profile) {
        throw new NotFoundException('Profile execution matching parameters target registry element missing');
      }

      const updateData: any = {};
      if (dto.fullName) updateData.fullName = dto.fullName;
      if (dto.phoneNumber) updateData.phoneNumber = dto.phoneNumber;
      if (dto.address) updateData.address = dto.address;
      if (dto.age !== undefined) updateData.age = dto.age;
      if (dto.height !== undefined) updateData.height = dto.height;
      if (dto.weight !== undefined) updateData.weight = dto.weight;
      if (dto.bodyType) updateData.bodyType = dto.bodyType;
      if (dto.averageFatLevel) updateData.averageFatLevel = dto.averageFatLevel;
      if (dto.healthConditions) updateData.healthConditions = dto.healthConditions;
      if (dto.shortTermGoal) updateData.shortTermGoal = dto.shortTermGoal;
      if (dto.longTermGoal) updateData.longTermGoal = dto.longTermGoal;
      if (dto.mealDescription) updateData.mealDescription = dto.mealDescription;

      return await this.prisma.$transaction(async (tx) => {
        if (file) {
          const uploadedImage = await this.uploadFilesService.uploadSingleImage(file, 'users/avatars');
          const mediaRecord = await tx.media.create({
            data: {
              url: uploadedImage.url,
              key: uploadedImage.public_id,
              fileName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              type: MediaType.IMAGE,
            },
          });
          updateData.profileImageId = mediaRecord.id;
        }

        return await tx.userProfile.update({
          where: { authId },
          data: updateData,
          include: {
            profileImage: true,
          },
        });
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Failed to process properties data modification updates on profile logs: ${error.message}`);
    }
  }

  async selfDeleteAccount(authId: string) {
    try {
      const userAccount = await this.prisma.auth.findUnique({
        where: { id: authId },
      });
      if (!userAccount) {
        throw new NotFoundException('Target account record missing structural database key alignment indices');
      }

      await this.prisma.auth.update({
        where: { id: authId },
        data: { status: UserStatus.DELETED },
      });

      return { message: 'Your account status profile has been successfully moved to DELETED state configuration metrics' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to process account closure operational routine tasks');
    }
  }
}