import { queryCollection } from '@nuxt/content/nitro';

// Exposes blog posts to the sitemap with a `lastmod` date so search engines
// can detect when a post was updated and re-crawl it.
export default defineSitemapEventHandler(async (event) => {
  const posts = (await queryCollection(event, 'content')
    .select('path', 'date_modified', 'date_created')
    .all()) as Array<{
    path?: string;
    date_modified?: string;
    date_created?: string;
  }>;

  return posts
    .filter((post) => post.path?.startsWith('/blog/'))
    .map((post) => ({
      loc: post.path as string,
      lastmod: post.date_modified || post.date_created || undefined,
    }));
});
