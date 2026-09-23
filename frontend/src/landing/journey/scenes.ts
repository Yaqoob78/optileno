import type { StageScene } from './DepthStage';

/* The story's scenes, in order. Source art lives in design/story-source;
   tools/story-assets turns it into what's here (see docs/LANDING-ASSETS.md):
     <id>.webp        2048 px, the illustration
     <id>.sm.webp     1280 px, for phones
     <id>.depth.webp  its depth map (white = near)
     <id>.mp4         optional seamless loop, desktop only */

export interface JourneyScene extends StageScene {
  /** Where the copy sits, so the scrim darkens/lightens that side. */
  side: 'left' | 'right' | 'center';
  /** Light scenes get dark text on a paper scrim; dark scenes the reverse. */
  tone: 'light' | 'dark';
}

interface Options {
  focus: [number, number];
  mobileFocus?: [number, number];
  side?: JourneyScene['side'];
  tone: JourneyScene['tone'];
  grade?: [number, number, number];
  video?: boolean;
}

const s = (id: string, o: Options): JourneyScene => ({
  id,
  image: `/story/${id}.webp`,
  imageSmall: `/story/${id}.sm.webp`,
  depth: `/story/${id}.depth.webp`,
  video: o.video ? `/story/${id}.mp4` : undefined,
  focus: o.focus,
  mobileFocus: o.mobileFocus,
  side: o.side ?? 'left',
  tone: o.tone,
  grade: o.grade,
});

export const SCENES: JourneyScene[] = [
  // Dawn: Kai and Pixel on the cliff over the floating islands
  s('hero', { focus: [0.66, 0.5], mobileFocus: [0.7, 0.38], tone: 'light', grade: [1.0, 0.04, 1.02], video: true }),
  // Night: the desk, the rain, the mugs
  s('problem', { focus: [0.62, 0.5], mobileFocus: [0.6, 0.45], tone: 'dark', grade: [0.92, 0.08, 0.98] }),
  // Morning: the climb up the floating stairs
  s('solution', { focus: [0.6, 0.45], mobileFocus: [0.63, 0.35], tone: 'light', grade: [1.0, 0.04, 1.0] }),
  // Golden hour: the studio above the city
  s('action', { focus: [0.72, 0.5], mobileFocus: [0.74, 0.5], tone: 'light', grade: [1.0, 0.02, 1.0] }),
  // Sunset: two doors
  s('choice', { focus: [0.66, 0.5], mobileFocus: [0.72, 0.5], tone: 'dark', grade: [0.95, 0.05, 1.02] }),
  // Late morning: Maya on her balcony
  s('client', { focus: [0.72, 0.45], mobileFocus: [0.84, 0.32], tone: 'light', grade: [1.0, 0.02, 1.0] }),
];

// Blue hour: Kai and Pixel watching the lanterns rise
export const FINALE: JourneyScene = s('finale', { focus: [0.62, 0.55], mobileFocus: [0.72, 0.45], side: 'center', tone: 'dark', grade: [0.9, 0.06, 1.0], video: true });
