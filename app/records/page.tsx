"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Map as MapIcon,
  Route,
  Save,
  Star,
  Timer,
  UserRound,
  Waypoints
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "../ui";
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

export default function RecordsTabPage() {
  const { api, kakaoMapAppKey, primaryDog } = useAuth();
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedRecordId, setSelectedRecordId] = useState("");
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
    <div className="grid gap-4">
      <Link className="flex items-center gap-1 text-sm font-bold text-ms-muted" href="/my">
        <ChevronLeft size={16} /> 마이페이지로
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays size={20} /> 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-black">
            <span>연속 산책</span>
            <span className="text-primary">{streak ? `${streak.streakDays}일` : "확인 중"}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button size="sm" type="button" variant="outline" onClick={() => moveMonth(-1)}>
              <ChevronLeft size={16} /> 이전
            </Button>
            <strong className="text-sm font-black">{monthLabel(monthCursor)}</strong>
            <Button size="sm" type="button" variant="outline" onClick={() => moveMonth(1)}>
              다음 <ChevronRight size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div className="py-1 text-center text-xs font-black text-muted-foreground" key={label}>
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const dayRecords = recordsByDay.get(day.key) ?? [];
              const totalDistance = dayRecords.reduce((sum, record) => sum + (record.distanceMeters ?? 0), 0);
              const selected = selectedDateKey === day.key;

              return (
                <button
                  className={`grid min-h-[78px] content-start gap-1 rounded-md border p-1 text-left ${
                    selected
                      ? "border-primary bg-green-50"
                      : day.isCurrentMonth
                        ? "border-border bg-white"
                        : "border-border bg-muted/50 text-muted-foreground"
                  }`}
                  key={day.key}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey(day.key);
                    setSelectedRecordId("");
                  }}
                >
                  <span className="text-xs font-black">{day.date.getDate()}</span>
                  {dayRecords.length > 0 && (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-[11px] font-black">{formatDistance(totalDistance)}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{dayRecords.length}건</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {isLoading && <p className="text-sm font-bold text-muted-foreground">산책 기록을 불러오는 중이에요.</p>}
          {error && <p className="rounded-md border border-destructive/30 bg-red-50 p-3 text-sm font-bold text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Footprints size={20} /> {selectedDateKey} 상세
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedRecords.length > 0 ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
                  <Waypoints size={17} /> 총 {formatDistance(selectedTotals.distanceMeters)}
                </div>
                <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
                  <Timer size={17} /> 총 {formatDuration(selectedTotals.durationSeconds)}
                </div>
              </div>

              <div className="grid gap-2">
                {selectedRecords.map((record) => (
                  <button
                    className={`grid gap-1 rounded-md border px-3 py-2 text-left text-sm font-bold ${
                      selectedRecord?.id === record.id ? "border-primary bg-green-50" : "border-border bg-white"
                    }`}
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedRecordId(record.id)}
                  >
                    <span>{localDateTimeLabel(record.startedAt)}</span>
                    <span className="text-muted-foreground">
                      {formatDistance(record.distanceMeters ?? 0)} / {formatDuration(record.durationSeconds ?? 0)} · {guardianLabel(record.userId)}
                    </span>
                  </button>
                ))}
              </div>

              {selectedRecord && (
                <div className="grid gap-3">
                  <WalkRecordMap appKey={kakaoMapAppKey} route={selectedRecord.routeGeoJson} />
                  <div className="grid gap-2 rounded-md bg-muted p-3 text-sm font-bold">
                    <span className="flex items-center gap-2">
                      <UserRound size={16} /> {guardianLabel(selectedRecord.userId)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Star size={16} /> 별점 {selectedRecord.rating ? `${selectedRecord.rating}점` : "없음"}
                    </span>
                    <span>좋았던 점: {selectedRecord.likedNotes || "없음"}</span>
                    <span>불편했던 점: {selectedRecord.dislikedNotes || "없음"}</span>
                    <span className="flex items-center gap-2">
                      <Route size={16} />
                      {selectedRecord.recommendedCourse
                        ? `${selectedRecord.recommendedCourse.rank}순위 코스 · ${formatDistance(
                            selectedRecord.recommendedCourse.distanceMeters
                          )} · 예상 ${selectedRecord.recommendedCourse.durationMinutes}분`
                        : "자유 산책"}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-muted-foreground">선택한 날짜에 산책 기록이 없어요.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon size={20} /> 수동 산책 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={handleManualSubmit}>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />
              <Input type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} />
              <Input inputMode="decimal" min="0" step="0.1" type="number" value={manualDistanceKm} onChange={(event) => setManualDistanceKm(event.target.value)} />
              <Input inputMode="numeric" min="1" step="1" type="number" value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} />
            </div>
            <Button disabled={isSavingManual} type="submit">
              <Save size={17} /> 수동 저장
            </Button>
          </form>
          {manualMessage && <p className="text-sm font-bold text-muted-foreground">{manualMessage}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
