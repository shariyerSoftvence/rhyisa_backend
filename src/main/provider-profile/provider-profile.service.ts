import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateProviderProfileDto,
  UpdateProviderProfileDto,
  SetupAvailabilityDto,
} from './dto/provider-profile.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DayOfWeek,
  MediaType,
  ProviderStatus,
} from '../../../generated/prisma/enums';
import Stripe from 'stripe';
import { UploadFilesService } from '../../common/upload-files/upload-files.service';
import { StripeConnectLinkDto } from './dto/stripe-onboarding.dto';
import { RedisService } from '../../common/redis/redis.service';
import { AuthService } from '../auth/auth.service';
import { calculateProviderProfileCompletion } from '../../common/utils/profile-completion.util';

@Injectable()
export class ProviderProfileService {
  private readonly stripe: InstanceType<typeof Stripe>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFilesService: UploadFilesService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  async createProfile(
    authId: string,
    dto: CreateProviderProfileDto,
    files: {
      profileImage?: Express.Multer.File[];
      driverLicense?: Express.Multer.File[];
      certificate?: Express.Multer.File[];
      governmentIssueId?: Express.Multer.File[];
      marketplaceInsurance?: Express.Multer.File[];
      additionalCertificate?: Express.Multer.File[];
    },
  ) {
    try {
      const existingProfile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });
      if (existingProfile) {
        throw new ConflictException(
          'Provider profile record is already initialized for this user account',
        );
      }

      const authUser = await this.prisma.auth.findUnique({
        where: { id: authId },
      });
      if (!authUser) {
        throw new NotFoundException(
          'Account reference not found for profile establishment',
        );
      }

      if (
        !files.profileImage?.[0] ||
        !files.driverLicense?.[0] ||
        !files.certificate?.[0] ||
        !files.governmentIssueId?.[0] ||
        !files.marketplaceInsurance?.[0] ||
        !files.additionalCertificate?.[0]
      ) {
        throw new BadRequestException(
          'All required validation credential files must be uploaded together',
        );
      }

      const specialization = await this.prisma.specialization.findUnique({
        where: { id: dto.specializationId },
      });
      if (!specialization) {
        throw new NotFoundException(
          'The specified specialization entry mapping structure was not located',
        );
      }

      const uploadedAvatar = await this.uploadFilesService.uploadSingleImage(
        files.profileImage[0],
        'providers/avatars',
      );
      const uploadedLicense = await this.uploadFilesService.uploadSingleImage(
        files.driverLicense[0],
        'providers/licenses',
      );
      const uploadedCertificate =
        await this.uploadFilesService.uploadSingleImage(
          files.certificate[0],
          'providers/certificates',
        );
      const uploadedGovId = await this.uploadFilesService.uploadSingleImage(
        files.governmentIssueId[0],
        'providers/government-ids',
      );
      const uploadedInsurance = await this.uploadFilesService.uploadSingleImage(
        files.marketplaceInsurance[0],
        'providers/insurances',
      );
      const uploadedAddCert = await this.uploadFilesService.uploadSingleImage(
        files.additionalCertificate[0],
        'providers/additional-certificates',
      );

      const imgFile = files.profileImage[0];
      const licenseFile = files.driverLicense[0];
      const certFile = files.certificate[0];
      const govIdFile = files.governmentIssueId[0];
      const insuranceFile = files.marketplaceInsurance[0];
      const addCertFile = files.additionalCertificate[0];

