import { Redis } from '@upstash/redis';
import { REDIS_CACHE_DURATION, REQUEST_CACHE_DURATION } from '~~/caching';
import type { ContributionCalendar, ContributionDay } from '~~/github';

type GithubContributionsResponse = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              contributionCount: number;
              date: string;
              weekday: number;
            }>;
          }>;
        };
      };
    } | null;
  };
};

const EMPTY: ContributionCalendar = { total: 0, max: 0, weeks: [] };

/**
 * The contribution calendar behind the heatmap on the home page.
 *
 * `contributionsCollection` defaults to the trailing year. Contributions to
 * private repositories are counted only when the token owns the queried
 * account and the profile allows it, which is why the total here can be
 * higher than what an anonymous visitor sees on github.com.
 */
export default defineCachedEventHandler(
  async (event): Promise<ContributionCalendar> => {
    const config = useRuntimeConfig(event);

    const kvStore = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });

    const cacheKey = `github:contributions:${config.githubUsername}`;

    const cached = await kvStore
      .get<string>(cacheKey)
      .catch(() => undefined);

    if (cached) {
      setResponseHeader(event, 'content-type', 'application/json');
      setResponseHeader(event, 'x-redis-cache', 'hit');

      return cached as unknown as ContributionCalendar;
    }

    const response = await $fetch<GithubContributionsResponse>(
      'https://api.github.com/graphql',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.githubApiKey}`,
          'user-agent': 'AlessandroRosa +https://alessandrorosa.com',
        },
        body: {
          query: `
            query GET_CONTRIBUTIONS {
              user(login: "${config.githubUsername}") {
                contributionsCollection {
                  contributionCalendar {
                    totalContributions
                    weeks {
                      contributionDays {
                        contributionCount
                        date
                        weekday
                      }
                    }
                  }
                }
              }
            }
          `,
        },
      },
    ).catch(() => undefined);

    const calendar =
      response?.data?.user?.contributionsCollection?.contributionCalendar;

    if (!calendar?.weeks?.length) {
      setResponseHeader(event, 'x-redis-cache', 'miss');

      return EMPTY;
    }

    let max = 0;

    const weeks: Array<Array<ContributionDay>> = calendar.weeks.map((week) =>
      (week?.contributionDays ?? []).map((day) => {
        const count = day?.contributionCount ?? 0;

        if (count > max) {
          max = count;
        }

        return { date: day.date, count, weekday: day.weekday };
      }),
    );

    const result: ContributionCalendar = {
      total: calendar.totalContributions ?? 0,
      max,
      weeks,
    };

    kvStore
      .setex(cacheKey, REDIS_CACHE_DURATION, JSON.stringify(result))
      .catch(() => undefined);

    setResponseHeader(event, 'x-redis-cache', 'miss');

    return result;
  },
  {
    maxAge: REQUEST_CACHE_DURATION,
  },
);
