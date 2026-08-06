export type Language = {
  color: string;
  name: string;
};

export type Project = {
  description: string;
  homepageUrl: string;
  languages: Array<Language>;
  name: string;
  url: string;
  stargazerCount: number;
};

export type ContributionDay = {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  count: number;
  /** 0 = Sunday, as returned by GitHub. Used to align the first column. */
  weekday: number;
};

export type ContributionCalendar = {
  total: number;
  /** Busiest single day, used to scale the colour ramp. */
  max: number;
  /** One entry per calendar week, oldest first. Edge weeks may be partial. */
  weeks: Array<Array<ContributionDay>>;
};
