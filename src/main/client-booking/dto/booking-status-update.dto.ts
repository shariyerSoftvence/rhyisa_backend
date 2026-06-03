import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { BookingStatus } from '../../../../generated/prisma/enums';


export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus, example: 'COMPLETED', description: 'New execution status metric for the target booking' })
  @IsEnum(BookingStatus)
  @IsNotEmpty()
  status!: BookingStatus;
}