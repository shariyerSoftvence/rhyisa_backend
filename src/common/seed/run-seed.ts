import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SeedService } from './seedService';

async function bootstrapSeeder() {
  try {
    console.log('Initializing application context for seeding processing...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const seedService = app.get(SeedService);

    console.log('Starting data seeding processing...');
   const data = await seedService.seedSuperAdmin();
    console.log(data)
    console.log('Seeding execution process finished successfully.');
    
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed with exception error:', error);
    process.exit(1);
  }
}

bootstrapSeeder();