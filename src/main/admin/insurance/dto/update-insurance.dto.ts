import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class UpdateInsuranceDto {
  @ApiPropertyOptional({ example: 'Metlife Updated', description: 'The name of the insurance company' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description', description: 'Optional description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://www.metlife-updated.com', description: 'External link to the website' })
  @IsUrl()
  @IsOptional()
  externalLink?: string;
}