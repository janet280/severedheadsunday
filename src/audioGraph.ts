type AudioGraph = {
  audioCtx: AudioContext;
  analyser: AnalyserNode;
};

const graphs = new WeakMap<HTMLAudioElement, AudioGraph>();

export function getOrCreateAudioGraph(audio: HTMLAudioElement): AudioGraph {
  const existing = graphs.get(audio);
  if (existing) return existing;

  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  const audioCtx = new AC();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 64;

  const graph = { audioCtx, analyser };
  graphs.set(audio, graph);
  return graph;
}

export async function resumeAudioGraph(
  audio: HTMLAudioElement,
): Promise<void> {
  const graph = graphs.get(audio);
  if (!graph) return;
  if (graph.audioCtx.state === "suspended") {
    await graph.audioCtx.resume();
  }
}
