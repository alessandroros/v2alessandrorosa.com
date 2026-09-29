export type SiteLink = {
  label: string;
  to: string;
};

/**
 * Single source of truth for the site sections, shared by the header
 * navigation and the footer.
 *
 * Hash entries point at sections of the home page: there is no `/blog` index
 * route, only `blog/[...slug]`.
 */
export function useSiteLinks(): SiteLink[] {
  return [
    { label: 'Blog', to: '/#blog' },
    { label: 'Contact', to: '/#contact' },
  ];
}
