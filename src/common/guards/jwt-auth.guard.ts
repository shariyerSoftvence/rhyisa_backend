import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { RoleType, UserStatus } from '../../../generated/prisma/enums';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
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

    // Fresh user fetch from database
    const user = await this.prisma.auth.findUnique({
      where: {
        id: jwtUser.id,
      },
      select: {
        id: true,
        role: true,
        status: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // overwrite request.user with fresh db user
    request.user = user;

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

    return true;
  }
}
