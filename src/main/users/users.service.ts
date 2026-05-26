import { Injectable, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateUserProfileDto } from './dto/create-profile.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaType, UserStatus } from '../../../generated/prisma/enums';
import { UploadFilesService } from '../../common/upload-files/upload-files.service';
import { OpenaiService } from '../openai/openai.service';


@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService, private readonly uploadFilesService: UploadFilesService,  private readonly openaiService: OpenaiService) {}

async createProfile(
  authId: string,
  dto: CreateUserProfileDto,
  file: Express.Multer.File,
) {
  try {

    const existingProfile =
      await this.prisma.userProfile.findUnique({
        where: { authId },
      });

    if (existingProfile) {
      throw new ConflictException(
        'Profile already exists',
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Profile image is required',
      );
    }

    const uploadedImage =
      await this.uploadFilesService.uploadSingleImage(
        file,
        'users/avatars',
      );


    let aiGoals: any;

    try {
      aiGoals =
        await this.openaiService.generateDailyHealthGoals(
          {
            age: dto.age,
            gender: dto.gender,
            height: dto.height,
            weight: dto.weight,
            currentActivityLevel:
              dto.currentActivityLevel,
            currentDiet:
              dto.currentDiet,
            primaryGoal:
              dto.primaryGoal,
            motivationLevel:
              dto.motivationLevel,
            supplements:
              dto.supplements,
          },
        );
    } catch (error) {

      aiGoals = {
        calorieGoal: 2200,
        proteinGoal: 120,
        carbsGoal: 250,
        fatGoal: 70,
        waterGoal: 8,
        stepsGoal: 7000,
        sleepGoalHours: 8,
      };
    }

    return await this.prisma.$transaction(
      async (tx) => {

        const mediaRecord =
          await tx.media.create({
            data: {
              url: uploadedImage.url,
              key: uploadedImage.public_id,
              fileName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              type: MediaType.IMAGE,
            },
          });

        const createdProfile =
          await tx.userProfile.create({
            data: {
              authId,

              fullName: dto.fullName || "",

              phoneNumber:
                dto.phoneNumber,

              address: dto.address,

              age: dto.age,

              gender: dto.gender,

              height: dto.height,

              weight: dto.weight,

              currentActivityLevel:
                dto.currentActivityLevel,

              currentDiet:
                dto.currentDiet,

              primaryGoal:
                dto.primaryGoal || [],

              motivationLevel:
                dto.motivationLevel,

              hasHealthCondition:
                dto.hasHealthCondition,

              supplements:
                dto.supplements || [],

              profileImageId:
                mediaRecord.id,
            },

            include: {
              profileImage: true,
            },
          });

        const createdGoal =
          await tx.userHealthGoal.create({
            data: {
              userProfileId:
                createdProfile.id,

              calorieGoal:
                aiGoals.calorieGoal,

              proteinGoal:
                aiGoals.proteinGoal,

              carbsGoal:
                aiGoals.carbsGoal,

              fatGoal:
                aiGoals.fatGoal,

              waterGoal:
                aiGoals.waterGoal,

              stepsGoal:
                aiGoals.stepsGoal,

              sleepGoalHours:
                aiGoals.sleepGoalHours,

              generatedByAI: true,
            },
          });

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const todayLog =
          await tx.userDailyHealthLog.create({
            data: {
              userProfileId:
                createdProfile.id,

              date: today,

              calories: 0,

              waterGlasses: 0,

              proteinGrams: 0,

              carbsGrams: 0,

              fatGrams: 0,

              steps: 0,

              sleepHours: 0,

              sleepMinutes: 0,

              energyLevel: 1,

              healthScore: 0,
            },
          });

        return {
          success: true,

          message:
            'User profile created successfully',

          profile: createdProfile,

          healthGoal: createdGoal,

          todayHealthLog: todayLog,
        };
      },
    );
  } catch (error: any) {
    console.error(error);

    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    throw new InternalServerErrorException(
      `Failed to create profile: ${error.message}`,
    );
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

async updateProfile(
  authId: string,
  dto: UpdateUserProfileDto,
  file?: Express.Multer.File,
) {
  try {
    /**
     * Find Profile
     */
    const profile =
      await this.prisma.userProfile.findUnique({
        where: { authId },

        include: {
          healthGoal: true,
        },
      });

    if (!profile) {
      throw new NotFoundException(
        'User profile not found',
      );
    }

    /**
     * Dynamic Update Payload
     */
    const updateData: any = {};

    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName;
    }

    if (dto.phoneNumber !== undefined) {
      updateData.phoneNumber =
        dto.phoneNumber;
    }

    if (dto.address !== undefined) {
      updateData.address = dto.address;
    }

    if (dto.age !== undefined) {
      updateData.age = dto.age;
    }

    if (dto.gender !== undefined) {
      updateData.gender = dto.gender;
    }

    if (dto.height !== undefined) {
      updateData.height = dto.height;
    }

    if (dto.weight !== undefined) {
      updateData.weight = dto.weight;
    }

    if (
      dto.currentActivityLevel !== undefined
    ) {
      updateData.currentActivityLevel =
        dto.currentActivityLevel;
    }

    if (dto.currentDiet !== undefined) {
      updateData.currentDiet =
        dto.currentDiet;
    }

    if (dto.primaryGoal !== undefined) {
      updateData.primaryGoal =
        dto.primaryGoal;
    }

    if (
      dto.motivationLevel !== undefined
    ) {
      updateData.motivationLevel =
        dto.motivationLevel;
    }

    if (
      dto.hasHealthCondition !== undefined
    ) {
      updateData.hasHealthCondition =
        dto.hasHealthCondition;
    }

    if (dto.supplements !== undefined) {
      updateData.supplements =
        dto.supplements;
    }

    return await this.prisma.$transaction(
      async (tx) => {
        /**
         * Upload New Profile Image
         */
        if (file) {
          const uploadedImage =
            await this.uploadFilesService.uploadSingleImage(
              file,
              'users/avatars',
            );

          const mediaRecord =
            await tx.media.create({
              data: {
                url: uploadedImage.url,
                key: uploadedImage.public_id,
                fileName:
                  file.originalname,
                mimeType:
                  file.mimetype,
                size: file.size,
                type: MediaType.IMAGE,
              },
            });

          updateData.profileImageId =
            mediaRecord.id;
        }


        const updatedProfile =
          await tx.userProfile.update({
            where: { authId },

            data: updateData,

            include: {
              profileImage: true,
              healthGoal: true,
            },
          });

        const shouldRegenerateGoals =
          dto.weight !== undefined ||
          dto.height !== undefined ||
          dto.age !== undefined ||
          dto.currentActivityLevel !==
            undefined ||
          dto.currentDiet !== undefined ||
          dto.primaryGoal !== undefined;

        let updatedGoals: any = null;

        if (shouldRegenerateGoals) {
          let aiGoals: any;

          try {
            aiGoals =
              await this.openaiService.generateDailyHealthGoals(
                {
                  age:
                    updatedProfile.age!,
                  gender:
                    updatedProfile.gender!,
                  height:
                    updatedProfile.height!,
                  weight:
                    updatedProfile.weight!,
                  currentActivityLevel:
                    updatedProfile.currentActivityLevel!,
                  currentDiet:
                    updatedProfile.currentDiet!,
                  primaryGoal:
                    updatedProfile.primaryGoal,
                  motivationLevel:
                    updatedProfile.motivationLevel!,
                  supplements:
                    updatedProfile.supplements,
                },
              );
          } catch (error) {
            aiGoals = {
              calorieGoal: 2200,
              proteinGoal: 120,
              carbsGoal: 250,
              fatGoal: 70,
              waterGoal: 8,
              stepsGoal: 7000,
              sleepGoalHours: 8,
            };
          }

          updatedGoals =
            await tx.userHealthGoal.update({
              where: {
                userProfileId:
                  updatedProfile.id,
              },

              data: {
                calorieGoal:
                  aiGoals.calorieGoal,

                proteinGoal:
                  aiGoals.proteinGoal,

                carbsGoal:
                  aiGoals.carbsGoal,

                fatGoal:
                  aiGoals.fatGoal,

                waterGoal:
                  aiGoals.waterGoal,

                stepsGoal:
                  aiGoals.stepsGoal,

                sleepGoalHours:
                  aiGoals.sleepGoalHours,

                generatedByAI: true,
              },
            });
        }

        return {
          success: true,

          message:
            'Profile updated successfully',

          profile: updatedProfile,

          healthGoal:
            updatedGoals ||
            updatedProfile.healthGoal,
        };
      },
    );
  } catch (error: any) {
    console.error(error);

    if (
      error instanceof NotFoundException
    ) {
      throw error;
    }

    throw new InternalServerErrorException(
      `Failed to update profile: ${error.message}`,
    );
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