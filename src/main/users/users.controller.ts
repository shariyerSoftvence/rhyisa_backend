import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { CreateUserProfileDto } from './dto/create-profile.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';
import { UserProfileService } from './users.service';


@ApiTags('Client User Profile Portfolio')
@Controller('user/profile')
@UseGuards(RolesGuard)
@Roles(RoleType.USER)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create personalized medical metric log profile records data' })
  @ApiResponse({ status: 201, description: 'Profile setup entries written successfully inside data matrix records.' })
  @ApiResponse({ status: 409, description: 'Target user structural layout record already populated.' })
  async createMyProfile(@Req() req: any, @Body() dto: CreateUserProfileDto) {
    const authId = req.user.id;
    return this.userProfileService.createProfile(authId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve operational profile indices parameters matching active token identity context' })
  @ApiResponse({ status: 200, description: 'Profile collection payload maps returned cleanly.' })
  @ApiResponse({ status: 404, description: 'Profile reference markers missing inside database cluster parameters.' })
  async getMyProfile(@Req() req: any) {
    const authId = req.user.id;
    return this.userProfileService.getProfileByAuthId(authId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update physical configurations attributes indexes trace details properties' })
  @ApiResponse({ status: 200, description: 'Target payload components overwritten cleanly.' })
  async updateMyProfile(@Req() req: any, @Body() dto: UpdateUserProfileDto) {
    const authId = req.user.id;
    return this.userProfileService.updateProfile(authId, dto);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Initiate account deactivation soft purge workflow sequence (Self-Delete)' })
  @ApiResponse({ status: 200, description: 'Target credentials identity marker switched cleanly to DELETED state configuration.' })
  async deleteMyAccount(@Req() req: any) {
    const authId = req.user.id;
    return this.userProfileService.selfDeleteAccount(authId);
  }
}