      return await this.prisma.$transaction(async (tx) => {
        const mediaAvatar = await tx.media.create({
          data: {
            url: uploadedAvatar.url,
            key: uploadedAvatar.public_id,
            fileName: imgFile.originalname,
            mimeType: imgFile.mimetype,
            size: imgFile.size,
            type: MediaType.IMAGE,
          },
        });

        const mediaLicense = await tx.media.create({
          data: {
            url: uploadedLicense.url,
            key: uploadedLicense.public_id,
            fileName: licenseFile.originalname,
            mimeType: licenseFile.mimetype,
            size: licenseFile.size,
            type: MediaType.DOCUMENT,
          },
        });

        const mediaCertificate = await tx.media.create({
          data: {
            url: uploadedCertificate.url,
            key: uploadedCertificate.public_id,
            fileName: certFile.originalname,
            mimeType: certFile.mimetype,
            size: certFile.size,
            type: MediaType.DOCUMENT,
          },
        });

        const mediaGovId = await tx.media.create({
          data: {
            url: uploadedGovId.url,
            key: uploadedGovId.public_id,
            fileName: govIdFile.originalname,
            mimeType: govIdFile.mimetype,
            size: govIdFile.size,
            type: MediaType.DOCUMENT,
          },
        });

        const mediaInsurance = await tx.media.create({
          data: {
            url: uploadedInsurance.url,
            key: uploadedInsurance.public_id,
            fileName: insuranceFile.originalname,
            mimeType: insuranceFile.mimetype,
            size: insuranceFile.size,
            type: MediaType.DOCUMENT,
          },
        });

        const mediaAddCert = await tx.media.create({
          data: {
            url: uploadedAddCert.url,
            key: uploadedAddCert.public_id,
            fileName: addCertFile.originalname,
            mimeType: addCertFile.mimetype,
            size: addCertFile.size,
            type: MediaType.DOCUMENT,
          },
        });

        const stripeAccount = await this.stripe.accounts.create({
          type: 'express',
          email: authUser.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
        });

        const defaultAvailabilities = Object.values(DayOfWeek).map((day) => {
          if (day === DayOfWeek.FRIDAY) {
            return { day, fromTime: null, toTime: null, isOff: true };
          }
          return { day, fromTime: '09:00', toTime: '22:00', isOff: false };
        });

        const newProfile = await tx.providerProfile.create({
          data: {
            authId,
            location: dto.location,
            description: dto.description,
            specializationId: dto.specializationId,
            stripeAccountId: stripeAccount.id,
            isPaymentEnabled: false,
            profileImageId: mediaAvatar.id,
            driverLicenseId: mediaLicense.id,
            certificateId: mediaCertificate.id,
            governmentIssueIdUID: mediaGovId.id,
            marketplaceInsuranceId: mediaInsurance.id,
            additionalCertificateId: mediaAddCert.id,
            status: ProviderStatus.PENDING,
            availabilities: {
              create: defaultAvailabilities,
            },
          },
          include: {
            availabilities: true,
            profileImage: true,
            driverLicense: true,
            certificate: true,
            governmentIssueId: true,
            marketplaceInsurance: true,
            additionalCertificate: true,
            specialization: true,
          },
        });

        await this.clearProviderCaches(authId, newProfile.id);

        const profileCompletion = calculateProviderProfileCompletion(newProfile);

        let tokens: any = null;
        if (authUser) {
          tokens = await this.authService.generateTokens(
            authId,
            authUser.email,
            authUser.role,
            profileCompletion.isProfileComplete,
          );

          await tx.refreshToken.create({
            data: {
              token: tokens.refreshToken,
              authId: authUser.id,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        }

        return {
          ...newProfile,
          profileCompletion,
          tokens,
        };
      });
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to generate provider profile with explicit data models mappings: ${error.message}`,
      );
    }
  }

  async updateProfile(
    authId: string,
    dto: UpdateProviderProfileDto,
    files: {
      profileImage?: Express.Multer.File[];
      driverLicense?: Express.Multer.File[];
      certificate?: Express.Multer.File[];
      governmentIssueId?: Express.Multer.File[];
      marketplaceInsurance?: Express.Multer.File[];
      additionalCertificate?: Express.Multer.File[];
    },
  ) {
    try {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });
      if (!profile) {
        throw new NotFoundException(
          'Provider profile matching system credentials parameters missing',
        );
      }

      const updateData: any = {};
      if (dto.location) updateData.location = dto.location;
      if (dto.description) updateData.description = dto.description;
      if (dto.specializationId)
        updateData.specializationId = dto.specializationId;

      return await this.prisma.$transaction(async (tx) => {
        if (files?.profileImage?.[0]) {
          const imgFile = files.profileImage[0];
          const uploadedAvatar =
            await this.uploadFilesService.uploadSingleImage(
              imgFile,
              'providers/avatars',
            );
          const newAvatar = await tx.media.create({
            data: {
              url: uploadedAvatar.url,
              key: uploadedAvatar.public_id,
              fileName: imgFile.originalname,
              mimeType: imgFile.mimetype,
              size: imgFile.size,
              type: MediaType.IMAGE,
            },
          });
          updateData.profileImageId = newAvatar.id;
        }

        if (files?.driverLicense?.[0]) {
          const licenseFile = files.driverLicense[0];
          const uploadedLicense =
            await this.uploadFilesService.uploadSingleImage(
              licenseFile,
              'providers/licenses',
            );
          const newLicense = await tx.media.create({
            data: {
              url: uploadedLicense.url,
              key: uploadedLicense.public_id,
              fileName: licenseFile.originalname,
              mimeType: licenseFile.mimetype,
              size: licenseFile.size,
              type: MediaType.DOCUMENT,
            },
          });
          updateData.driverLicenseId = newLicense.id;
        }

        if (files?.certificate?.[0]) {
          const certFile = files.certificate[0];
          const uploadedCertificate =
            await this.uploadFilesService.uploadSingleImage(
              certFile,
              'providers/certificates',
            );
          const newCertificate = await tx.media.create({
            data: {
              url: uploadedCertificate.url,
              key: uploadedCertificate.public_id,
              fileName: certFile.originalname,
              mimeType: certFile.mimetype,
              size: certFile.size,
              type: MediaType.DOCUMENT,
            },
          });
          updateData.certificateId = newCertificate.id;
        }

        if (files?.governmentIssueId?.[0]) {
          const govIdFile = files.governmentIssueId[0];
          const uploadedGovId = await this.uploadFilesService.uploadSingleImage(
            govIdFile,
            'providers/government-ids',
          );
          const newGovId = await tx.media.create({
            data: {
              url: uploadedGovId.url,
              key: uploadedGovId.public_id,
              fileName: govIdFile.originalname,
              mimeType: govIdFile.mimetype,
              size: govIdFile.size,
              type: MediaType.DOCUMENT,
            },
          });
          updateData.governmentIssueIdUID = newGovId.id;
        }

        if (files?.marketplaceInsurance?.[0]) {
          const insuranceFile = files.marketplaceInsurance[0];
          const uploadedInsurance =
            await this.uploadFilesService.uploadSingleImage(
              insuranceFile,
              'providers/insurances',
            );
          const newInsurance = await tx.media.create({
            data: {
              url: uploadedInsurance.url,
              key: uploadedInsurance.public_id,
              fileName: insuranceFile.originalname,
              mimeType: insuranceFile.mimetype,
              size: insuranceFile.size,
              type: MediaType.DOCUMENT,
            },
          });
          updateData.marketplaceInsuranceId = newInsurance.id;
        }

        if (files?.additionalCertificate?.[0]) {
          const addCertFile = files.additionalCertificate[0];
          const uploadedAddCert =
            await this.uploadFilesService.uploadSingleImage(
              addCertFile,
              'providers/additional-certificates',
            );
          const newAddCert = await tx.media.create({
            data: {
              url: uploadedAddCert.url,
              key: uploadedAddCert.public_id,
              fileName: addCertFile.originalname,
              mimeType: addCertFile.mimetype,
              size: addCertFile.size,
              type: MediaType.DOCUMENT,
            },
          });
          updateData.additionalCertificateId = newAddCert.id;
        }

        const updatedProfile = await tx.providerProfile.update({
          where: { authId },
          data: updateData,
          include: {
            profileImage: true,
            driverLicense: true,
            certificate: true,
            governmentIssueId: true,
            marketplaceInsurance: true,
            additionalCertificate: true,
            specialization: true,
          },
        });

        await this.clearProviderCaches(authId, updatedProfile.id);
        return updatedProfile;
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to modify active profile registries properties logs: ${error.message}`,
      );
    }
  }

