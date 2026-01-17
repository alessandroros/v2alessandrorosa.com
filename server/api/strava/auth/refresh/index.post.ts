import { Redis } from '@upstash/redis/cloudflare';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  // Return early if Strava is not configured
  if (!config.stravaClientId || !config.stravaClientSecret) {
    return {
      access_token: null,
      error: 'Strava not configured',
    };
  }

  const kvStore = new Redis({
    url: config.upstashRedisRestUrl,
    token: config.upstashRedisRestToken,
  });

  const refreshToken = await kvStore.get<string>('strava:refresh_token');
  if (!refreshToken) {
    return {
      access_token: null,
      error: 'Refresh token not found',
    };
  }

  const url = new URL('https://www.strava.com/oauth/token');

  url.searchParams.set('client_id', config.stravaClientId);
  url.searchParams.set('client_secret', config.stravaClientSecret);
  url.searchParams.set('grant_type', 'refresh_token');
  url.searchParams.set('refresh_token', refreshToken);

  const response = await $fetch<{
    access_token: string;
    refresh_token: string;
  }>(url.href, { method: 'POST' });

  await kvStore.mset({
    'strava:access_token': response.access_token,
    'strava:refresh_token': response.refresh_token,
  });

  return {
    access_token: response.access_token,
  };
});
