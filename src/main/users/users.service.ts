import { Injectable, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserProfileDto } from './dto/create-profile.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '../../../generated/prisma/enums';


@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(authId: string, dto: CreateUserProfileDto) {
    try {
      const existingProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (existingProfile) {
        throw new ConflictException('Profile setup parameters already initialized for this user account');
      }

      return await this.prisma.userProfile.create({
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
          bodyPhotoId: dto.bodyPhotoId,
        },
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to build user demographic profile mapping logs');
    }
  }

  async getProfileByAuthId(authId: string) {
    try {
      const profile = await this.prisma.userProfile.findUnique({
        where: { authId },
        include: { auth: true, bodyPhoto: true },
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

  async updateProfile(authId: string, dto: UpdateUserProfileDto) {
    try {
      const profile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!profile) {
        throw new NotFoundException('Profile execution matching parameters target registry element missing');
      }

      return await this.prisma.userProfile.update({
        where: { authId },
        data: dto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to process properties data modification updates on profile logs');
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