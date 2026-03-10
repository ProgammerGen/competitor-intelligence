export function computeRecencyPenalty(eventDate: Date): number {
  const daysDiff =
    (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 7) return 0;
  if (daysDiff <= 30) return -10;
  if (daysDiff <= 60) return -20;
  if (daysDiff <= 90) return -30;
  return -100; // sentinel: suppress entirely
}

export function computeFinalScore(
  signalStrength: number,
  recencyPenalty: number,
  sentimentScore: number // -1.0 to +1.0
): number {
  if (recencyPenalty === -100) return 0;
  const recencyComponent = 100 + recencyPenalty; // 70–100
  const sentimentNormalized = ((sentimentScore + 1) / 2) * 100; // 0–100
  return Math.round(
    signalStrength * 0.5 +
      recencyComponent * 0.3 +
      sentimentNormalized * 0.2
  );
}
