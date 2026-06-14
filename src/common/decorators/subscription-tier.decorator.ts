import { SetMetadata } from '@nestjs/common';
import { SubscriptionType } from '../../../generated/prisma/enums';

export const SUBSCRIPTION_TIER_KEY = 'subscription_tiers';
export const SubscriptionTiers = (...tiers: SubscriptionType[]) => SetMetadata(SUBSCRIPTION_TIER_KEY, tiers);