  async setupAvailability(authId: string, dto: SetupAvailabilityDto) {
    try {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });
      if (!profile) {
        throw new NotFoundException(
          'Provider configuration database matching link data values records missing',
        );
      }

      await this.prisma.$transaction(
        dto.availabilities.map((avail) =>
          this.prisma.providerAvailability.upsert({
            where: {
              providerProfileId_day: {
                providerProfileId: profile.id,
                day: avail.day,
              },
            },
            update: {
              fromTime: avail.isOff ? null : avail.fromTime,
              toTime: avail.isOff ? null : avail.toTime,
              isOff: avail.isOff,
            },
            create: {
              providerProfileId: profile.id,
              day: avail.day,
              fromTime: avail.isOff ? null : avail.fromTime,
              toTime: avail.isOff ? null : avail.toTime,
              isOff: avail.isOff,
            },
          }),
        ),
      );

      await this.clearProviderCaches(authId, profile.id);

      return {
        message:
          'Provider working schedule operational metrics availability profile matrices updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to process matrix settings options overwrite updates layout matching active timetable',
      );
    }
  }

  private async clearProviderCaches(authId: string, providerId?: string) {
    await this.redis.del(`auth:me:${authId}`);
    await this.redis.del(`provider:id:${authId}`);
    await this.redis.del('directory:providers:all');
    await this.redis.del(`providers:list:page_1_limit_10`);
    if (providerId) {
      await this.redis.del(`directory:provider:${providerId}`);
      await this.redis.del(`directory:provider:${providerId}:services`);
      const client = this.redis.getClient();
      const keys = await client.keys(
        `directory:provider:${providerId}:availability:*`,
      );
      if (keys.length > 0) {
        await client.del(...keys);
      }
    }
  }

  async createAccountOnboardingLink(authId: string, dto: StripeConnectLinkDto) {
    try {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });

      if (!profile) {
        throw new NotFoundException('Provider profile not initialized yet');
      }

      if (!profile.stripeAccountId) {
        throw new BadRequestException(
          'Stripe Account reference is missing on this profile setup',
        );
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: profile.stripeAccountId,
        refresh_url: dto.refreshUrl,
        return_url: dto.returnUrl,
        type: 'account_onboarding',
      });

      return { url: accountLink.url };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to generate Stripe onboarding matrix verification link: ${error.message}`,
      );
    }
  }
}
