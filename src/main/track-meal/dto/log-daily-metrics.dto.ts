import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogDailyMetricsDto {
  @ApiProperty({
    example: 8,
    description: 'Number of water glasses consumed today',
  })
  @IsInt()
  @Min(0)
  waterGlasses!: number;

  @ApiProperty({
    example: 7500,
    description: 'Total step count tracked for today',
  })
  @IsInt()
  @Min(0)
  steps!: number;

  @ApiProperty({ example: 7, description: 'Hours of recorded sleep duration' })
  @IsInt()
  @Min(0)
  @Max(24)
  sleepHours!: number;

  @ApiProperty({
    example: 30,
    description: 'Minutes of recorded sleep duration remainder',
  })
  @IsInt()
  @Min(0)
  @Max(59)
  sleepMinutes!: number;
}
