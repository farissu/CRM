import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// BullMQ requires maxRetriesPerRequest: null on the connection it's handed.
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});
