import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionType } from '../../../generated/prisma/enums';
import { SUBSCRIPTION_TIER_KEY } from '../decorators/subscription-tier.decorator';

@Injectable()
export class SubscriptionTierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTiers = this.reflector.getAllAndOverride<SubscriptionType[]>(
      SUBSCRIPTION_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTiers || requiredTiers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authUser = request.user;

    if (!authUser || !authUser.id) {
      return false;
    }

    const userProfile = await this.prisma.userProfile.findUnique({
      where: { authId: authUser.id },
      select: { subscriptionType: true },
    });

    if (!userProfile) {
      throw new NotFoundException(
        'Active user profile information could not be verified.',
      );
    }

    const hasAccess = requiredTiers.includes(userProfile.subscriptionType);

    if (!hasAccess) {
      throw new ForbiddenException(
        `This resource requires a subscription level of: [${requiredTiers.join(', ')}]. Your current tier is: ${userProfile.subscriptionType}`,
      );
    }

    return true;
  }
}
