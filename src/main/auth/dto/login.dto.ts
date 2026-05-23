import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@gmail.com', description: 'The email of the user' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'admin@gmail.com', description: 'The password of the user' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
