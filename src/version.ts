/** Site version shown in the UI. Bump minor for small releases, major for breaking ones. */
export const SITE_VERSION = {
  major: 1,
  minor: 1,
} as const;

export const SITE_VERSION_LABEL = `v${SITE_VERSION.major}.${SITE_VERSION.minor}`;
