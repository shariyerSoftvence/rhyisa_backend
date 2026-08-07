import Redis from 'ioredis';

export const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: async () => {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });

    redis.on('connect', () => {
      console.log('Redis Connected');
    });

    redis.on('error', (err) => {
      console.log('Redis Error', err);
    });

    return redis;
  },
};
