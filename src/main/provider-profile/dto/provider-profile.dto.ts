import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { DayOfWeek } from '../../../../generated/prisma/enums';
import { Type } from 'class-transformer';



export class CreateProviderProfileDto {
  @ApiProperty({ example: 'Dhaka, Bangladesh' })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({ example: 'Experienced certified physiotherapist specializing in sports recovery.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ type: 'string', format: 'binary' })
  profileImage: any;

  @ApiProperty({ type: 'string', format: 'binary' })
  driverLicense: any;

  @ApiProperty({ type: 'string', format: 'binary' })
  certificate: any;

  @ApiProperty({ example: 'specialization-uuid-string' })
  @IsString()
  @IsNotEmpty()
  specializationId!: string;
}

export class UpdateProviderProfileDto {
  @ApiPropertyOptional({ example: 'Chittagong, Bangladesh' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 'Updated provider descriptive information.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  profileImage?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  driverLicense?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  certificate?: any;

  @ApiPropertyOptional({ example: 'specialization-uuid-string-updated' })
  @IsString()
  @IsOptional()
  specializationId?: string;
}


export class AvailabilityDayDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.SATURDAY })
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  day!: DayOfWeek;

  @ApiPropertyOptional({ example: '09:00' })
  @IsString()
  @IsOptional()
  fromTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsString()
  @IsOptional()
  toTime?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsNotEmpty()
  isOff!: boolean;
}

export class SetupAvailabilityDto {
  @ApiProperty({ type: [AvailabilityDayDto] })
  @IsArray()
  @IsNotEmpty()
  availabilities!: AvailabilityDayDto[];
}