import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private client: Redis | null = null;
  private readonly fallbackMemoryLocks = new Map<string, number>();

  constructor(private readonly config: ConfigService) {
    const host = this.config.getOrThrow<string>('REDIS_HOST');
    const port = Number(this.config.getOrThrow<string>('REDIS_PORT'));
    const password = this.config.getOrThrow<string>('REDIS_PASSWORD');

    try {

      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't hang if offline
      });

      this.client.on('error', () => {
        // Fallback to internal memory lock gracefully
        this.client = null;
      });
    } catch {
      this.client = null;
    }
  }

  /**
   * Acquire a distributed lock with TTL (in ms).
   */
  async acquireLock(key: string, ttlMs = 10000): Promise<boolean> {
    const lockKey = `lock:${key}`;
    if (this.client) {
      try {
        const result = await this.client.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch {
        // Fallback to memory
      }
    }

    const now = Date.now();
    const expiry = this.fallbackMemoryLocks.get(lockKey);
    if (expiry && expiry > now) {
      return false;
    }
    this.fallbackMemoryLocks.set(lockKey, now + ttlMs);
    return true;
  }

  /**
   * Release a distributed lock.
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    if (this.client) {
      try {
        await this.client.del(lockKey);
      } catch {
        // ignore
      }
    }
    this.fallbackMemoryLocks.delete(lockKey);
  }

  /**
   * Check or register idempotency key.
   * Returns true if newly stored, false if already processed.
   */
  async registerIdempotency(key: string, ttlSeconds = 86400): Promise<boolean> {
    const idemKey = `idempotency:${key}`;
    if (this.client) {
      try {
        const res = await this.client.set(idemKey, 'processed', 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch {
        // fallback
      }
    }

    const now = Date.now();
    const expiry = this.fallbackMemoryLocks.get(idemKey);
    if (expiry && expiry > now) {
      return false;
    }
    this.fallbackMemoryLocks.set(idemKey, now + ttlSeconds * 1000);
    return true;
  }
}

