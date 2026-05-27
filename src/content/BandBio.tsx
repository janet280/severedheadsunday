export function BandBio() {
  return (
    <div className="members-content">
      <video
        className="members-video"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label="Severed Head Sunday members video"
      >
        <source src="/members.mp4" type="video/mp4" />
        <source src="/members.mov" />
        Your browser does not support embedded video.
      </video>

      <div className="member-list">
        <section className="member-card">
          <h3>VICTOR IBARRA</h3>
          <p>He's been called many things, short is not one of them.</p>
        </section>

        <section className="member-card">
          <h3>GABE SANCHEZ</h3>
          <p>Gabe started as a small child with strings around the trees.</p>
        </section>

        <section className="member-card">
          <h3>Jante Jones</h3>
          <p>
            People are still confused on his name. He's the whitiest of the
            whiteness but people still think he is French.
          </p>
        </section>
      </div>
    </div>
  );
}
