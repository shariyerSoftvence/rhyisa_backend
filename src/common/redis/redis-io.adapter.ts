import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(): Promise<void> {
    try {
      const pubClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      });

      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        this.logger.error(`Redis PubClient Error: ${err.message}`);
      });

      subClient.on('error', (err) => {
        this.logger.error(`Redis SubClient Error: ${err.message}`);
      });

      await Promise.all([
        new Promise((resolve) => pubClient.once('ready', resolve)),
        new Promise((resolve) => subClient.once('ready', resolve)),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.IO Redis Adapter connected and initialized cleanly for Pub-Sub');
    } catch (err: any) {
      this.logger.error(`Failed to connect RedisIoAdapter: ${err.message}`);
    }
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
