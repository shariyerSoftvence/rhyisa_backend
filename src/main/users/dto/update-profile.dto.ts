import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum, IsArray } from 'class-validator';
import { FatLevelRange, HealthCondition, ShortTermGoal, LongTermGoal, BodyType } from '../../../../generated/prisma/client';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ example: 'David William Updated' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '+9876543210' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '456 Fitness St, Dhaka' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 29 })
  @IsNumber()
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ example: 5.10 })
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ example: 160.0 })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ enum: BodyType })
  @IsEnum(BodyType)
  @IsOptional()
  bodyType?: BodyType;

  @ApiPropertyOptional({ enum: FatLevelRange })
  @IsEnum(FatLevelRange)
  @IsOptional()
  averageFatLevel?: FatLevelRange;

  @ApiPropertyOptional({ enum: HealthCondition, isArray: true })
  @IsArray()
  @IsEnum(HealthCondition, { each: true })
  @IsOptional()
  healthConditions?: HealthCondition[];

  @ApiPropertyOptional({ enum: ShortTermGoal })
  @IsEnum(ShortTermGoal)
  @IsOptional()
  shortTermGoal?: ShortTermGoal;

  @ApiPropertyOptional({ enum: LongTermGoal })
  @IsEnum(LongTermGoal)
  @IsOptional()
  longTermGoal?: LongTermGoal;

  @ApiPropertyOptional({ example: 'Updated meal description parameters' })
  @IsString()
  @IsOptional()
  mealDescription?: string;

 @ApiProperty({ type: 'string', format: 'binary', description: 'Upload avatar user profile image' })
  profileImage: any;
}