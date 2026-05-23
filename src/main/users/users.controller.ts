import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

import { CreateUserProfileDto } from './dto/create-profile.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';
import { UserProfileService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';


@ApiTags('Client User Profile Portfolio')
@Controller('user/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.USER)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create personalized user metric profile record with memory image buffers storage' })
  @UseInterceptors(FileInterceptor('profileImage'))
  async createMyProfile(
    @Req() req: any,
    @Body() dto: CreateUserProfileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const authId = req.user.id;
    return this.userProfileService.createProfile(authId, dto, file);
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update physical configurations attributes indexes trace details properties dynamically' })
  @UseInterceptors(FileInterceptor('profileImage'))
  async updateMyProfile(
    @Req() req: any,
    @Body() dto: UpdateUserProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const authId = req.user.id;
    return this.userProfileService.updateProfile(authId, dto, file);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Initiate account deactivation soft purge workflow sequence (Self-Delete)' })
  @ApiResponse({ status: 200, description: 'Target credentials identity marker switched cleanly to DELETED state configuration.' })
  async deleteMyAccount(@Req() req: any) {
    const authId = req.user.id;
    return this.userProfileService.selfDeleteAccount(authId);
  }
}