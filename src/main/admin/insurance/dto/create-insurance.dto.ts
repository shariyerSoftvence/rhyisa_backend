import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateInsuranceDto {
  @ApiProperty({ example: 'Metlife', description: 'The name of the insurance company' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Description about Metlife', description: 'Optional description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://www.metlife.com', description: 'External link to the website' })
  @IsUrl()
  @IsNotEmpty()
  externalLink!: string;
}