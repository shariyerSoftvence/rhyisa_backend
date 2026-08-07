import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestMoreInfoDto {
  @ApiProperty({
    example:
      'Please upload a clearer copy of your Medical Certificate and Government ID.',
    description:
      'Detailed instructions/notes to request additional documentation or clarification from provider (max 500 chars)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  notes!: string;
}
