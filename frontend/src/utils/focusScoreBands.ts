// frontend/src/utils/focusScoreBands.ts
// Fallback focus-score band labels, used only when a payload arrives without
// server-provided labels (the API normally sends {color, label} per cell).
//
// ⚠ Single source of truth is the backend:
//   backend/services/focus_score_service.py :: _get_color_for_score
// If thresholds change there, update this table to match.

export interface FocusScoreBand {
  max: number; // inclusive upper bound
  label: string;
  color: string;
}

export const FOCUS_SCORE_BANDS: FocusScoreBand[] = [
  { max: 10, label: 'Very Low', color: '#fee2e2' },
  { max: 20, label: 'Low', color: '#fecaca' },
  { max: 39, label: 'Below Average', color: '#fde68a' },
  { max: 70, label: 'Good', color: '#3b82f6' },
  { max: 90, label: 'Great', color: '#16a34a' },
  { max: Infinity, label: 'Excellent', color: '#15803d' },
];

export const getFocusScoreLabel = (score: number | null | undefined): string => {
  if (score == null) return 'Inactive';
  const band = FOCUS_SCORE_BANDS.find((b) => score <= b.max);
  return band ? band.label : 'Inactive';
};
