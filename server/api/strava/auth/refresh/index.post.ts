import { Redis } from '@upstash/redis';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  // Return early if Strava is not configured
  if (!config.stravaClientId || !config.stravaClientSecret) {
    console.error('Strava credentials not found in runtime config');
    return {
      access_token: null,
      error: 'Strava not configured',
    };
  }

  const kvStore = new Redis({
    url: config.upstashRedisRestUrl,
    token: config.upstashRedisRestToken,
  });

  let refreshToken = await kvStore
    .get<string>('strava:refresh_token')
    .catch((err) => {
      console.error('Failed to get refresh token from Redis:', err);
      return undefined;
    });

  if (!refreshToken && config.stravaRefreshToken) {
    console.info('Using fallback refresh token from environment variables');
    refreshToken = config.stravaRefreshToken;
  }

  if (!refreshToken) {
    console.error('No refresh token available (neither in Redis nor environment)');
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

  console.info('Refreshing Strava access token...');

  // Strava answers 403 when the rate limit is exhausted and 400 once a refresh
  // token has been rotated away. Neither should take the page down with it, so
  // the failure is reported through the same shape as "not configured".
  const response = await $fetch<{
    access_token: string;
    refresh_token: string;
  }>(url.href, { method: 'POST' }).catch((err) => {
    console.error('Failed to refresh Strava token via API:', err);

    return undefined;
  });

  if (!response?.access_token) {
    return {
      access_token: null,
      error: 'Failed to refresh Strava token',
    };
  }

  console.info('Successfully refreshed Strava token, updating Redis...');
  await kvStore
    .mset({
      'strava:access_token': response.access_token,
      'strava:refresh_token': response.refresh_token,
    })
    .catch((err) => {
      console.error('Failed to update refreshed tokens in Redis:', err);
    });

  return {
    access_token: response.access_token,
  };
});
