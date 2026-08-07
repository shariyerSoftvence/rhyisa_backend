import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProviderStatus } from '../../../../../generated/prisma/enums';

export class ActionProviderDto {
  @ApiProperty({
    enum: ProviderStatus,
    example: ProviderStatus.ACCEPTED,
    description:
      'New status for the provider: ACCEPTED (Approved), REJECTED (Denied), SUSPENDED, PENDING',
  })
  @IsNotEmpty()
  @IsEnum(ProviderStatus)
  status!: ProviderStatus;

  @ApiPropertyOptional({
    example: 'Credentials verified successfully. Approved for practice.',
    description:
      'Admin review notes attached to the provider application (max 500 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;
}
