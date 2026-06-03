import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, Matches } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: '2026-06-05', description: 'Date of the booking' })
  @IsDateString()
  @IsNotEmpty()
  bookingDate!: string;

  @ApiProperty({ example: '10:00', description: 'Start time in HH:mm format' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    example: 'service-uuid-here',
    description: 'ID of the selected service',
  })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({
    example: 'provider-uuid-here',
    description: 'ID of the selected provider',
  })
  @IsString()
  @IsNotEmpty()
  providerId!: string;
}

export class RescheduleBookingDto {
  @ApiProperty({
    example: '2026-06-10',
    description: 'New date for the booking',
  })
  @IsDateString()
  @IsNotEmpty()
  bookingDate!: string;

  @ApiProperty({
    example: '14:30',
    description: 'New start time in HH:mm format',
  })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  @IsNotEmpty()
  startTime!: string;
}
