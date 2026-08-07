import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      app: 'Rhyisa Backend apis',
      status: 'up',
      version: process.env.npm_package_version || '1.0.0',
      uptime: `${process.uptime().toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      author: {
        name: 'Shariyer Shazan',
        contact: 'shariyershazan1@gmail.com',
        links: {
          github: 'https://github.com/shariyerShazan',
          portfolio: 'https://shariyer-shazan.netlify.app',
        },
      },
    };
  }
}
