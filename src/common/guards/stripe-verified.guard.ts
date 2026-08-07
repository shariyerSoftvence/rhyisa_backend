import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StripeVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException(
        'Authentication credential context missing from active network pipeline',
      );
    }

    const providerProfile = await this.prisma.providerProfile.findUnique({
      where: { authId: user.id },
    });

    if (!providerProfile) {
      throw new NotFoundException(
        'Operational profile mappings not discovered inside active database layer',
      );
    }

    if (!providerProfile.isPaymentEnabled) {
      throw new ForbiddenException(
        'Your Stripe Connect Express account onboarding sequence parameters are incomplete or unverified',
      );
    }

    return true;
  }
}
