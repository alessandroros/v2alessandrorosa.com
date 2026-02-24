import { Redis } from '@upstash/redis';
import { REDIS_CACHE_DURATION, REQUEST_CACHE_DURATION } from '~~/caching';
import type { Project } from '~~/github';

type GithubContributedToResponse = {
  data: {
    user: {
      repositoriesContributedTo: {
        nodes: Array<{
          description: string;
          homepageUrl: string;
          languages: { nodes: Array<{ color: string; name: string }> };
          name: string;
          nameWithOwner: string;
          stargazerCount: number;
          url: string;
        }>;
        pageInfo: {
          endCursor?: string | null;
          hasNextPage: boolean;
        };
      };
    };
  };
};

// Removed hardcoded contributions - now showing only your actual GitHub contributions

export default defineCachedEventHandler(
  async (event): Promise<Project[]> => {
    const config = useRuntimeConfig(event);

    const kvStore = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });

    const cacheKey = `github:contributions:${config.githubUsername}`;

    const cached = await kvStore.get<string>(cacheKey).catch(() => undefined);

    if (cached) {
      setResponseHeader(event, 'content-type', 'application/json');
      setResponseHeader(event, 'x-redis-cache', 'hit');

      return cached as unknown as Project[];
    }

    const projects: Project[] = [];

    let cursor: string | null = null;

    const seenProjects = new Set<string>();

    do {
      const response: GithubContributedToResponse =
        await $fetch<GithubContributedToResponse>(
          'https://api.github.com/graphql',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${config.githubApiKey}`,
              'user-agent': 'MadsHougesen +http://mhouge.dk',
            },
            body: {
              query: `{
                user(login: "${config.githubUsername}") {
                  repositoriesContributedTo(
                    privacy: PUBLIC
                    first: 100
                    orderBy: {field: STARGAZERS, direction: DESC}
                    contributionTypes: [COMMIT]
                    includeUserRepositories: false
                  ) {
                    nodes {
                      ... on Repository {
                        name
                        nameWithOwner
                        description
                        homepageUrl
                        stargazerCount
                        url
                        languages(first: 3, orderBy: {field: SIZE, direction: DESC}) {
                          nodes {
                            color
                            name
                          }
                        }
                      }
                    }
                    pageInfo {
                      endCursor
                      hasNextPage
                    }
                  }
                }
              }`,
            },
          },
        );

      const repos = response?.data?.user?.repositoriesContributedTo?.nodes;

      if (Array.isArray(repos) && repos?.length) {
        for (const repo of repos) {
          const name = (repo?.nameWithOwner || repo?.name)?.toLowerCase();

          if (name && !seenProjects.has(name)) {
            projects.push({
              ...repo,
              name,
              languages: repo?.languages?.nodes ?? [],
              stargazerCount: repo?.stargazerCount ?? 0,
            });

            seenProjects.add(name);
          }
        }
      }

      if (
        !response?.data?.user?.repositoriesContributedTo?.pageInfo?.hasNextPage
      ) {
        break;
      }

      cursor =
        response?.data?.user?.repositoriesContributedTo?.pageInfo?.endCursor ||
        null;
    } while (cursor);

    // Sort by star count (highest first)
    projects.sort((a, b) => {
      if (a?.stargazerCount === b?.stargazerCount) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }

      return (b?.stargazerCount ?? 0) - (a?.stargazerCount ?? 0);
    });

    if (projects?.length) {
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
