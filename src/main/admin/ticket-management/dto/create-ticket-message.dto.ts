import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTicketMessageDto {
  @ApiProperty({ example: 'Thanks for reaching out! I am looking into this for you right now.' })
  @IsNotEmpty()
  @IsString()
  message!: string;
}
