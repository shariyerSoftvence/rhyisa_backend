import { Injectable, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateProviderProfileDto, UpdateProviderProfileDto, SetupAvailabilityDto } from './dto/provider-profile.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek, MediaType, ProviderStatus } from '../../../generated/prisma/enums';
import Stripe from 'stripe';
import { UploadFilesService } from '../../common/upload-files/upload-files.service';
import { StripeConnectLinkDto } from './dto/stripe-onboarding.dto';

@Injectable()
export class ProviderProfileService {
  private readonly stripe: InstanceType<typeof Stripe>;

 constructor(
    private readonly prisma: PrismaService,
    private readonly uploadFilesService: UploadFilesService, 
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
        }
    ) {
        try {
        const existingProfile = await this.prisma.providerProfile.findUnique({
            where: { authId },
        });
        if (existingProfile) {
            throw new ConflictException('Provider profile record is already initialized for this user account');
        }

        const authUser = await this.prisma.auth.findUnique({
            where: { id: authId },
        });
        if (!authUser) {
            throw new NotFoundException('Account reference not found for profile establishment');
        }

        if (!files.profileImage?.[0] || !files.driverLicense?.[0] || !files.certificate?.[0]) {
            throw new BadRequestException('All required validation credential files must be uploaded together');
        }

        const specialization = await this.prisma.specialization.findUnique({
            where: { id: dto.specializationId },
        });
        if (!specialization) {
            throw new NotFoundException('The specified specialization entry mapping structure was not located');
        }

        // Step 1: Upload and get paths using custom service
        const uploadedAvatar = await this.uploadFilesService.uploadSingleImage(files.profileImage[0], 'providers/avatars');
        const uploadedLicense = await this.uploadFilesService.uploadSingleImage(files.driverLicense[0], 'providers/licenses');
        const uploadedCertificate = await this.uploadFilesService.uploadSingleImage(files.certificate[0], 'providers/certificates');

        const imgFile = files.profileImage[0];
        const licenseFile = files.driverLicense[0];
        const certFile = files.certificate[0];

        // Step 2: Use an atomic transaction to write Media records first and link them via ID parameters
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

            // Step 3: Setup Stripe Express Connect account
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

            // Step 4: Create final profile structure with resolved safely typed input keys
            return await tx.providerProfile.create({
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
                specialization: true,
            },
            });
        });

        } catch (error: any) {
        if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof BadRequestException) throw error;
        throw new InternalServerErrorException(`Failed to generate provider profile with explicit data models mappings: ${error.message}`);
        }
    }


  async updateProfile(
    authId: string, 
    dto: UpdateProviderProfileDto,
    files: {
      profileImage?: Express.Multer.File[];
      driverLicense?: Express.Multer.File[];
      certificate?: Express.Multer.File[];
    }
  ) {
    try {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });
      if (!profile) {
        throw new NotFoundException('Provider profile matching system credentials parameters missing');
      }

      // Initialize an explicit update object structure to decouple file binary streams from raw text
      const updateData: any = {};
      if (dto.location) updateData.location = dto.location;
      if (dto.description) updateData.description = dto.description;
      if (dto.specializationId) updateData.specializationId = dto.specializationId;

      return await this.prisma.$transaction(async (tx) => {
        // Handle optional media attachment files dynamically during updates sequence
        if (files?.profileImage?.[0]) {
          const imgFile = files.profileImage[0];
          const uploadedAvatar = await this.uploadFilesService.uploadSingleImage(imgFile, 'providers/avatars');
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
          const uploadedLicense = await this.uploadFilesService.uploadSingleImage(licenseFile, 'providers/licenses');
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
          const uploadedCertificate = await this.uploadFilesService.uploadSingleImage(certFile, 'providers/certificates');
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

        return await tx.providerProfile.update({
          where: { authId },
          data: updateData,
          include: {
            profileImage: true,
            driverLicense: true,
            certificate: true,
            specialization: true,
          },
        });
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Failed to modify active profile registries properties logs: ${error.message}`);
    }
  }

  async setupAvailability(authId: string, dto: SetupAvailabilityDto) {
    try {
      const profile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });
      if (!profile) {
        throw new NotFoundException('Provider configuration database matching link data values records missing');
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

      return { message: 'Provider working schedule operational metrics availability profile matrices updated successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to process matrix settings options overwrite updates layout matching active timetable');
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
        throw new BadRequestException('Stripe Account reference is missing on this profile setup');
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: profile.stripeAccountId,
        refresh_url: dto.refreshUrl,
        return_url: dto.returnUrl,
        type: 'account_onboarding',
      });

      return { url: accountLink.url };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to generate Stripe onboarding matrix verification link: ${error.message}`);
    }
  }
}