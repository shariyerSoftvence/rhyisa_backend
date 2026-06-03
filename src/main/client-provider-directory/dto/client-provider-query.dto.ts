import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class GetProviderAvailabilityDto {
  @ApiProperty({
    example: '2026-06-05',
    description: 'Target date to check slots for',
  })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({
    example: 'service-uuid-here',
    description: 'The service ID to calculate time slots duration',
  })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;
}
