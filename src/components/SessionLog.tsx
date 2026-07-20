import type { BandSession } from "../content/sessions";
import { SESSIONS } from "../content/sessions";

type Props = {
  onSelectSession?: (session: BandSession) => void;
  activeTrackSlug?: string | null;
};

export function SessionLog({ onSelectSession, activeTrackSlug }: Props) {
  return (
    <section className="session-log" aria-label="Band session log">
      <h2 className="session-log-title">SESSIONS</h2>
      <div className="session-log-scroll">
        {SESSIONS.map((session) => {
          const playable = Boolean(session.trackSlug && onSelectSession);
          const isActive =
            playable &&
            !!activeTrackSlug &&
            session.trackSlug === activeTrackSlug;
          const className = [
            "session-cell",
            playable ? "session-cell--playable" : "",
            isActive ? "session-cell--active" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const body = (
            <>
              <time className="session-date" dateTime={session.date}>
                {session.dateLabel}
              </time>
              <h3 className="session-material">{session.material}</h3>
              <p className="session-notes">{session.notes}</p>
            </>
          );

          if (playable) {
            return (
              <button
                key={session.id}
                type="button"
                className={className}
                onClick={() => onSelectSession?.(session)}
                aria-pressed={isActive}
                aria-label={`Play ${session.material}`}
              >
                {body}
              </button>
            );
          }

          return (
            <article key={session.id} className={className}>
              {body}
            </article>
          );
        })}
      </div>
    </section>
  );
}
