import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsNotEmpty, IsPositive } from 'class-validator';
import { CommissionType } from '../../../../../generated/prisma/enums';

export class UpdateCommissionDto {
  @ApiProperty({
    enum: CommissionType,
    example: CommissionType.FLAT,
    description: 'The billing operational strategy type',
  })
  @IsEnum(CommissionType)
  @IsNotEmpty()
  commissionType!: CommissionType;

  @ApiProperty({
    example: 20.0,
    description: 'The absolute monetary charge value or percentage slice cut',
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  commissionRate!: number;
}
