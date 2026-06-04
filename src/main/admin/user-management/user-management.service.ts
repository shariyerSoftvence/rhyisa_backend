import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ProviderStatus,
  RoleType,
  UserStatus,
} from '../../../../generated/prisma/enums';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class UserManagementService {
  private readonly CACHE_TTL = 300;
  private readonly USER_CACHE_PREFIX = 'users:list:';
  private readonly PROVIDER_CACHE_PREFIX = 'providers:list:';
  private readonly SINGLE_USER_PREFIX = 'user:id:';
  private readonly SINGLE_PROVIDER_PREFIX = 'provider:id:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 10) {
    try {
      const cacheKey = `${this.USER_CACHE_PREFIX}page_${page}_limit_${limit}`;
      const cachedData = await this.redis.get<any>(cacheKey);
      if (cachedData) return cachedData;

      const skip = (page - 1) * limit;
      const [data, total] = await this.prisma.$transaction([
        this.prisma.auth.findMany({
          where: { role: RoleType.USER },
          include: { userProfile: true },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auth.count({ where: { role: RoleType.USER } }),
      ]);

      const response = {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      await this.redis.set(cacheKey, response, this.CACHE_TTL);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch users registry metadata profile list',
      );
    }
  }

  async getAllProviders(page: number = 1, limit: number = 10) {
    try {
      const cacheKey = `${this.PROVIDER_CACHE_PREFIX}page_${page}_limit_${limit}`;
      const cachedData = await this.redis.get<any>(cacheKey);
      if (cachedData) return cachedData;

      const skip = (page - 1) * limit;
      const [data, total] = await this.prisma.$transaction([
        this.prisma.auth.findMany({
          where: { role: RoleType.PROVIDER },
          include: { providerProfile: true },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auth.count({ where: { role: RoleType.PROVIDER } }),
      ]);

      const response = {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      await this.redis.set(cacheKey, response, this.CACHE_TTL);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch healthcare providers metadata registry profiles',
      );
    }
  }

  async getSingleUser(id: string) {
    try {
      const cacheKey = `${this.SINGLE_USER_PREFIX}${id}`;
      const cachedData = await this.redis.get<any>(cacheKey);
      if (cachedData) return cachedData;

      const user = await this.prisma.auth.findFirst({
        where: { id, role: RoleType.USER },
        include: { userProfile: true },
      });

      if (!user) {
        throw new NotFoundException(
          `User record identity containing ID ${id} was not found inside storage metrics`,
        );
      }

      await this.redis.set(cacheKey, user, this.CACHE_TTL);
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to recover user profile identity mapping data profile tracking parameters',
      );
    }
  }

  async getSingleProvider(id: string) {
    try {
      const cacheKey = `${this.SINGLE_PROVIDER_PREFIX}${id}`;
      const cachedData = await this.redis.get<any>(cacheKey);
      if (cachedData) return cachedData;

      const provider = await this.prisma.auth.findFirst({
        where: { id, role: RoleType.PROVIDER },
        include: { providerProfile: true },
      });

      if (!provider) {
        throw new NotFoundException(
          `Provider structural record data containing ID ${id} was not located inside storage database matrix system parameters`,
        );
      }

      await this.redis.set(cacheKey, provider, this.CACHE_TTL);
      return provider;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch details profile mapping logs analysis parameters profile',
      );
    }
  }

  async changeUserStatus(id: string, status: UserStatus) {
    try {
      const account = await this.prisma.auth.findUnique({
        where: { id },
      });

      if (!account) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }

      if (account.status === status) {
        throw new BadRequestException(`Account status is already ${status}`);
      }

      const updatedAccount = await this.prisma.auth.update({
        where: { id },
        data: { status },
      });

      // Clear dynamic targets from cache layout
      await this.redis.del(`${this.SINGLE_USER_PREFIX}${id}`);
      await this.redis.del(`${this.SINGLE_PROVIDER_PREFIX}${id}`);
      await this.redis.del(`${this.USER_CACHE_PREFIX}page_1_limit_10`);
      await this.redis.del(`${this.PROVIDER_CACHE_PREFIX}page_1_limit_10`);

      return {
        message: `Account status successfully updated to ${status}`,
        data: {
          id: updatedAccount.id,
          email: updatedAccount.email,
          status: updatedAccount.status,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to change user account status',
      );
    }
  }

  async actionProviderRequest(providerId: string, status: ProviderStatus) {
    try {
      const providerProfile = await this.prisma.providerProfile.findUnique({
        where: { id: providerId },
      });

      if (!providerProfile) {
        throw new NotFoundException(
          `Provider profile context record for ID ${providerId} not found`,
        );
      }

      if (status === ProviderStatus.PENDING) {
        throw new BadRequestException(
          'Cannot change provider verification status back to PENDING',
        );
      }

      const updatedProfile = await this.prisma.providerProfile.update({
        where: { id: providerId },
        data: { status },
      });

      // Evict dynamic caches to maintain state updates synchronization
      await this.redis.del(
        `${this.SINGLE_PROVIDER_PREFIX}${updatedProfile.authId}`,
      );
      await this.redis.del(`${this.PROVIDER_CACHE_PREFIX}page_1_limit_10`);

      return {
        message: `Provider status successfully updated to ${status}`,
        data: updatedProfile,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to execute state operation modification on provider profile request',
      );
    }
  }
}
