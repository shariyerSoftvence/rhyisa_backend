import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class StripeConnectLinkDto {
  @ApiProperty({ example: 'https://yourfrontend.com/stripe-callback/success' })
  @IsNotEmpty()
  returnUrl!: string;

  @ApiProperty({ example: 'https://yourfrontend.com/stripe-callback/refresh' })
  @IsNotEmpty()
  refreshUrl!: string;
}