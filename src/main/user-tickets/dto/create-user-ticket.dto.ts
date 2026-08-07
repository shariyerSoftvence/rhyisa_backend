import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  PreferredContactMethod,
  TicketPriority,
} from '../../../../generated/prisma/enums';

export class CreateUserTicketDto {
  @ApiProperty({
    example: 'I was double charged this month',
    description: 'Subject title of the ticket',
  })
  @IsNotEmpty()
  @IsString()
  subject!: string;

  @ApiProperty({
    example: 'I was charged twice for my subscription...',
    description: 'Detailed description of the issue',
  })
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiPropertyOptional({
    example: 'Billing',
    description: 'Category e.g. Billing, Technical, General',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    enum: PreferredContactMethod,
    default: PreferredContactMethod.EMAIL,
    description: 'Preferred contact method: EMAIL or PHONE',
  })
  @IsOptional()
  @IsEnum(PreferredContactMethod)
  preferredContactMethod?: PreferredContactMethod;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com/receipt.png'],
    description: 'Optional attachment URL strings',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
