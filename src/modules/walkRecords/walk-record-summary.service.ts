type WalkSummaryInput = {
  distanceMeters: number;
  durationSeconds: number;
  rating?: number;
  likedNotes?: string;
  dislikedNotes?: string;
  likedFactor?: string;
  dislikedFactor?: string;
  pointCount?: number;
  isManual?: boolean;
};

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))}분`;
}

export function createWalkRecordSummary(input: WalkSummaryInput) {
  const mode = input.isManual ? "수동으로 기록한 산책" : "GPS 경로와 함께 기록된 산책";
  const routeQuality =
    !input.isManual && input.pointCount !== undefined
      ? ` 위치 포인트 ${input.pointCount}개가 저장됐어요.`
      : "";
  const review = input.rating ? ` 별점은 ${input.rating}점이에요.` : "";
  const liked = input.likedNotes ? ` 좋았던 점: ${input.likedNotes}` : "";
  const disliked = input.dislikedNotes ? ` 아쉬웠던 점: ${input.dislikedNotes}` : "";
  const likedFactor = input.likedFactor ? ` Good factor: ${input.likedFactor}.` : "";
  const dislikedFactor = input.dislikedFactor ? ` Needs work: ${input.dislikedFactor}.` : "";

  return `${mode}이에요. ${formatMinutes(input.durationSeconds)} 동안 ${formatDistance(
    input.distanceMeters
  )}를 걸었어요.${routeQuality}${review}${liked}${disliked}${likedFactor}${dislikedFactor}`.trim();
}
