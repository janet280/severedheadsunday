import { SESSIONS } from "./content/sessions";
import type { VizMode } from "./components/AudioVisualizer";

export type TrackSection = "studio" | "sessions";

export type Track = {
  slug: string;
  label: string;
  file: string;
  section: TrackSection;
  /** Fixed visualizer when this track is played; omit for default/random session behavior */
  vizMode?: VizMode;
};

export const TRACK_SECTION_HEADING: Record<TrackSection, string> = {
  studio: "STUDIO",
  sessions: "SESSIONS",
};

/** Studio cuts — may also appear in the session log. */
const STUDIO_TRACKS: Track[] = [
  {
    slug: "severed-head-sunday",
    label: "SEVERED HEAD SUNDAY",
    file: "severed_head_sunday.mp3",
    section: "studio",
    vizMode: "spikes",
  },
  {
    slug: "moonrocks",
    label: "MOONROCKS",
    file: "moonrocks.mp3",
    section: "studio",
    vizMode: "rings",
  },
  {
    slug: "lederhosen",
    label: "LEDERHOSEN",
    file: "lederhosen.mp3",
    section: "studio",
    vizMode: "rush",
  },
  {
    slug: "ginger",
    label: "GINGER",
    file: "ginger.mp3",
    section: "studio",
    vizMode: "wave",
  },
];

/** File names for session tracks (slug → mp3). */
const SESSION_FILES: Record<string, string> = {
  menoevil: "menoevil.mp3",
  funkeymother: "funkeymother.mp3",
  "beach-day": "beachday.mp3",
  smother: "smother.mp3",
  babadooshka: "babadooshka.mp3",
};

/** Display labels for session tracks (slug → playlist label). */
const SESSION_LABELS: Record<string, string> = {
  menoevil: "MeNoEVIL",
  funkeymother: "FUNKEYMOTHER",
  "beach-day": "BEACH DAY",
  smother: "SMOTHER",
  babadooshka: "BABADOOSHKA",
};

const STUDIO_SLUGS = new Set(STUDIO_TRACKS.map((t) => t.slug));

/** Built from SESSIONS, skipping tracks already listed under STUDIO. */
const SESSION_TRACKS: Track[] = SESSIONS.filter(
  (session) => !STUDIO_SLUGS.has(session.trackSlug),
).map((session) => {
  const file = SESSION_FILES[session.trackSlug];
  const label = SESSION_LABELS[session.trackSlug];
  if (!file || !label) {
    throw new Error(
      `Session "${session.id}" trackSlug "${session.trackSlug}" is missing from SESSION_FILES/SESSION_LABELS`,
    );
  }
  return {
    slug: session.trackSlug,
    label,
    file,
    section: "sessions" as const,
    vizMode: session.vizMode,
  };
});

export const TRACKS: Track[] = [...STUDIO_TRACKS, ...SESSION_TRACKS];

export function findTrackIndexBySlug(slug: string): number {
  return TRACKS.findIndex((t) => t.slug === slug);
}

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
