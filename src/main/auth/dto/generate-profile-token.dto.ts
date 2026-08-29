import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GenerateProfileTokenDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the registered user',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user account',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
