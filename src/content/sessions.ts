import type { VizMode } from "../components/AudioVisualizer";

export type BandSession = {
  id: string;
  date: string;
  /** Display date, e.g. "JUL 13, 2026" */
  dateLabel: string;
  /** New material worked on that session */
  material: string;
  notes: string;
  /** Playlist track slug played when the session cell is tapped */
  trackSlug: string;
  /** Fixed visualizer for this session; random if omitted */
  vizMode?: VizMode;
};

/** Newest first — audio blog session log. Must match TRACKS with section "sessions". */
export const SESSIONS: BandSession[] = [
  {
    id: "2026-07-06",
    date: "2026-07-06",
    dateLabel: "JUL 6, 2026",
    material: "MENOEVIL",
    notes:
      "Swollen pantickles and sweet prune nector.  raw and wriggly as it were. seeps and festers.",
    trackSlug: "menoevil",
    vizMode: "fireflies",
  },
  {
    id: "2026-06-22",
    date: "2026-06-22",
    dateLabel: "JUN 22, 2026",
    material: "FUNKEYMOTHER (jam → arrangement)",
    notes:
      "You gotta get up to get down but you also gotta get down to get up.",
    trackSlug: "funkeymother",
    vizMode: "wave",
  },
  {
    id: "2026-06-15",
    date: "2026-06-15",
    dateLabel: "JUN 15, 2026",
    material: "BEACH DAY (bass DI + reamp)",
    notes:
      "Batten the hatches, clear all the morings, close the record shop and all the shops in the mall",
    trackSlug: "beach-day",
  },
  {
    id: "2026-06-08",
    date: "2026-06-08",
    dateLabel: "JUN 8, 2026",
    material: "SMOTHER (drum replace)",
    notes:
      "Everything is fine. stay where you are. A hero's welcome, a suitor and bellweather.",
    trackSlug: "smother",
  },
  {
    id: "2026-06-01",
    date: "2026-06-01",
    dateLabel: "JUN 1, 2026",
    material: "BABADOOSHKA",
    notes:
      "Charming and well liked, they made those with no ears screech and hallow.  incarnation, desecration. blend and piecemeal.",
    trackSlug: "babadooshka",
  },
];
