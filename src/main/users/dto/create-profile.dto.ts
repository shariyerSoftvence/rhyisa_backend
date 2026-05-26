import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  CurrentActivityLevel,
  CurrentDiet,
  Gender,
  PrimaryGoal,
  SupplementType,
} from '../../../../generated/prisma/enums';

export class CreateUserProfileDto {
  @ApiProperty({
    example: 'David William',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: '+8801712345678',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Dhaka, Bangladesh',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: 25,
  })
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  age!: number;

  @ApiProperty({
    enum: Gender,
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({
    example: 175,
    description: 'Height in CM',
  })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  height!: number;

  @ApiProperty({
    example: 168,
    description: 'Weight in lbs',
  })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  weight!: number;

  @ApiProperty({
    enum: CurrentActivityLevel,
    example: CurrentActivityLevel.MODERATELY_ACTIVE,
  })
  @IsEnum(CurrentActivityLevel)
  currentActivityLevel!: CurrentActivityLevel;

  @ApiProperty({
    enum: CurrentDiet,
    example: CurrentDiet.BALANCED,
  })
  @IsEnum(CurrentDiet)
  currentDiet!: CurrentDiet;

  @ApiProperty({
    enum: PrimaryGoal,
    isArray: true,
    example: [PrimaryGoal.BUILD_MUSCLE],
  })
  @IsArray()
  @IsEnum(PrimaryGoal, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return [];
  })
  primaryGoal!: PrimaryGoal[];

  @ApiProperty({
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  motivationLevel!: number;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasHealthCondition!: boolean;

  @ApiProperty({
    enum: SupplementType,
    isArray: true,
    example: [SupplementType.CREATINE],
  })
  @IsArray()
  @IsEnum(SupplementType, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return [];
  })
  supplements!: SupplementType[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
  })
  profileImage?: any;
}