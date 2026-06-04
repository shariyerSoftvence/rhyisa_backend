import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InsuranceService } from './insurance.service';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RoleType } from '../../../../generated/prisma/enums';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('ADMIN Insurance Management')
@Controller('admin/insurance')
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new insurance company (Admin Only)' })
  @ApiResponse({ status: 201, description: 'Created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 409, description: 'Conflict.' })
  async create(@Body() createInsuranceDto: CreateInsuranceDto) {
    return this.insuranceService.createInsurance(createInsuranceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all insurance companies with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Fetched successfully.' })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.insuranceService.getAllInsurance(pageNum, limitNum);
  }

  @Patch(':insuranceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing insurance company (Admin Only)',
  })
  @ApiResponse({ status: 200, description: 'Updated successfully.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async update(
    @Param('insuranceId') insuranceId: string,
    @Body() updateInsuranceDto: UpdateInsuranceDto,
  ) {
    return this.insuranceService.updateInsurance(
      insuranceId,
      updateInsuranceDto,
    );
  }

  @Delete(':insuranceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an insurance company (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async remove(@Param('insuranceId') insuranceId: string) {
    return this.insuranceService.deleteInsurance(insuranceId);
  }
}
