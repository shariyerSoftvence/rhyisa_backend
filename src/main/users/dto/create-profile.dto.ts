import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsArray } from 'class-validator';
import { BodyType, FatLevelRange, HealthCondition, ShortTermGoal, LongTermGoal } from '../../../../generated/prisma/enums';

export class CreateUserProfileDto {
  @ApiProperty({ example: 'David William', description: 'Full name of the user profile' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: '+1234567890', description: 'Contact number' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiProperty({ example: '123 Health Ave, Dhaka', description: 'Home address' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ example: 28, description: 'Age of the user' })
  @IsNumber()
  @IsNotEmpty()
  age!: number;

  @ApiProperty({ example: 5.9, description: 'Height in feet or centimeters' })
  @IsNumber()
  @IsNotEmpty()
  height!: number;

  @ApiProperty({ example: 165.4, description: 'Weight in lbs or kg' })
  @IsNumber()
  @IsNotEmpty()
  weight!: number;

  @ApiProperty({ enum: BodyType, example: BodyType.MESOMORPH, description: 'Physical body archetype' })
  @IsEnum(BodyType)
  @IsNotEmpty()
  bodyType!: BodyType;

  @ApiProperty({ enum: FatLevelRange, example: FatLevelRange.FITNESS, description: 'Estimated body fat tier' })
  @IsEnum(FatLevelRange)
  @IsNotEmpty()
  averageFatLevel!: FatLevelRange;

  @ApiProperty({ enum: HealthCondition, isArray: true, example: [HealthCondition.NONE], description: 'List of underlying medical issues' })
  @IsArray()
  @IsEnum(HealthCondition, { each: true })
  @IsNotEmpty()
  healthConditions!: HealthCondition[];

  @ApiProperty({ enum: ShortTermGoal, example: ShortTermGoal.LOSE_WEIGHT_QUICKLY, description: 'Target objective for upcoming weeks' })
  @IsEnum(ShortTermGoal)
  @IsNotEmpty()
  shortTermGoal!: ShortTermGoal;

  @ApiProperty({ enum: LongTermGoal, example: LongTermGoal.SUSTAINABLE_WEIGHT_LOSS, description: 'Core long term health target' })
  @IsEnum(LongTermGoal)
  @IsNotEmpty()
  longTermGoal!: LongTermGoal;

  @ApiProperty({ example: 'High protein diet, low carbs, 3 meals a day with green tea.', description: 'Details about user eating habits' })
  @IsString()
  @IsNotEmpty()
  mealDescription!: string;

  @ApiProperty({ example: 'media-uuid-string', description: 'Media ID attachment reference for body photo validation' })
  @IsString()
  @IsNotEmpty()
  bodyPhotoId!: string;
}