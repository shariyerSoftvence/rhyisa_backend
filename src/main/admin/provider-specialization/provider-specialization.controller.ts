
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../generated/prisma/enums';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateSpecializationDto, UpdateSpecializationDto } from './dto/create-specialization.dto';
import { ProviderSpecializationService } from './provider-specialization.service';


@ApiTags('ADMIN Provider Specializations Registry')
@Controller('admin/specializations')
export class ProviderSpecializationController {
  constructor(private readonly specializationService: ProviderSpecializationService) {}

  @Post()
  @UseGuards(JwtAuthGuard ,RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Append a new specialization entry entity into database index profile portfolio (Admin Only)' })
  @ApiResponse({ status: 201, description: 'Created successfully inside the system tracking logs.' })
  @ApiResponse({ status: 400, description: 'Faulty parameters inputs structural data scheme.' })
  @ApiResponse({ status: 409, description: 'Conflict on identity parameter key values entries.' })
  async create(@Body() dto: CreateSpecializationDto) {
    return this.specializationService.createSpecialization(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Fetch all indexed specializations tracking profiles arrays with structural pagination parameters logs mapping' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Specializations structured layout metadata rows array mapped cleanly.' })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.specializationService.getAllSpecializations(pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pull target specialization specific parameters log data elements match configuration matching unique path entity reference parameters keys mapping attributes' })
  @ApiResponse({ status: 200, description: 'Target specification elements record returned successfully.' })
  @ApiResponse({ status: 404, description: 'Target index reference matrix path target data element missing.' })
  async findOne(@Param('id') id: string) {
    return this.specializationService.getSpecializationById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard ,RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update parameters details records variables mappings indexes properties values on specialization matching structural references matrix (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Data properties modified and synchronized cleanly.' })
  @ApiResponse({ status: 404, description: 'Specification entry item alignment missing.' })
  async update(@Param('id') id: string, @Body() dto: UpdateSpecializationDto) {
    return this.specializationService.updateSpecialization(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard ,RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Erase specialization schema item entirely out of platform storage structural arrays tracking metrics configurations portfolio context logs indicators (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Target component completely wiped out cleanly from database matrix metrics paths entries portfolio logs indicators references.' })
  @ApiResponse({ status: 404, description: 'Target data object parameters matching reference missing.' })
  async remove(@Param('id') id: string) {
    return this.specializationService.deleteSpecialization(id);
  }
}