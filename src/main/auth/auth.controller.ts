import { Controller, Post, Body, Get, UseGuards, Req, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto, ForgotPasswordDto, VerifyForgotPasswordDto, ChangePasswordDto, LogoutDto } from './dto/auth-extra.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';


@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered. OTP sent to email.' })
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify email OTP' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Initiate forgot password process' })
  @ApiResponse({ status: 200, description: 'OTP sent to email' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-forgot-password')
  @ApiOperation({ summary: 'Verify forgot password OTP and set new password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async verifyForgotPasswordOtp(@Body() verifyForgotPasswordDto: VerifyForgotPasswordDto) {
    return await this.authService.verifyForgotPasswordOtp(verifyForgotPasswordDto);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for logged in user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(@Req() req: any, @Body() changePasswordDto: ChangePasswordDto) {
    return await this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile fetched successfully' })
  async getMe(@Req() req: any) {
    return await this.authService.getMe(req.user.id);
  }

 @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example: 'your_refresh_token_here',
        },
      },
      required: ['refreshToken'],
    },
  })
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ) {
    return await this.authService.refreshToken(refreshToken);
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin only route example' })
  async adminOnly() {
    return { message: 'Welcome Admin' };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  @ApiBody({ type: LogoutDto })
  async logout(
    @Body() logoutDto: LogoutDto,
  ) {
    return this.authService.logout(
      logoutDto.refreshToken,
    );
  }
}
