import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService {
  constructor(
    @Inject("REDIS_CLIENT")
    private readonly redis: Redis,
  ) {}

  async set(
    key: string,
    value: unknown,
    ttl = 60,
  ) {
    await this.redis.set(
      key,
      JSON.stringify(value),
      "EX",
      ttl,
    );
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);

    if (!data) return null;

    return JSON.parse(data);
  }

  async del(key: string) {
    await this.redis.del(key);
  }

  getClient(): Redis {
    return this.redis;
  }
}