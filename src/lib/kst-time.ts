/**
 * Korea Standard Time (UTC+9, no DST) wall-clock extraction. Every
 * hour-of-day rule in the recommendation pipeline (summer daytime heat,
 * evening lighting preference) must use KST regardless of the server
 * process's own timezone — using `Date.getHours()` directly would silently
 * shift these rules by however many hours the deployment host's local
 * timezone differs from KST (e.g. a UTC-configured host would be 9 hours
 * off). This module is the single place that extracts KST fields, so every
 * caller stays correct together.
 */

export type KstDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export function getKstParts(instant: Date): KstDateParts {
  const parts = kstFormatter.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute")
  };
}

export function getKstHour(instant: Date): number {
  return getKstParts(instant).hour;
}

/**
 * Coarse 오전/오후/저녁 bucket for the given KST hour (spec 7.3 캐시 키).
 * Kept free of a walk-tuning.js import — callers pass in the boundary
 * hours so this stays a pure time-math module with no dependency on the
 * tuning constants module.
 *
 * `eveningStartHour`/`eveningEndHour` must match the same "저녁" window
 * custom-model.ts's night-lighting rule uses (EVENING_OR_NIGHT_START_HOUR /
 * _END_HOUR), so the codebase has exactly one notion of "evening" — the
 * window wraps past midnight (e.g. 18~다음날 6시), which is why both a
 * start and an end hour are needed rather than a single cutoff.
 */
export function resolveTimeOfDayBucket(
  hour: number,
  morningEndHour: number,
  eveningStartHour: number,
  eveningEndHour: number
): "morning" | "afternoon" | "evening" {
  const isEvening = hour >= eveningStartHour || hour < eveningEndHour;

  if (isEvening) {
    return "evening";
  }

  return hour < morningEndHour ? "morning" : "afternoon";
}

export function formatKstYyyyMmDd(instant: Date): string {
  const { year, month, day } = getKstParts(instant);
  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}
