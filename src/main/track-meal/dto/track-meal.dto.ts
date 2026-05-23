import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class TrackMealTextDto {
  @ApiProperty({ example: 'I had a bowl of grilled chicken salad with olive oil' })
  @IsString()
  @IsNotEmpty()
  text!: string;
}