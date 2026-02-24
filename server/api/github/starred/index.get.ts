import { Redis } from '@upstash/redis';
import { REDIS_CACHE_DURATION, REQUEST_CACHE_DURATION } from '~~/caching';
import type { Project } from '~~/github';

type GithubStarredResponse = {
  data: {
    user: {
      starredRepositories: {
        nodes: Array<{
          description: string | null;
          homepageUrl: string | null;
          languages: { nodes: Array<{ color: string; name: string }> };
          name: string;
          nameWithOwner: string;
          url: string | null;
          stargazerCount: number;
          isFork: boolean;
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    };
  };
};

export default defineCachedEventHandler(
  async (event): Promise<Project[]> => {
    const config = useRuntimeConfig(event);

    const kvStore = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });

    const cacheKey = `github:starred`;

    const cached = await kvStore.get<string>(cacheKey).catch(() => undefined);

    if (cached) {
      setResponseHeader(event, 'content-type', 'application/json');
      setResponseHeader(event, 'x-redis-cache', 'hit');

      return cached as unknown as Project[];
    }

    const response = await $fetch<GithubStarredResponse>(
      'https://api.github.com/graphql',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.githubApiKey}`,
          'user-agent': 'MadsHougesen +http://mhouge.dk',
        },
        body: {
          query: `
            query GET_STARRED {
              user(login: "${config.githubUsername}") {
                starredRepositories(
                  first: 6
                  orderBy: { field: STARRED_AT, direction: DESC }
                ) {
                  nodes {
                    name
                    nameWithOwner
                    description
                    homepageUrl
                    url
                    stargazerCount
                    isFork
                    languages(
                      first: 3
                      orderBy: { field: SIZE, direction: DESC }
                    ) {
                      nodes {
                        color
                        name
                      }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          `,
        },
      },
    );

    const projects = (
      response?.data?.user?.starredRepositories?.nodes ?? []
    ).map((p) => ({
      ...p,
      name: p?.nameWithOwner || p?.name,
      languages: p?.languages?.nodes ?? [],
      description: p?.description ?? '',
      homepageUrl: p?.homepageUrl ?? '',
      url: p?.url ?? '',
      stargazerCount: p?.stargazerCount ?? 0,
    }));

    if (projects.length) {
      kvStore
        .setex(cacheKey, REDIS_CACHE_DURATION, JSON.stringify(projects))
        .catch(() => undefined);
    }

    setResponseHeader(event, 'x-redis-cache', 'miss');

    return projects;
  },
  {
    maxAge: REQUEST_CACHE_DURATION,
  },
);

