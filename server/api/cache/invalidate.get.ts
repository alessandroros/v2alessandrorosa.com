import { Redis } from '@upstash/redis';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  const kvStore = new Redis({
    url: config.upstashRedisRestUrl,
    token: config.upstashRedisRestToken,
  });

  // Get query parameter to clear specific cache or all
  const query = getQuery(event);
  const target = query.target as string | undefined;

  const cacheKeys = {
    github: [
      'github:starred',
      'github:repositories',
      `github:contributions:${config.githubUsername}`,
    ],
    strava: ['strava:activities'],
    wakatime: ['wakatime:stats'],
    npm: [`npm:packages:${config.npmUsername}`],
    leetcode: [`leetcode:stats:${config.leetcodeUsername}`],
  };

  let keysToDelete: string[] = [];

  if (target && target in cacheKeys) {
    // Clear specific cache
    keysToDelete = cacheKeys[target as keyof typeof cacheKeys];
  } else if (target === 'all') {
    // Clear all caches
    keysToDelete = Object.values(cacheKeys).flat();
  } else {
    return {
      error: 'Invalid target. Use: github, strava, wakatime, npm, leetcode, or all',
      available: Object.keys(cacheKeys).concat(['all']),
    };
  }

  // Delete the cache keys
  const results = await Promise.allSettled(
    keysToDelete.map((key) => kvStore.del(key)),
  );

  const deleted = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return {
    success: true,
    message: `Cache invalidation completed for: ${target}`,
    deleted,
    failed,
    keys: keysToDelete,
  };
});

