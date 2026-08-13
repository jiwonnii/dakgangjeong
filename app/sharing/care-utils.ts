import type { CareTask, CareTaskType } from "../lib/types";

export type SharingCareKind = Extract<CareTaskType, "feed" | "medicine" | "walk">;

export type RoutineDraft = {
  count: number;
  times: string[];
};

export const SHARING_CARE_KINDS: SharingCareKind[] = ["feed", "medicine", "walk"];

export const CARE_LABELS: Record<SharingCareKind, string> = {
  feed: "밥",
  medicine: "약",
  walk: "산책"
};

export const CARE_TITLES: Record<SharingCareKind, string> = {
  feed: "밥",
  medicine: "약",
  walk: "산책"
};

const DEFAULT_TIMES: Record<SharingCareKind, string[]> = {
  feed: ["08:00", "13:00", "19:00"],
  medicine: ["09:00", "13:00", "21:00"],
  walk: ["08:30", "13:30", "19:30"]
};

export function buildTimes(kind: SharingCareKind, count: number, current: string[] = []) {
  return Array.from({ length: count }, (_, index) => current[index] ?? DEFAULT_TIMES[kind][index] ?? "09:00");
}

export function defaultDrafts(): Record<SharingCareKind, RoutineDraft> {
  return {
    feed: { count: 0, times: [] },
    medicine: { count: 0, times: [] },
    walk: { count: 0, times: [] }
  };
}

export function sortTasks(tasks: CareTask[]) {
  return [...tasks].sort((a, b) => {
    const left = a.scheduledAt ?? "";
    const right = b.scheduledAt ?? "";
    return left.localeCompare(right);
  });
}

export function formatKstTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

export function formatKstDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

export function guardianLabel(userId: string | null) {
  if (!userId) {
    return "";
  }

  return `보호자 ${userId.slice(0, 8)}`;
}

export function timeBandLabel(timeValue: string, total: number, index: number) {
  if (total === 2) {
    return index === 0 ? "아침" : "저녁";
  }

  const hour = Number(timeValue.slice(0, 2));

  if (hour < 11) {
    return "아침";
  }

  if (hour < 17) {
    return "점심";
  }

  return "저녁";
}

export function taskBandLabel(task: CareTask, tasksOfType: CareTask[]) {
  const ordered = sortTasks(tasksOfType);
  const index = Math.max(0, ordered.findIndex((item) => item.id === task.id));
  const time = formatKstTime(task.scheduledAt);
  return `${timeBandLabel(time || "09:00", ordered.length, index)}${time ? ` ${time}` : ""}`;
}

export function nextKstDateKey(offsetDays: number) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + offsetDays);
  return kst.toISOString().slice(0, 10);
}

export function millisecondsUntilNextKstMidnight() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const next = new Date(kst);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1_000, next.getTime() - kst.getTime());
}
