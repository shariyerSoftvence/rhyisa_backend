import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  TicketPriority,
  TicketStatus,
} from '../../../../../generated/prisma/enums';

export class UpdateTicketStatusDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}

export class UpdateTicketPriorityDto {
  @ApiPropertyOptional({ enum: TicketPriority })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}

export class AssignTicketDto {
  @ApiPropertyOptional({
    description: 'Admin Auth ID to assign ticket to, or null/empty to unassign',
  })
  @IsOptional()
  @IsString()
  adminId?: string;
}
