import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 4.5, description: 'Rating score from 1 to 5' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating!: number;

  @ApiPropertyOptional({
    example: 'Great service session, highly recommended!',
    description: 'Optional textural commentary evaluation',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({
    example: 'booking-uuid-here',
    description: 'The completed unique booking entry reference ID',
  })
  @IsString()
  @IsNotEmpty()
  bookingId!: string;
}
