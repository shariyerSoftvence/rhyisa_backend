import { PartialType } from '@nestjs/swagger';

import { CreateUserProfileDto } from './create-profile.dto';

export class UpdateUserProfileDto extends PartialType(
  CreateUserProfileDto,
) {}