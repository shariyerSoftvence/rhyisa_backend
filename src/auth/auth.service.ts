import { Injectable, ConflictException, UnauthorizedException, InternalServerErrorException, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MailService } from '../common/mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto, ForgotPasswordDto, VerifyForgotPasswordDto, ChangePasswordDto } from './dto/auth-extra.dto';
import { OTPType } from '../../generated/prisma/enums';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    try {
      const { email, password, fullName, role } = registerDto;

      const existingUser = await this.prisma.auth.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      const hashSalt = Number(process.env.PASS_HASH_SALT) || 12
      const hashedPassword = await bcrypt.hash(password, hashSalt);

      const user = await this.prisma.auth.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role,
        },
      });

       await this.generateAndSendOtp(user.id, email, OTPType.EMAIL_VERIFICATION);

      return {
        message: 'Registration successful. OTP sent to your email.',
        userId: user.id,
      };
    } catch (error: any) {
      this.logger.error(`Registration failed: ${error.message}`);
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Something went wrong during registration');
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    try {
      const { email, otp } = verifyOtpDto;

      const user = await this.prisma.auth.findUnique({ where: { email } });
      if (!user) throw new NotFoundException('User not found');

      const isValid = await this.validateOtp(user.id, email, otp, OTPType.EMAIL_VERIFICATION);
      if (!isValid) throw new BadRequestException('Invalid or expired OTP');

      await this.prisma.auth.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });

      return { message: 'Email verified successfully' };
    } catch (error: any) {
      this.logger.error(`OTP Verification failed: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Something went wrong during OTP verification');
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;

      const user = await this.prisma.auth.findUnique({ where: { email } });
      if (!user) throw new UnauthorizedException('User not found with this email.');

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

      if (!user.isEmailVerified) throw new UnauthorizedException('Please verify your email first');

      const tokens = await this.generateTokens(user.id, user.email, user.role);

      await this.prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          authId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      };
    } catch (error: any) {
      this.logger.error(`Login failed: ${error.message}`);
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Something went wrong during login');
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const { email } = forgotPasswordDto;
      const user = await this.prisma.auth.findUnique({ where: { email } });
      if (!user) throw new NotFoundException('User not found');

      await this.generateAndSendOtp(user.id, email, OTPType.FORGOT_PASSWORD);

      return { message: 'OTP sent to your email for password reset' };
    } catch (error: any) {
      this.logger.error(`Forgot password failed: ${error.message}`);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async verifyForgotPasswordOtp(verifyForgotPasswordDto: VerifyForgotPasswordDto) {
    try {
      const { email, otp, newPassword } = verifyForgotPasswordDto;

      const user = await this.prisma.auth.findUnique({ where: { email } });
      if (!user) throw new NotFoundException('User not found');

      const isValid = await this.validateOtp(user.id, email, otp, OTPType.FORGOT_PASSWORD);
      if (!isValid) throw new BadRequestException('Invalid or expired OTP');

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.auth.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      await this.prisma.refreshToken.updateMany({
        where: {
          authId: user.id,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });

      return { message: 'Password reset successfully' };
    } catch (error: any) {
      this.logger.error(`Forgot password verification failed: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    try {
      const { oldPassword, newPassword } = changePasswordDto;
      const user = await this.prisma.auth.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) throw new BadRequestException('Incorrect previous password');

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.auth.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

       await this.prisma.refreshToken.updateMany({
          where: {
            authId: user.id,
            isRevoked: false,
          },
          data: {
            isRevoked: true,
          },
        });

      return { message: 'Password changed successfully' };
    } catch (error: any) {
      this.logger.error(`Change password failed: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async getMe(userId: string) {
    try {
      const user = await this.prisma.auth.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          isEmailVerified: true,
        },
      });

      if (!user) throw new UnauthorizedException('User not found');
      return user;
    } catch (error: any) {
      this.logger.error(`Get profile failed: ${error.message}`);
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Something went wrong fetching profile');
    }
  }

async refreshToken(token: string) {
  try {

    // VERIFY JWT FIRST
    await this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });

    // FIND TOKEN IN DB
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { auth: true },
    });

    if (
      !storedToken ||
      storedToken.isRevoked ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // GENERATE NEW TOKENS
    const tokens = await this.generateTokens(
      storedToken.auth.id,
      storedToken.auth.email,
      storedToken.auth.role,
    );

    // REVOKE OLD TOKEN
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // SAVE NEW REFRESH TOKEN
    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        authId: storedToken.auth.id,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return tokens;

  } catch (error) {
    this.logger.error(`Refresh token failed: ${error}`);

    throw new UnauthorizedException(
      'Invalid or expired refresh token',
    );
  }
}

  private async generateAndSendOtp(userId: string, email: string, type: OTPType) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.redis.set(`otp:${type}:${email}`, otp, 600);

    await this.prisma.oTP.create({
      data: {
        code: otp,
        type,
        expiresAt,
        authId: userId,
      },
    });

    // Send Mail
    await this.mailService.sendOtpMail(email, otp, type === OTPType.EMAIL_VERIFICATION ? 'registration' : 'forgot-password');
    return otp;
  }

  private async validateOtp(userId: string, email: string, otp: string, type: OTPType) {
    // Check Redis first
    const redisOtp = await this.redis.get<string>(`otp:${type}:${email}`);
    if (redisOtp && redisOtp === otp) {
      await this.redis.del(`otp:${type}:${email}`);
      return true;
    }

    // Check DB as fallback
    const dbOtp = await this.prisma.oTP.findFirst({
      where: {
        authId: userId,
        code: otp,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (dbOtp) {
      await this.prisma.oTP.update({
        where: { id: dbOtp.id },
        data: { isUsed: true },
      });
      return true;
    }

    return false;
  }

private async generateTokens(
  userId: string,
  email: string,
  role: string,
) {

  const accessSecret =
    this.configService.get<string>('JWT_ACCESS_SECRET')!;

  const refreshSecret =
    this.configService.get<string>('JWT_REFRESH_SECRET')!;

  const accessExpires =
    this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN') ?? '15m';

  const refreshExpires =
    this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d';

  const [accessToken, refreshToken] = await Promise.all([

    this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role,
      },
      {
        secret: accessSecret,
        expiresIn: accessExpires as any,
      },
    ),

    this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role,
      },
      {
        secret: refreshSecret,
        expiresIn: refreshExpires as any,
      },
    ),

  ]);

  return {
    accessToken,
    refreshToken,
  };
}


async logout(refreshToken: string) {

  const token = await this.prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!token) {
    throw new UnauthorizedException('Invalid token');
  }

  await this.prisma.refreshToken.update({
    where: { id: token.id },
    data: {
      isRevoked: true,
    },
  });

  return {
    message: 'Logout successful',
  };
}
}
