import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RoleType, LoginType, UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedSuperAdmin() {
    try {
      const email = process.env.ADMIN_MAIL!;
      const password = process.env.ADMIN_PASS!;
      console.log(email, "email is this")

      if (!email || !password) {
        this.logger.error('ADMIN_MAIL or ADMIN_PASS is not defined in the environment variables');
        return { success: false, message: 'Missing environment variables' };
      }

      const existingAdmin = await this.prisma.auth.findUnique({
        where: { email },
      });

      if (existingAdmin) {
        this.logger.log(`Super Admin with email ${email} already exists. Skipping seed.`);
        return { success: true, message: 'Super admin already exists' };
      }
      const salt = Number(process.env.PASS_HASH_SALT!)
      const hashedPassword = await bcrypt.hash(password, salt);

      const superAdmin = await this.prisma.auth.create({
        data: {
          email,
          password: hashedPassword,
          fullName: 'Super Admin',
          role: RoleType.ADMIN,
          loginType: LoginType.EMAIL,
          status: UserStatus.ACTIVE,
          isVerified: true,
          isEmailVerified: true,
          isOnline: false,
          isPhoneVerified: false,
        },
      });

      this.logger.log(`Super Admin successfully seeded with ID: ${superAdmin.id}`);
      return { success: true, message: 'Super admin seeded successfully', data: { id: superAdmin.id, email: superAdmin.email } };
    } catch (error) {
      this.logger.error('Failed to seed super admin', error);
      throw new InternalServerErrorException('Failed to complete super admin seeding execution');
    }
  }
}