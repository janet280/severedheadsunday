import { SESSIONS } from "../content/sessions";

export function SessionLog() {
  return (
    <section className="session-log" aria-label="Band session log">
      <h2 className="session-log-title">SESSIONS</h2>
      <div className="session-log-scroll">
        {SESSIONS.map((session) => (
          <article key={session.id} className="session-cell">
            <time className="session-date" dateTime={session.date}>
              {session.dateLabel}
            </time>
            <h3 className="session-material">{session.material}</h3>
            <p className="session-notes">{session.notes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
