// Reel 112 — one master timing contract, shared by the reel definition and
// the scene engine. The choreography was authored on a 26s draft; the runtime
// law requires >30s, so it is performed on a 42s master timeline. Every scene
// divides its local clock by its factor, and every word cue is multiplied by
// the same factor — hence picture and sound stay locked to one timeline.
export const S112 = {
  draft: [3.5, 5, 6.5, 6.5, 4.5],
  durations: [6, 9, 11, 11, 5],
  factors: [6 / 3.5, 9 / 5, 11 / 6.5, 11 / 6.5, 5 / 4.5],
} as const
