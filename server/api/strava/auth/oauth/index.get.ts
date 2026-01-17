export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);

  const requestUrl = getRequestURL(event);
  const baseUrl = requestUrl.origin; // Use current origin (localhost or production)

  const url = new URL('https://www.strava.com/oauth/authorize');

  url.searchParams.set('client_id', config.stravaClientId);

  url.searchParams.set(
    'redirect_uri',
    `${baseUrl}/api/strava/auth/callback`,
  );

  url.searchParams.set('response_type', 'code');

  url.searchParams.set('approval_prompt', 'force');

  for (const scope of [
    'read',
    'read_all',
    'activity:read',
    'activity:read_all',
  ]) {
    url.searchParams.append('scope', scope);
  }

  setResponseHeader(event, 'Location', url.href);

  setResponseStatus(event, 307);
});
