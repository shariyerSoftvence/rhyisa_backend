import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ProviderStatus, UserStatus } from '../../../../generated/prisma/enums';
import { ProviderProfileWhereInput } from '../../../../generated/prisma/models';
import {
  ProviderFilterStatus,
  QueryProviderDto,
} from './dto/query-provider.dto';
import { ActionProviderDto } from './dto/action-provider.dto';
import { RequestMoreInfoDto } from './dto/request-more-info.dto';

export interface SubmittedDocument {
  id: string;
  type: string;
  name: string;
  url: string | null;
  uploadedAt: Date | null;
}

export interface FormattedProviderItem {
  id: string;
  authId: string;
  provider: {
    fullName: string;
    specialization: string;
    profileImage: string | null;
  };
  email: string;
  phone: string | null;
  status: ProviderStatus;
  statusLabel: string;
  appliedOn: string;
  createdAt: Date;
  reviewNotes: string | null;
}

export interface ProviderListResponse {
  message: string;
  data: {
    stats: {
      totalProviders: number;
      pendingReview: number;
      approved: number;
      denied: number;
      suspended: number;
    };
    pagination: {
      totalItems: number;
      currentPage: number;
      limit: number;
      totalPages: number;
    };
    providers: FormattedProviderItem[];
  };
}

export interface SingleProviderDetailResponse {
  message: string;
  data: {
    id: string;
    authId: string;
    fullName: string;
    email: string;
    phone: string | null;
    specialization: string;
    status: ProviderStatus;
    statusLabel: string;
    profileImage: string | null;
    location: string;
    description: string;
    appliedOn: string;
    createdAt: Date;
    updatedAt: Date;
    reviewNotes: string | null;
    isPaymentEnabled: boolean;
    stripeAccountId: string | null;
    submittedDocuments: SubmittedDocument[];
  };
}

