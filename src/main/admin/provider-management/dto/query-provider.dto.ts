import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProviderFilterStatus {
  ALL = 'ALL',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export class QueryProviderDto {
  @ApiPropertyOptional({
    description:
      'Search term for provider name, email, phone, specialization, location',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ProviderFilterStatus,
    description:
      'Filter providers by status: ALL, PENDING, ACCEPTED (Approved), REJECTED (Denied), SUSPENDED',
  })
  @IsOptional()
  @IsEnum(ProviderFilterStatus)
  status?: ProviderFilterStatus;

  @ApiPropertyOptional({ description: 'Filter by specialization ID' })
  @IsOptional()
  @IsString()
  specializationId?: string;

  @ApiPropertyOptional({ description: 'Start date filter YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by: createdAt, updatedAt, status',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction: asc or desc',
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}
