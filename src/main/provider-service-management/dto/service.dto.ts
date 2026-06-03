import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateServiceDto {
  @ApiProperty({ example: 'Deep Tissue Massage' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 120.0 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  price!: number;

  @ApiProperty({ example: 60, description: 'Duration of service in minutes' })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  durationInMinutes!: number;
}

export class UpdateServiceDto {
  @ApiPropertyOptional({ example: 'Sports Massage Therapy' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 150.0 })
  @Transform(({ value }) => (value ? Number(value) : value))
  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ example: 90 })
  @Transform(({ value }) => (value ? Number(value) : value))
  @IsNumber()
  @IsPositive()
  @IsOptional()
  durationInMinutes?: number;
}
