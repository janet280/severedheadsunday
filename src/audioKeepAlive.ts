import { resumeAudioGraph } from "./audioGraph";

type WakeLockSentinel = {
  release: () => Promise<void>;
};

let wakeLock: WakeLockSentinel | null = null;

/** Resume Web Audio + HTMLMediaElement after tab focus / visibility return. */
export async function resumePlayback(
  audio: HTMLAudioElement,
  shouldPlay: boolean,
): Promise<void> {
  await resumeAudioGraph(audio);
  if (shouldPlay && audio.paused) {
    await audio.play();
  }
}

/** Keep screen awake while listening (Chrome/Edge/Android; requires user gesture to start). */
export async function requestScreenWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator)) return;
  try {
    if (wakeLock) await wakeLock.release();
    wakeLock = await (
      navigator as Navigator & {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock.request("screen");
  } catch {
    /* denied or unsupported */
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    /* ignore */
  } finally {
    wakeLock = null;
  }
}

/** Re-acquire wake lock when tab becomes visible again (browser releases it on hide). */
export async function refreshWakeLockIfPlaying(
  audio: HTMLAudioElement,
): Promise<void> {
  if (!audio.paused) {
    await requestScreenWakeLock();
  }
}