@Injectable()
export class AdminProviderManagementService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly PROVIDERS_LIST_PREFIX = 'admin:providers:list:';
  private readonly PROVIDER_DETAIL_PREFIX = 'admin:provider:detail:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async invalidateCaches(providerId?: string, authId?: string) {
    try {
      if (providerId) {
        await this.redis.del(`${this.PROVIDER_DETAIL_PREFIX}${providerId}`);
      }
      if (authId) {
        await this.redis.del(`${this.PROVIDER_DETAIL_PREFIX}${authId}`);
      }
      const client = this.redis.getClient();
      const listKeys = await client.keys(`${this.PROVIDERS_LIST_PREFIX}*`);
      if (listKeys.length > 0) {
        await client.del(...listKeys);
      }
    } catch {
      // Silently ignore cache invalidation errors
    }
  }

  private formatStatusLabel(status: ProviderStatus): string {
    switch (status) {
      case ProviderStatus.PENDING:
        return 'Pending Review';
      case ProviderStatus.ACCEPTED:
        return 'Approved';
      case ProviderStatus.REJECTED:
        return 'Denied';
      case ProviderStatus.SUSPENDED:
        return 'Suspended';
      default:
        return status;
    }
  }

  private formatDateString(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async getProviderStats() {
    try {
      const [totalProviders, pendingReview, approved, denied, suspended] =
        await Promise.all([
          this.prisma.providerProfile.count(),
          this.prisma.providerProfile.count({
            where: { status: ProviderStatus.PENDING },
          }),
          this.prisma.providerProfile.count({
            where: { status: ProviderStatus.ACCEPTED },
          }),
          this.prisma.providerProfile.count({
            where: { status: ProviderStatus.REJECTED },
          }),
          this.prisma.providerProfile.count({
            where: { status: ProviderStatus.SUSPENDED },
          }),
        ]);

      return {
        totalProviders,
        pendingReview,
        approved,
        denied,
        suspended,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to retrieve provider stats: ${errMessage}`,
      );
    }
  }

  async getAllProviders(
    query: QueryProviderDto,
  ): Promise<ProviderListResponse> {
    try {
      const cacheKey = `${this.PROVIDERS_LIST_PREFIX}${JSON.stringify(query)}`;
      const cached = await this.redis.get<ProviderListResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const {
        search,
        status,
        specializationId,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 10,
      } = query;

      const pageNum = Number(page) > 0 ? Number(page) : 1;
      const limitNum = Number(limit) > 0 ? Number(limit) : 10;
      const skip = (pageNum - 1) * limitNum;

      const where: ProviderProfileWhereInput = {};

      if (status && status !== ProviderFilterStatus.ALL) {
        where.status = status;
      }

      if (specializationId) {
        where.specializationId = specializationId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      if (search && search.trim() !== '') {
        const cleanSearch = search.trim();
        where.OR = [
          { location: { contains: cleanSearch, mode: 'insensitive' } },
          { description: { contains: cleanSearch, mode: 'insensitive' } },
          { phoneNumber: { contains: cleanSearch, mode: 'insensitive' } },
          {
            auth: {
              fullName: { contains: cleanSearch, mode: 'insensitive' },
            },
          },
          {
            auth: {
              email: { contains: cleanSearch, mode: 'insensitive' },
            },
          },
          {
            specialization: {
              name: { contains: cleanSearch, mode: 'insensitive' },
            },
          },
        ];
      }

      const [stats, totalItems, providers] = await Promise.all([
        this.getProviderStats(),
        this.prisma.providerProfile.count({ where }),
        this.prisma.providerProfile.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limitNum,
          include: {
            auth: {
              select: {
                id: true,
                fullName: true,
                email: true,
                status: true,
                createdAt: true,
              },
            },
            specialization: {
              select: {
                id: true,
                name: true,
              },
            },
            profileImage: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalItems / limitNum) || 1;

      const formattedProviders: FormattedProviderItem[] = providers.map(
        (p) => ({
          id: p.id,
          authId: p.auth.id,
          provider: {
            fullName: p.auth.fullName,
            specialization: p.specialization?.name || 'General Provider',
            profileImage: p.profileImage?.url || null,
          },
          email: p.auth.email,
          phone: p.phoneNumber || null,
          status: p.status,
          statusLabel: this.formatStatusLabel(p.status),
          appliedOn: this.formatDateString(p.createdAt),
          createdAt: p.createdAt,
          reviewNotes: p.reviewNotes,
        }),
      );

      const result: ProviderListResponse = {
        message: 'Providers list retrieved successfully',
        data: {
          stats,
          pagination: {
            totalItems,
            currentPage: pageNum,
            limit: limitNum,
            totalPages,
          },
          providers: formattedProviders,
        },
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to retrieve providers: ${errMessage}`,
      );
    }
  }

  async getSingleProvider(
    identifier: string,
  ): Promise<SingleProviderDetailResponse> {
    try {
      const cacheKey = `${this.PROVIDER_DETAIL_PREFIX}${identifier}`;
      const cached =
        await this.redis.get<SingleProviderDetailResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const provider = await this.prisma.providerProfile.findFirst({
        where: {
          OR: [{ id: identifier }, { authId: identifier }],
        },
        include: {
          auth: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              status: true,
              createdAt: true,
            },
          },
          specialization: {
            select: {
              id: true,
              name: true,
            },
          },
          profileImage: true,
          driverLicense: true,
          certificate: true,
          governmentIssueId: true,
          marketplaceInsurance: true,
          additionalCertificate: true,
        },
      });

      if (!provider) {
        throw new NotFoundException(
          `Provider record with ID or AuthID "${identifier}" not found`,
        );
      }

      const submittedDocuments: SubmittedDocument[] = [];

      if (provider.driverLicense) {
        submittedDocuments.push({
          id: provider.driverLicense.id,
          type: 'DRIVING_LICENSE',
          name: 'Driving License',
          url: provider.driverLicense.url,
          uploadedAt: provider.driverLicense.createdAt,
        });
      }

      if (provider.certificate) {
        submittedDocuments.push({
          id: provider.certificate.id,
          type: 'MEDICAL_CERTIFICATE',
          name: 'Medical Certificate / Professional License',
          url: provider.certificate.url,
          uploadedAt: provider.certificate.createdAt,
        });
      }

      if (provider.governmentIssueId) {
        submittedDocuments.push({
          id: provider.governmentIssueId.id,
          type: 'GOVERNMENT_ID',
          name: 'Government Issued ID',
          url: provider.governmentIssueId.url,
          uploadedAt: provider.governmentIssueId.createdAt,
        });
      }

      if (provider.marketplaceInsurance) {
        submittedDocuments.push({
          id: provider.marketplaceInsurance.id,
          type: 'MARKETPLACE_INSURANCE',
          name: 'Marketplace Insurance',
          url: provider.marketplaceInsurance.url,
          uploadedAt: provider.marketplaceInsurance.createdAt,
        });
      }

      if (provider.additionalCertificate) {
        submittedDocuments.push({
          id: provider.additionalCertificate.id,
          type: 'ADDITIONAL_CERTIFICATE',
          name: 'Professional License / Additional Certificate',
          url: provider.additionalCertificate.url,
          uploadedAt: provider.additionalCertificate.createdAt,
        });
      }

      const result: SingleProviderDetailResponse = {
        message: 'Provider details retrieved successfully',
        data: {
          id: provider.id,
          authId: provider.auth.id,
          fullName: provider.auth.fullName,
          email: provider.auth.email,
          phone: provider.phoneNumber || null,
          specialization: provider.specialization?.name || 'General Medicine',
          status: provider.status,
          statusLabel: this.formatStatusLabel(provider.status),
          profileImage: provider.profileImage?.url || null,
          location: provider.location || 'N/A',
          description: provider.description || '',
          appliedOn: this.formatDateString(provider.createdAt),
          createdAt: provider.createdAt,
          updatedAt: provider.updatedAt,
          reviewNotes: provider.reviewNotes,
          isPaymentEnabled: provider.isPaymentEnabled,
          stripeAccountId: provider.stripeAccountId,
          submittedDocuments,
        },
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to fetch provider details: ${errMessage}`,
      );
    }
  }

  async actionProvider(identifier: string, dto: ActionProviderDto) {
    try {
      const provider = await this.prisma.providerProfile.findFirst({
        where: {
          OR: [{ id: identifier }, { authId: identifier }],
        },
      });

      if (!provider) {
        throw new NotFoundException(
          `Provider record for ID "${identifier}" not found`,
        );
      }

      // Determine corresponding Auth UserStatus
      let authStatus: UserStatus = UserStatus.ACTIVE;
      if (dto.status === ProviderStatus.ACCEPTED) {
        authStatus = UserStatus.ACTIVE;
      } else if (dto.status === ProviderStatus.REJECTED) {
        authStatus = UserStatus.INACTIVE;
      } else if (dto.status === ProviderStatus.SUSPENDED) {
        authStatus = UserStatus.BLOCKED;
      } else if (dto.status === ProviderStatus.PENDING) {
        authStatus = UserStatus.INACTIVE;
      }

      const [updatedProfile] = await Promise.all([
        this.prisma.providerProfile.update({
          where: { id: provider.id },
          data: {
            status: dto.status,
            ...(dto.reviewNotes !== undefined
              ? { reviewNotes: dto.reviewNotes }
              : {}),
            updatedAt: new Date(),
          },
          include: {
            auth: {
              select: {
                id: true,
                fullName: true,
                email: true,
                status: true,
              },
            },
            specialization: true,
          },
        }),
        this.prisma.auth.update({
          where: { id: provider.authId },
          data: { status: authStatus },
        }),
      ]);

      await this.invalidateCaches(provider.id, provider.authId);

      return {
        message: `Provider status updated to ${this.formatStatusLabel(dto.status)}`,
        data: {
          id: updatedProfile.id,
          authId: updatedProfile.authId,
          fullName: updatedProfile.auth.fullName,
          email: updatedProfile.auth.email,
          status: updatedProfile.status,
          statusLabel: this.formatStatusLabel(updatedProfile.status),
          reviewNotes: updatedProfile.reviewNotes,
          updatedAt: updatedProfile.updatedAt,
        },
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to update provider status: ${errMessage}`,
      );
    }
  }

  async requestMoreInfo(identifier: string, dto: RequestMoreInfoDto) {
    try {
      const provider = await this.prisma.providerProfile.findFirst({
        where: {
          OR: [{ id: identifier }, { authId: identifier }],
        },
      });

      if (!provider) {
        throw new NotFoundException(
          `Provider record for ID "${identifier}" not found`,
        );
      }

      const updatedProfile = await this.prisma.providerProfile.update({
        where: { id: provider.id },
        data: {
          status: ProviderStatus.PENDING,
          reviewNotes: dto.notes,
          updatedAt: new Date(),
        },
        include: {
          auth: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      await this.invalidateCaches(provider.id, provider.authId);

      return {
        message: 'Request for additional information logged successfully',
        data: {
          id: updatedProfile.id,
          authId: updatedProfile.authId,
          fullName: updatedProfile.auth.fullName,
          email: updatedProfile.auth.email,
          status: updatedProfile.status,
          statusLabel: this.formatStatusLabel(updatedProfile.status),
          reviewNotes: updatedProfile.reviewNotes,
          updatedAt: updatedProfile.updatedAt,
        },
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to request information from provider: ${errMessage}`,
      );
    }
  }
}
