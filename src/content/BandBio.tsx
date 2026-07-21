export function BandBio() {
  return (
    <div className="members-content">
      <video
        className="members-video"
        src="/members.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label="Severed Head Sunday members video"
      />

      <div className="member-list">
        <section className="member-card">
          <h3>VICTOR IBARRA</h3>
          <p>Bass Guitar | Saxaphone | Vocals </p>
        </section>

        <section className="member-card">
          <h3>GABE SANCHEZ</h3>
          <p>Guitar | Vocals</p>
        </section>

        <section className="member-card">
          <h3>Jante Jones</h3>
          <p>Drums | Vocals</p>
        </section>
      </div>
    </div>
  );
}
