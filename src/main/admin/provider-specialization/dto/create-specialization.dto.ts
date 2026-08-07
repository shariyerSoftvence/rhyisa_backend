import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSpecializationDto {
  @ApiProperty({
    example: 'Cardiology',
    description: 'The unique name of the provider specialization',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example:
      'Specialization focusing on heart health and cardiovascular diseases',
    description: 'Optional description of the specialization',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSpecializationDto {
  @ApiPropertyOptional({
    example: 'Advanced Cardiology',
    description: 'The unique name of the provider specialization',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated description focusing on structural heart interventions',
    description: 'Optional description of the specialization',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
