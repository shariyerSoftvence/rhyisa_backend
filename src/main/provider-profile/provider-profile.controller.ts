import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ProviderProfileService } from './provider-profile.service';
import {
  CreateProviderProfileDto,
  UpdateProviderProfileDto,
  SetupAvailabilityDto,
} from './dto/provider-profile.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { StripeConnectLinkDto } from './dto/stripe-onboarding.dto';

@ApiTags('Professional Provider Profile Administration portfolio')
@Controller('provider/profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.PROVIDER)
@ApiBearerAuth()
export class ProviderProfileController {
  constructor(
    private readonly providerProfileService: ProviderProfileService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Create profile with memory files uploaded via custom upload service',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'driverLicense', maxCount: 1 },
      { name: 'certificate', maxCount: 1 },
      { name: 'governmentIssueId', maxCount: 1 },
      { name: 'marketplaceInsurance', maxCount: 1 },
      { name: 'additionalCertificate', maxCount: 1 },
    ]),
  )
  async createMyProfile(
    @Req() req: any,
    @Body() dto: CreateProviderProfileDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      driverLicense?: Express.Multer.File[];
      certificate?: Express.Multer.File[];
      governmentIssueId?: Express.Multer.File[];
      marketplaceInsurance?: Express.Multer.File[];
      additionalCertificate?: Express.Multer.File[];
    },
  ) {
    const authId = req.user.id;
    return this.providerProfileService.createProfile(authId, dto, files);
  }

  @Patch()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Update active provider profiles textual attributes alongside selective validation files tracking logs',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'driverLicense', maxCount: 1 },
      { name: 'certificate', maxCount: 1 },
      { name: 'governmentIssueId', maxCount: 1 },
      { name: 'marketplaceInsurance', maxCount: 1 },
      { name: 'additionalCertificate', maxCount: 1 },
    ]),
  )
  async updateMyProfile(
    @Req() req: any,
    @Body() dto: UpdateProviderProfileDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      driverLicense?: Express.Multer.File[];
      certificate?: Express.Multer.File[];
      governmentIssueId?: Express.Multer.File[];
      marketplaceInsurance?: Express.Multer.File[];
      additionalCertificate?: Express.Multer.File[];
    },
  ) {
    const authId = req.user.id;
    return this.providerProfileService.updateProfile(authId, dto, files);
  }

  @Post('availability')
  @ApiOperation({
    summary:
      'Configure or overwrite calendar operational matrix sequences and active runtime shifts',
  })
  async updateTimetableSchedule(
    @Req() req: any,
    @Body() dto: SetupAvailabilityDto,
  ) {
    const authId = req.user.id;
    return this.providerProfileService.setupAvailability(authId, dto);
  }

  @Post('create-stripe-account-checkout')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate Express Connect onboarding verification checkouts redirection links',
  })
  async getLink(@Req() req: any, @Body() dto: StripeConnectLinkDto) {
    return this.providerProfileService.createAccountOnboardingLink(
      req.user.id,
      dto,
    );
  }
}
