import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AudioVisualizer } from "../components/AudioVisualizer";
import { SessionLog } from "../components/SessionLog";
import { BandBio } from "../content/BandBio";
import { resumeAudioGraph } from "../audioGraph";
import {
  refreshWakeLockIfPlaying,
  releaseScreenWakeLock,
  requestScreenWakeLock,
  resumePlayback,
} from "../audioKeepAlive";
import {
  TRACKS,
  TRACK_SECTION_HEADING,
  mediaRequiresCrossOrigin,
  resolveAudioUrl,
} from "../tracks";

const GRAIN_TEXTURE =
  "https://www.transparenttextures.com/patterns/asfalt-dark.png";

export function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const resumeAfterHideRef = useRef(false);
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [vizReady, setVizReady] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const bgUrl =
    import.meta.env.VITE_BACKGROUND_IMAGE_URL?.trim() ||
    "";

  const playTrack = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      let next = index;
      if (next >= TRACKS.length) next = 0;
      if (next < 0) next = TRACKS.length - 1;
      setCurrentIndex(next);
      currentIndexRef.current = next;
      const url = resolveAudioUrl(TRACKS[next].file);
      audio.src = url;
      setLoadError(null);
      setVizReady(true);
      audio.load();
      void audio
        .play()
        .then(() => requestScreenWakeLock())
        .catch(() => {
          /* autoplay policies — user gesture via playlist works */
        });
    },
    [],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void resumePlayback(audio, resumeAfterHideRef.current);
      void refreshWakeLockIfPlaying(audio);
    };

    const onWindowFocus = () => {
      void resumePlayback(audio, resumeAfterHideRef.current);
      void refreshWakeLockIfPlaying(audio);
    };

    const onPageHide = () => {
      void releaseScreenWakeLock();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("pagehide", onPageHide);
      void releaseScreenWakeLock();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => playTrack(currentIndexRef.current + 1);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [playTrack]);

  const layoutClass = [
    "main-layout",
    membersOpen ? "main-layout--members-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        className="alley-bg"
        style={
          bgUrl
            ? { backgroundImage: `url('${bgUrl}')` }
            : {
                backgroundImage: `linear-gradient(145deg, #050505 0%, #1a0505 45%, #000 100%), url('${GRAIN_TEXTURE}')`,
              }
        }
      />

      <div className={layoutClass}>
        <div className="center-stage">
          <div className="header-container">
            <h1 className="site-title">SEVERED HEAD SUNDAY</h1>
          </div>

          <div className="stage-row">
            <div className="stage-board">
              <div className="viz-frame viz-frame--compact">
                <AudioVisualizer
                  audioRef={audioRef}
                  isPlayingContext={vizReady}
                />
              </div>
              <SessionLog />
            </div>

            <div className="track-sidebar">
              <button
                type="button"
                className={`nav-tab ${membersOpen ? "nav-tab--active" : ""}`}
                aria-expanded={membersOpen}
                aria-controls="members-panel"
                id="members-toggle"
                onClick={() => setMembersOpen((open) => !open)}
              >
                MEMBERS
              </button>

              <nav className="track-list" aria-label="Track playlist">
                {TRACKS.map((track, index) => {
                  const prev = TRACKS[index - 1];
                  const showSectionHeading =
                    index === 0 || track.section !== prev.section;
                  return (
                    <Fragment key={track.slug}>
                      {showSectionHeading ? (
                        <div
                          className={`track-section-heading ${track.section === "jams" ? "track-section-heading--jams" : ""}`}
                        >
                          {TRACK_SECTION_HEADING[track.section]}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className={`track ${index === currentIndex ? "active-track" : ""}`}
                        onClick={() => playTrack(index)}
                      >
                        {track.label}
                      </button>
                    </Fragment>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="player-container">
            {loadError ? (
              <p className="audio-load-error" role="alert">
                {loadError}
              </p>
            ) : null}
            <audio
              ref={audioRef}
              controls
              crossOrigin={
                mediaRequiresCrossOrigin() ? "anonymous" : undefined
              }
              preload="metadata"
              onError={() => {
                const file = TRACKS[currentIndexRef.current]?.file ?? "?";
                setLoadError(
                  `Could not load audio/${file}. Put that file in public/audio/ or fix VITE_MEDIA_BASE_URL.`,
                );
              }}
              onLoadedData={() => setLoadError(null)}
              onPlay={() => {
                resumeAfterHideRef.current = true;
                void resumeAudioGraph(audioRef.current!);
                void requestScreenWakeLock();
              }}
              onPause={() => {
                if (!document.hidden) {
                  resumeAfterHideRef.current = false;
                  void releaseScreenWakeLock();
                }
              }}
            />
          </div>
        </div>

        {membersOpen ? (
          <aside
            className="members-panel"
            id="members-panel"
            role="region"
            aria-labelledby="members-toggle"
          >
            <h2 className="members-panel-title">MEMBERS</h2>
            <BandBio />
          </aside>
        ) : null}
      </div>
    </>
  );
}
