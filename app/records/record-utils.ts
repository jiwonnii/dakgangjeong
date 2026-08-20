export type LineString = { type: "LineString"; coordinates: Array<[number, number]> };

export type WalkRecord = {
  id: string;
  userId: string;
  guardianName?: string | null;
  startedAt: string;
  endedAt: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  rating: number | null;
  likedNotes: string | null;
  dislikedNotes: string | null;
  routeGeoJson: LineString | null;
  recommendedCourse: null | {
    rank: number;
    direction?: string;
    distanceMeters: number;
    durationMinutes: number;
    path: LineString;
  };
};

export type WalkRecordListResponse = { records: WalkRecord[] };
export type StreakResponse = {
  streakDays: number;
  throughDate: string;
  walkedToday: boolean;
  needsWalkToday: boolean;
  dogId: string | null;
};
export type CalendarDay = { key: string; date: Date; isCurrentMonth: boolean };

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${minutes}분`;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function kstDateKeyFromIso(iso: string) {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function monthBoundsIso(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const from = new Date(Date.UTC(year, month, 1, -9, 0, 0, 0));
  const to = new Date(Date.UTC(year, month + 1, 1, -9, 0, 0, 0) - 1);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export function buildCalendarDays(monthDate: Date): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { key: toDateKey(date), date, isCurrentMonth: date.getMonth() === month };
  });
}

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

export function localDateTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function guardianLabel(userId: string) {
  return `보호자 ${userId.slice(0, 8)}`;
}
