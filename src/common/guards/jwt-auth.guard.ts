import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RoleType, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from '../decorators/allow-incomplete-profile.decorator';
import { checkOverallProfileCompletion } from '../utils/profile-completion.util';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = (await super.canActivate(context)) as boolean;

    if (!canActivate) {
      throw new UnauthorizedException('Unauthorized');
    }

    const request = context.switchToHttp().getRequest();
    const jwtUser = request.user;

    if (!jwtUser?.id) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Fresh user fetch from database including profile relations
    const user = await this.prisma.auth.findUnique({
      where: {
        id: jwtUser.id,
      },
      include: {
        userProfile: {
          include: {
            profileImage: true,
          },
        },
        providerProfile: {
          include: {
            profileImage: true,
            driverLicense: true,
            certificate: true,
            governmentIssueId: true,
            marketplaceInsurance: true,
            additionalCertificate: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const profileCompletion = checkOverallProfileCompletion(user);
    const isProfileComplete = profileCompletion.isProfileComplete;

    // Overwrite request.user with fresh db user and token metadata
    request.user = {
      ...user,
      profileCompletion,
      isProfileComplete,
      tokenType: jwtUser.tokenType || (isProfileComplete ? 'FULL_ACCESS' : 'PROFILE_COMPLETION'),
    };

    // Admin bypass
    if (user.role === RoleType.ADMIN) {
      return true;
    }

    // Email verification
    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email address');
    }

    // User status check
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(`Your account is ${user.status}`);
    }

    // Profile Completion Access Control
    const allowIncomplete = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INCOMPLETE_PROFILE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const path: string = request.path || request.url || '';
    const isProfileWhitelistedPath =
      path.includes('/auth/me') ||
      path.includes('/auth/logout') ||
      path.includes('/user/profile') ||
      path.includes('/users/profile') ||
      path.includes('/provider-profile') ||
      path.includes('/upload-files');

    if (!isProfileComplete && !allowIncomplete && !isProfileWhitelistedPath) {
      throw new ForbiddenException(
        `Profile registration incomplete (${profileCompletion.completionPercentage}% complete). Missing: ${profileCompletion.missingFields.join(', ')}. Please complete 100% of your profile to access all features.`,
      );
    }

    return true;
  }
}
