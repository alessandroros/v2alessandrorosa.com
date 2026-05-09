import { Redis } from '@upstash/redis';

/**
 * Health check endpoint for Redis connection.
 * This endpoint should be called at least once per day to prevent
 * Upstash free tier from marking the database as inactive.
 *
 * Upstash deletes inactive databases after 28 days of no activity.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  try {
    const kvStore = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });

    // Simple ping operation to keep the database active
    const pingKey = 'health:last_check';
    const timestamp = new Date().toISOString();

    // Set a key with 7 days expiration
    await kvStore.setex(pingKey, 604800, timestamp);

    // Verify we can read it back
    const lastCheck = await kvStore.get<string>(pingKey);

    return {
      status: 'healthy',
      redis: 'connected',
      timestamp,
      lastCheck,
      message: 'Redis database is active and responding'
    };
  } catch (error) {
    console.error('Redis health check failed:', error);

    setResponseStatus(event, 503);
    return {
      status: 'unhealthy',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to connect to Redis database'
    };
  }
});

