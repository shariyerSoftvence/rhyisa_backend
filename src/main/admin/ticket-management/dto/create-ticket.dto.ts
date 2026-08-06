import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PreferredContactMethod, TicketPriority } from '../../../../../generated/prisma/enums';

export class CreateTicketDto {
  @ApiProperty({ example: 'I was double charged this month' })
  @IsNotEmpty()
  @IsString()
  subject!: string;

  @ApiProperty({ example: 'I was charged twice for my annual subscription...' })
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'Billing & Payments' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: PreferredContactMethod, default: PreferredContactMethod.EMAIL })
  @IsOptional()
  @IsEnum(PreferredContactMethod)
  preferredContactMethod?: PreferredContactMethod;

  @ApiPropertyOptional({ type: [String], example: ['https://example.com/receipt.png'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
