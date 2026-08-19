"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  PawPrint,
  MapPin,
  Route,
  Save,
  Star,
  UserRound,
  Waypoints
} from "lucide-react";
import Link from "next/link";
import { StreakFlameIcon } from "../_components/StreakFlameIcon";
import { useAuth } from "../auth-context";
import {
  WEEKDAY_LABELS,
  buildCalendarDays,
  formatDistance,
  formatDuration,
  guardianLabel,
  kstDateKeyFromIso,
  localDateTimeLabel,
  monthBoundsIso,
  monthLabel,
  toDateKey,
  type StreakResponse,
  type WalkRecord,
  type WalkRecordListResponse
} from "./record-utils";
import { WalkRecordMap } from "./walk-record-map";

type ViewMode = "monthly" | "weekly";

function startOfWeekDate(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDaysDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatWeekRangeLabel(start: Date, end: Date) {
  const startLabel = `${start.getMonth() + 1}월 ${start.getDate()}일`;
  const endLabel =
    start.getMonth() === end.getMonth() ? `${end.getDate()}일` : `${end.getMonth() + 1}월 ${end.getDate()}일`;
  return `${startLabel} ~ ${endLabel}`;
}

export default function RecordsTabPage() {
  const { api, kakaoMapAppKey, primaryDog } = useAuth();
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [records, setRecords] = useState<WalkRecord[]>([]);
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualDistanceKm, setManualDistanceKm] = useState("1.0");
  const [manualMinutes, setManualMinutes] = useState("20");
  const [manualDate, setManualDate] = useState(() => toDateKey(new Date()));
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;
  });
  const [manualMessage, setManualMessage] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  const calendarRange = useMemo(() => monthBoundsIso(monthCursor), [monthCursor]);
  const recordsByDay = useMemo(() => {
    const grouped = new Map<string, WalkRecord[]>();
    records.forEach((record) => {
      const key = kstDateKeyFromIso(record.startedAt);
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });
    return grouped;
  }, [records]);
  const selectedRecords = recordsByDay.get(selectedDateKey) ?? [];
  const selectedRecord =
    selectedRecords.find((record) => record.id === selectedRecordId) ?? selectedRecords[0] ?? null;
  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const selectedTotals = selectedRecords.reduce(
    (totals, record) => ({
      distanceMeters: totals.distanceMeters + (record.distanceMeters ?? 0),
      durationSeconds: totals.durationSeconds + (record.durationSeconds ?? 0)
    }),
    { distanceMeters: 0, durationSeconds: 0 }
  );

  // 주간 탭: 선택한 날짜가 속한 한 주(일~토)를 계산한다. records는 현재 보고 있는
  // 달(monthCursor) 범위로만 불러오므로, 선택한 주가 달 경계에 걸치면 그 밖의
  // 날짜는 데이터가 비어 보일 수 있다 — 아래 안내 문구로 알린다.
  const weekDays = useMemo(() => {
    const anchor = new Date(`${selectedDateKey}T00:00:00`);
    const start = startOfWeekDate(anchor);
    return Array.from({ length: 7 }, (_, index) => addDaysDate(start, index));
  }, [selectedDateKey]);
  const weekStats = useMemo(
    () =>
      weekDays.map((date) => {
        const key = toDateKey(date);
        const dayRecords = recordsByDay.get(key) ?? [];
        return {
          date,
          key,
          count: dayRecords.length,
          distanceMeters: dayRecords.reduce((sum, record) => sum + (record.distanceMeters ?? 0), 0),
          durationSeconds: dayRecords.reduce((sum, record) => sum + (record.durationSeconds ?? 0), 0)
        };
      }),
    [weekDays, recordsByDay]
  );
  const weekTotals = weekStats.reduce(
    (totals, day) => ({
      distanceMeters: totals.distanceMeters + day.distanceMeters,
      durationSeconds: totals.durationSeconds + day.durationSeconds,
      count: totals.count + day.count
    }),
    { distanceMeters: 0, durationSeconds: 0, count: 0 }
  );
  const maxWeekDistance = Math.max(1, ...weekStats.map((day) => day.distanceMeters));
  const today = useMemo(() => toDateKey(new Date()), []);

  async function loadRecords() {
    if (!primaryDog) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        dogId: primaryDog.id,
        from: calendarRange.fromIso,
        to: calendarRange.toIso,
        limit: "100",
        offset: "0"
      });
      const [nextRecords, nextStreak] = await Promise.all([
        api<WalkRecordListResponse>(`/api/walk-records?${query.toString()}`),
        api<StreakResponse>(`/api/walk-records/streak?dogId=${encodeURIComponent(primaryDog.id)}`)
      ]);
      setRecords(nextRecords.records);
      setStreak(nextStreak);
    } catch {
      setError("산책 기록을 불러오지 못했어요.");
      setRecords([]);
      setStreak(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryDog?.id, calendarRange.fromIso, calendarRange.toIso]);

  function moveMonth(delta: number) {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1);
    setMonthCursor(next);
    setSelectedDateKey(toDateKey(next));
    setSelectedRecordId("");
  }

  async function handleManualSubmit(event: FormEvent) {
    event.preventDefault();

    if (!primaryDog) {
      return;
    }

    setIsSavingManual(true);
    setManualMessage("");

    try {
      const walkedAt = new Date(`${manualDate}T${manualTime}:00`).toISOString();
      await api<{ record: WalkRecord }>("/api/walk-records/manual", {
        method: "POST",
        body: JSON.stringify({
          dogId: primaryDog.id,
          walkedAt,
          distanceMeters: Math.max(0, Math.round(Number(manualDistanceKm) * 1000)),
          durationSeconds: Math.max(1, Math.round(Number(manualMinutes) * 60))
        })
      });
      const nextMonth = new Date(`${manualDate}T00:00:00`);
      setMonthCursor(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
      setSelectedDateKey(manualDate);
      setSelectedRecordId("");
      setManualMessage("수동 산책 기록을 저장했어요.");
      await loadRecords();
    } catch {
      setManualMessage("수동 산책 기록을 저장하지 못했어요.");
    } finally {
      setIsSavingManual(false);
    }
  }

  if (!primaryDog) {
    return null;
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page text-ms-ink">
      <div className="w-full max-w-[375px] px-6 pb-[104px] pt-5">
        <header className="flex h-12 items-center justify-between">
          <Link
            aria-label="마이페이지로"
            className="grid h-10 w-10 place-items-center rounded-full bg-ms-sunken text-ms-ink"
            href="/my"
          >
            <ChevronLeft size={21} strokeWidth={2.1} />
          </Link>
          <p className="text-[14px] font-bold text-ms-muted">산책 기록</p>
          <div className="h-10 w-10" />
        </header>

        <section className="mt-4 flex items-center justify-between gap-[10px] rounded-[16px] bg-ms-card px-[16px] py-[12px] shadow-sm">
          <span className="flex items-center gap-[8px] text-[13px] font-extrabold text-ms-secondary">
            <StreakFlameIcon className="text-ms-emphasis" size={17} />
            연속 산책
          </span>
          <span className="text-[15px] font-extrabold text-ms-emphasis">
            {streak ? `${streak.streakDays}일` : "확인 중"}
          </span>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-[24px] font-extrabold leading-none">{monthLabel(monthCursor)}</h1>
            <div className="flex items-center gap-[6px]">
              <button
                aria-label="저번 달"
                className="grid h-9 w-9 place-items-center rounded-full bg-ms-sunken text-ms-ink"
                onClick={() => moveMonth(-1)}
                type="button"
              >
                <ChevronLeft size={18} strokeWidth={2.2} />
              </button>
              <button
                aria-label="다음 달"
                className="grid h-9 w-9 place-items-center rounded-full bg-ms-sunken text-ms-ink"
                onClick={() => moveMonth(1)}
                type="button"
              >
                <ChevronRight size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-[6px]">
            <span className="h-[8px] w-[8px] rounded-full bg-ms-action-green" />
            <span className="text-[12px] font-semibold text-ms-secondary">산책 기록 있는 날</span>
          </div>
        </section>

        <div className="mt-4 flex gap-[6px] rounded-full bg-ms-sunken p-[4px]">
          <button
            className={`h-[36px] flex-1 rounded-full text-[13px] font-extrabold transition ${
              viewMode === "monthly" ? "bg-ms-card text-ms-ink shadow-sm" : "text-ms-muted"
            }`}
            onClick={() => setViewMode("monthly")}
            type="button"
          >
            월간
          </button>
          <button
            className={`h-[36px] flex-1 rounded-full text-[13px] font-extrabold transition ${
              viewMode === "weekly" ? "bg-ms-card text-ms-ink shadow-sm" : "text-ms-muted"
            }`}
            onClick={() => setViewMode("weekly")}
            type="button"
          >
            주간
          </button>
        </div>

        {viewMode === "monthly" ? (
          <section className="mt-4 rounded-[20px] bg-ms-card p-[16px] shadow-sm">
            <ul className="grid grid-cols-7 text-center text-[11px] font-semibold text-ms-muted">
              {WEEKDAY_LABELS.map((label) => (
                <li className="py-[6px]" key={label}>
                  {label}
                </li>
              ))}
            </ul>

            <ul className="grid grid-cols-7 gap-y-[6px]">
              {calendarDays.map((day) => {
                const dayRecords = recordsByDay.get(day.key) ?? [];
                const isFuture = day.key > today;
                const isSelected = day.key === selectedDateKey;
                const isToday = day.key === today;

                return (
                  <li className="flex justify-center" key={day.key}>
                    <button
                      aria-pressed={isSelected}
                      className={`flex h-[38px] w-[38px] flex-col items-center justify-center gap-[3px] rounded-[12px] text-[13px] font-bold transition ${
                        isSelected
                          ? "bg-ms-brand text-ms-on-brand"
                          : isFuture || !day.isCurrentMonth
                            ? "text-ms-muted"
                            : "text-ms-ink"
                      } ${isToday && !isSelected ? "border border-ms-brand" : ""}`}
                      disabled={isFuture}
                      onClick={() => {
                        setSelectedDateKey(day.key);
                        setSelectedRecordId("");
                      }}
                      type="button"
                    >
                      {day.date.getDate()}
                      <span className="flex gap-[2px]">
                        {dayRecords.length > 0 ? (
                          <span
                            className={`h-[4px] w-[4px] rounded-full ${
                              isSelected ? "bg-ms-on-brand" : "bg-ms-action-green"
                            }`}
                          />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="mt-4">
            <div className="rounded-[20px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
              <p className="text-[13px] font-bold leading-none text-ms-emphasis-green">이번 주 산책 요약</p>
              <p className="mt-[10px] text-[12px] font-medium leading-[1.5] text-ms-muted">
                {formatWeekRangeLabel(weekDays[0], weekDays[6])} · 조회 중인 달({monthLabel(monthCursor)}) 밖의
                날짜는 비어 보일 수 있어요.
              </p>

              <div className="mt-[18px] flex items-end justify-between gap-[4px]">
                {weekStats.map((day) => {
                  const barHeight = Math.max(6, Math.round((day.distanceMeters / maxWeekDistance) * 64));
                  const isSelected = day.key === selectedDateKey;

                  return (
                    <button
                      className="flex flex-1 flex-col items-center gap-[6px]"
                      key={day.key}
                      onClick={() => {
                        setSelectedDateKey(day.key);
                        setSelectedRecordId("");
                      }}
                      type="button"
                    >
                      <div className="flex h-[64px] w-full items-end justify-center">
                        <span
                          className={`w-[12px] rounded-full ${isSelected ? "bg-ms-brand" : "bg-ms-action-green"}`}
                          style={{ height: day.count > 0 ? barHeight : 4 }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${isSelected ? "text-ms-ink" : "text-ms-muted"}`}>
                        {WEEKDAY_LABELS[day.date.getDay()]}
                      </span>
                      <span
                        className={`text-[11px] font-extrabold ${isSelected ? "text-ms-ink" : "text-ms-muted"}`}
                      >
                        {day.date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <dl className="mt-[12px] grid grid-cols-3 gap-[8px]">
              <div className="rounded-[18px] border border-ms-line bg-ms-card p-[14px] shadow-sm">
                <PawPrint className="text-ms-emphasis-green" size={19} strokeWidth={2.2} />
                <dt className="mt-[12px] text-[11px] font-bold text-ms-muted">총 거리</dt>
                <dd className="mt-[5px] whitespace-nowrap text-[14px] font-extrabold">
                  {formatDistance(weekTotals.distanceMeters)}
                </dd>
              </div>
              <div className="rounded-[18px] border border-ms-line bg-ms-card p-[14px] shadow-sm">
                <Clock3 className="text-ms-emphasis" size={19} strokeWidth={2.2} />
                <dt className="mt-[12px] text-[11px] font-bold text-ms-muted">총 시간</dt>
                <dd className="mt-[5px] whitespace-nowrap text-[14px] font-extrabold">
                  {formatDuration(weekTotals.durationSeconds)}
                </dd>
              </div>
              <div className="rounded-[18px] border border-ms-line bg-ms-card p-[14px] shadow-sm">
                <Route className="text-ms-walk-minimum" size={19} strokeWidth={2.2} />
                <dt className="mt-[12px] text-[11px] font-bold text-ms-muted">기록</dt>
                <dd className="mt-[5px] whitespace-nowrap text-[14px] font-extrabold">{weekTotals.count}회</dd>
              </div>
            </dl>
          </section>
        )}

        {isLoading ? <p className="mt-3 text-[12px] font-bold text-ms-muted">산책 기록을 불러오는 중이에요.</p> : null}
        {error ? (
          <p className="mt-3 rounded-[14px] bg-ms-warn-bg px-[14px] py-[10px] text-[12px] font-bold text-ms-warn-fg">
            {error}
          </p>
        ) : null}

        {/* 선택한 날짜 상세 */}
        <section className="mt-6">
          <h2 className="flex items-center gap-[8px] text-[15px] font-bold">
            <CalendarDays size={16} strokeWidth={2.2} />
            {selectedDateKey} 상세
          </h2>

          {selectedRecords.length === 0 ? (
            <p className="mt-3 rounded-[16px] bg-ms-sunken px-4 py-4 text-[13px] font-medium text-ms-secondary">
              이 날은 산책 기록이 없어요.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-[8px]">
                <div className="flex h-[44px] items-center gap-[8px] rounded-[14px] bg-ms-sunken px-[12px] text-[12px] font-extrabold text-ms-secondary">
                  <Waypoints size={16} strokeWidth={2.2} /> 총 {formatDistance(selectedTotals.distanceMeters)}
                </div>
                <div className="flex h-[44px] items-center gap-[8px] rounded-[14px] bg-ms-sunken px-[12px] text-[12px] font-extrabold text-ms-secondary">
                  <Clock3 size={16} strokeWidth={2.2} /> 총 {formatDuration(selectedTotals.durationSeconds)}
                </div>
              </div>

              <ul className="mt-3 space-y-[8px]">
                {selectedRecords.map((record) => (
                  <li key={record.id}>
                    <button
                      className={`flex w-full flex-col items-start gap-[4px] rounded-[16px] border p-[14px] text-left text-[13px] font-bold transition ${
                        selectedRecord?.id === record.id
                          ? "border-ms-brand bg-ms-sunken"
                          : "border-ms-line bg-ms-card"
                      }`}
                      onClick={() => setSelectedRecordId(record.id)}
                      type="button"
                    >
                      <span className="text-ms-ink">{localDateTimeLabel(record.startedAt)}</span>
                      <span className="text-[12px] font-semibold text-ms-muted">
                        {formatDistance(record.distanceMeters ?? 0)} · {formatDuration(record.durationSeconds ?? 0)}{" "}
                        · {record.guardianName ?? guardianLabel(record.userId)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {selectedRecord ? (
                <div className="mt-3 overflow-hidden rounded-[22px] border border-ms-line bg-ms-card shadow-sm">
                  <div className="relative">
                    <WalkRecordMap appKey={kakaoMapAppKey} route={selectedRecord.routeGeoJson} />
                    <div className="absolute left-[14px] top-[14px] flex h-[30px] items-center gap-[6px] rounded-full bg-ms-card px-[12px] text-[12px] font-extrabold text-ms-ink shadow-sm">
                      <MapPin className="text-ms-emphasis" size={14} strokeWidth={2.2} />
                      {selectedRecord.recommendedCourse ? `${selectedRecord.recommendedCourse.rank}순위 코스` : "자유 산책"}
                    </div>
                  </div>
                  <div className="grid gap-[8px] p-[16px] text-[13px] font-semibold">
                    <span className="flex items-center gap-[8px] text-ms-secondary">
                      <UserRound size={16} strokeWidth={2.2} />{" "}
                      {selectedRecord.guardianName ?? guardianLabel(selectedRecord.userId)}
                    </span>
                    <span className="flex items-center gap-[8px] text-ms-secondary">
                      <Star size={16} strokeWidth={2.2} /> 별점{" "}
                      {selectedRecord.rating ? `${selectedRecord.rating}점` : "없음"}
                    </span>
                    <span className="text-ms-secondary">좋았던 점: {selectedRecord.likedNotes || "없음"}</span>
                    <span className="text-ms-secondary">불편했던 점: {selectedRecord.dislikedNotes || "없음"}</span>
                    <span className="flex items-center gap-[8px] text-ms-secondary">
                      <Route size={16} strokeWidth={2.2} />
                      {selectedRecord.recommendedCourse
                        ? `${formatDistance(selectedRecord.recommendedCourse.distanceMeters)} · 예상 ${
                            selectedRecord.recommendedCourse.durationMinutes
                          }분`
                        : "자유 산책"}
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* 수동 산책 기록 */}
        <section className="mt-6">
          <h2 className="flex items-center gap-[8px] text-[15px] font-bold">
            <Save size={16} strokeWidth={2.2} />
            수동 산책 기록
          </h2>
          <form
            className="mt-3 grid gap-[10px] rounded-[20px] border border-ms-line bg-ms-card p-[16px] shadow-sm"
            onSubmit={handleManualSubmit}
          >
            <div className="grid grid-cols-2 gap-[8px]">
              <input
                className="h-[44px] rounded-[14px] border border-ms-line bg-ms-card px-[12px] text-[13px] font-bold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                onChange={(event) => setManualDate(event.target.value)}
                type="date"
                value={manualDate}
              />
              <input
                className="h-[44px] rounded-[14px] border border-ms-line bg-ms-card px-[12px] text-[13px] font-bold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                onChange={(event) => setManualTime(event.target.value)}
                type="time"
                value={manualTime}
              />
            </div>
            <div className="grid grid-cols-2 gap-[8px]">
              <label className="block">
                <span className="text-[11px] font-bold text-ms-muted">거리(km)</span>
                <input
                  className="mt-[6px] h-[44px] w-full rounded-[14px] border border-ms-line bg-ms-card px-[12px] text-[13px] font-bold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setManualDistanceKm(event.target.value)}
                  step="0.1"
                  type="number"
                  value={manualDistanceKm}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-ms-muted">시간(분)</span>
                <input
                  className="mt-[6px] h-[44px] w-full rounded-[14px] border border-ms-line bg-ms-card px-[12px] text-[13px] font-bold text-ms-ink outline-none focus:border-ms-line-strong focus:ring-4 focus:ring-ms-line"
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => setManualMinutes(event.target.value)}
                  step="1"
                  type="number"
                  value={manualMinutes}
                />
              </label>
            </div>
            <button
              className="flex h-[46px] items-center justify-center gap-[8px] rounded-full bg-ms-brand text-[14px] font-extrabold text-ms-on-brand transition active:bg-ms-brand-pressed disabled:opacity-55"
              disabled={isSavingManual}
              type="submit"
            >
              <Save size={17} strokeWidth={2.2} />
              {isSavingManual ? "저장 중" : "수동 저장"}
            </button>
            {manualMessage ? <p className="text-[12px] font-bold text-ms-muted">{manualMessage}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
