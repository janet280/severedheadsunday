export type TrackSection = "studio" | "jams";

export type Track = {
  slug: string;
  label: string;
  file: string;
  section: TrackSection;
};

export const TRACK_SECTION_HEADING: Record<TrackSection, string> = {
  studio: "STUDIO",
  jams: "JAMS",
};

export const TRACKS: Track[] = [
  {
    slug: "moonrocks",
    label: "MOONROCKS",
    file: "moonrocks.mp3",
    section: "studio",
  },
  {
    slug: "lederhosen",
    label: "LEDERHOSEN",
    file: "lederhosen.mp3",
    section: "studio",
  },
  {
    slug: "ginger",
    label: "GINGER",
    file: "ginger.mp3",
    section: "studio",
  },
  {
    slug: "severed-head-sunday",
    label: "SEVERED HEAD SUNDAY",
    file: "severed_head_sunday.mp3",
    section: "studio",
  },
  {
    slug: "menoevil",
    label: "MeNoEVIL",
    file: "menoevil.mp3",
    section: "jams",
  },
  {
    slug: "babadooshka",
    label: "BABADOOSHKA",
    file: "babadooshka.mp3",
    section: "jams",
  },
  {
    slug: "beach-day",
    label: "BEACH DAY",
    file: "beachday.mp3",
    section: "jams",
  },
  {
    slug: "smother",
    label: "SMOTHER",
    file: "smother.mp3",
    section: "jams",
  },
  {
    slug: "funkeymother",
    label: "FUNKEYMOTHER",
    file: "funkeymother.mp3",
    section: "jams",
  },
];

export function resolveAudioUrl(file: string): string {
  const base = import.meta.env.VITE_MEDIA_BASE_URL?.replace(/\/$/, "") ?? "";
  const path = `audio/${file}`;
  return base ? `${base}/${path}` : `/${path}`;
}

/** Use crossOrigin="anonymous" only when media is loaded from another origin (S3/CDN); same-origin + anonymous can break without CORS headers on some stacks. */
export function mediaRequiresCrossOrigin(): boolean {
  const raw = import.meta.env.VITE_MEDIA_BASE_URL?.trim();
  if (!raw) return false;
  try {
    const u = new URL(raw, window.location.href);
    return u.origin !== window.location.origin;
  } catch {
    return true;
  }
}
