export type BandSession = {
  id: string;
  date: string;
  /** Display date, e.g. "JUL 13, 2026" */
  dateLabel: string;
  /** New material worked on that session */
  material: string;
  notes: string;
};

/** Newest first — audio blog session log. */
export const SESSIONS: BandSession[] = [
  {
    id: "2026-07-13",
    date: "2026-07-13",
    dateLabel: "JUL 18, 2026",
    material: "NEWSONG (bridge rewrite)",
    notes:
      "Bad jokes, guitar and bass going crazy and chartutery board",
  },
  {
    id: "2026-07-06",
    date: "2026-07-06",
    dateLabel: "JUL 6, 2026",
    material: "MENOEVIL",
    notes:
      "Guitar string snapped mid-take; ",
  },
  {
    id: "2026-06-29",
    date: "2026-06-29",
    dateLabel: "JUN 29, 2026",
    material: "GINGER (vocal scratch)",
    notes:
      "Scratch vocals into a broken SM57 and a blanket fort. Room tone includes a distant lawnmower that somehow works. Coffee went cold; chips did not survive.",
  },
  {
    id: "2026-06-22",
    date: "2026-06-22",
    dateLabel: "JUN 22, 2026",
    material: "FUNKEYMOTHER (jam → arrangement)",
    notes:
      "Started as a joke riff, ended as a real song against everyone's better judgment. Kick pedal squeaked the whole night. Pizza arrived late and slightly wrong.",
  },
  {
    id: "2026-06-15",
    date: "2026-06-15",
    dateLabel: "JUN 15, 2026",
    material: "BEACH DAY (bass DI + reamp)",
    notes:
      "Bass DI was clean; reamp through a dying amp was not. We argued about whether the buzz was 'character.' Snack democracy elected spicy peanuts.",
  },
  {
    id: "2026-06-08",
    date: "2026-06-08",
    dateLabel: "JUN 8, 2026",
    material: "SMOTHER (drum replace)",
    notes:
      "Replaced three fills and accidentally improved the song. Metronome was set wrong for one full take. Water bottles everywhere; dignity nowhere.",
  },
];
