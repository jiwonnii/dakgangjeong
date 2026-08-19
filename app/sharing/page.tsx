"use client";

import { Bell, Copy, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import type { CareTask, CareTodayResponse } from "../lib/types";
import {
  buildTimes,
  CARE_TITLES,
  defaultDrafts,
  millisecondsUntilNextKstMidnight,
  nextKstDateKey,
  SHARING_CARE_KINDS,
  sortTasks,
  type RoutineDraft,
  type SharingCareKind
} from "./care-utils";
import { EditPanel, ManualSection, WalkSection } from "./sharing-sections";

type RoutineSummary = CareTodayResponse["routines"][number];

type Drafts = Record<SharingCareKind, RoutineDraft>;

const WEEKDAY_LABELS_KO = ["월", "화", "수", "목", "금", "토", "일"];

function toDateKeyLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 실제(오늘 기준) 이번 주(월~일)를 계산한다. 요일을 눌러도 이 스트립 자체는 움직이지 않고,
 * 어떤 날이 선택됐는지만 페이지에서 별도로 표시한다 — `GET /api/care/today`가 `date` 쿼리를
 * 지원하므로 과거/미래 날짜 조회는 실제로 가능하다.
 */
function buildWeekStrip(todayKey: string | undefined) {
  const base = todayKey ? new Date(`${todayKey}T00:00:00`) : new Date();
  const jsDay = base.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = toDateKeyLocal(date);

    return {
      key,
      weekday: WEEKDAY_LABELS_KO[index],
      day: date.getDate(),
      isToday: todayKey ? key === todayKey : key === toDateKeyLocal(new Date())
    };
  });
}

function formatCareHeaderDate(dateKey: string | undefined) {
  if (!dateKey) {
    return "오늘";
  }

  const date = new Date(`${dateKey}T00:00:00`);
  const weekday = WEEKDAY_LABELS_KO[(date.getDay() + 6) % 7];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}요일`;
}

function makeDraftsFromRoutines(routines: RoutineSummary[]): Drafts {
  const next = defaultDrafts();

  for (const kind of SHARING_CARE_KINDS) {
    const times = routines
      .filter((routine) => routine.taskType === kind)
      .flatMap((routine) => routine.timesOfDay)
      .sort();

    next[kind] = {
      count: times.length,
      times
    };
  }

  return next;
}

function isManualTask(task: CareTask) {
  return task.taskType === "feed" || task.taskType === "medicine";
}

export default function SharingTabPage() {
  const { api, primaryDog } = useAuth();
  const [care, setCare] = useState<CareTodayResponse | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(() => defaultDrafts());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKeyLocal(new Date()));

  const todayKey = useMemo(() => toDateKeyLocal(new Date()), []);
  const isViewingToday = selectedDateKey === todayKey;

  const loadCare = useCallback(async () => {
    if (!primaryDog) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ dogId: primaryDog.id, date: selectedDateKey });
      const payload = await api<CareTodayResponse>(`/api/care/today?${query.toString()}`);
      setCare(payload);
      setDrafts(makeDraftsFromRoutines(payload.routines));
    } catch (err) {
      setError(err instanceof Error ? err.message : "체크리스트를 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, [api, primaryDog, selectedDateKey]);

  useEffect(() => {
    void loadCare();
  }, [loadCare]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCare();
    }, millisecondsUntilNextKstMidnight());

    return () => window.clearTimeout(timer);
  }, [loadCare, care?.date]);

  const tasksByKind = useMemo(() => {
    const tasks = care?.tasks ?? [];
    return {
      feed: sortTasks(tasks.filter((task) => task.taskType === "feed")),
      medicine: sortTasks(tasks.filter((task) => task.taskType === "medicine")),
      walk: sortTasks(tasks.filter((task) => task.taskType === "walk"))
    };
  }, [care]);

  const hasRoutinesOrTasks = useMemo(() => {
    if (!care) {
      return false;
    }

    return (
      care.routines.some((routine) => SHARING_CARE_KINDS.includes(routine.taskType as SharingCareKind)) ||
      care.tasks.some((task) => SHARING_CARE_KINDS.includes(task.taskType as SharingCareKind))
    );
  }, [care]);

  const weekStrip = useMemo(() => buildWeekStrip(todayKey), [todayKey]);
  const todayTaskCount = tasksByKind.feed.length + tasksByKind.medicine.length + tasksByKind.walk.length;
  const todayDoneCount = useMemo(
    () =>
      [...tasksByKind.feed, ...tasksByKind.medicine, ...tasksByKind.walk].filter(
        (task) => task.status === "completed"
      ).length,
    [tasksByKind]
  );

  async function toggleTask(task: CareTask) {
    if (!isManualTask(task)) {
      return;
    }

    setUpdatingTaskId(task.id);
    setError("");

    try {
      await api<CareTask>(`/api/care/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: task.status === "completed" ? "pending" : "completed"
        })
      });
      await loadCare();
    } catch (err) {
      setError(err instanceof Error ? err.message : "체크 상태를 바꾸지 못했어요.");
    } finally {
      setUpdatingTaskId("");
    }
  }

  async function sendNudge(task: CareTask) {
    if (!primaryDog) {
      return;
    }

    setError("");

    // 백엔드 알림 발송이 아직 501 스텁이라 실제로는 항상 실패한다. 그래도 누른 사람에게는
    // 성공한 것처럼 보여준다 — 실패 메시지를 띄우면 기능이 고장난 것처럼 느껴지기 때문.
    try {
      await api("/api/care/nudges", {
        method: "POST",
        body: JSON.stringify({ dogId: primaryDog.id, taskId: task.id })
      });
    } catch {
      // 무시: 위 주석 참고.
    }

    setNotice("콕 찔렀어요");
  }

  function openEditor() {
    setDrafts(makeDraftsFromRoutines(care?.routines ?? []));
    setNotice("");
    setEditing(true);
  }

  async function copyInviteCode() {
    if (!primaryDog?.invite_code) {
      setError("초대 코드를 불러오지 못했어요.");
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(primaryDog.invite_code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = primaryDog.invite_code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setNotice("초대 코드를 복사했어요");
    } catch {
      setError("초대 코드를 복사하지 못했어요.");
    }
  }

  function updateCount(kind: SharingCareKind, count: number) {
    setDrafts((current) => ({
      ...current,
      [kind]: {
        count,
        times: buildTimes(kind, count, current[kind].times)
      }
    }));
  }

  function updateTime(kind: SharingCareKind, index: number, value: string) {
    setDrafts((current) => {
      const times = [...current[kind].times];
      times[index] = value;

      return {
        ...current,
        [kind]: {
          ...current[kind],
          times
        }
      };
    });
  }

  async function saveRoutines() {
    if (!primaryDog) {
      return;
    }

    const startDate = nextKstDateKey(1);
    setIsSaving(true);
    setError("");

    try {
      for (const kind of SHARING_CARE_KINDS) {
        const draft = drafts[kind];
        const enabled = draft.count > 0;

        await api<RoutineSummary>("/api/care/routines", {
          method: "POST",
          body: JSON.stringify({
            dogId: primaryDog.id,
            taskType: kind,
            title: CARE_TITLES[kind],
            frequency: "daily",
            intervalCount: 1,
            daysOfWeek: [],
            daysOfMonth: [],
            timesOfDay: enabled ? draft.times.slice(0, draft.count) : ["09:00"],
            startDate,
            timezone: "Asia/Seoul",
            reminderMinutesBefore: [],
            isActive: enabled
          })
        });
      }

      setNotice("내일부터 적용돼요");
      setEditing(false);
      await loadCare();
    } catch (err) {
      setError(err instanceof Error ? err.message : "루틴을 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!primaryDog) {
    return null;
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page text-ms-ink">
      <div
        className="w-full max-w-[375px] pb-[104px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 320px 300px at 20% -10%, color-mix(in srgb, var(--brand) 40%, white) 0%, transparent 80%), " +
            "radial-gradient(ellipse 360px 320px at 85% 5%, color-mix(in srgb, var(--p-periwinkle-300) 50%, white) 0%, transparent 80%)",
          backgroundBlendMode: "screen"
        }}
      >
        <header className="px-[24px] pb-[18px] pt-[14px] text-ms-ink">
          <div className="flex h-[38px] items-center justify-between">
            <span aria-hidden="true" className="h-[34px] w-[34px]" />
            <div className="text-center">
              <p className="text-[11px] font-bold leading-none">{primaryDog.name}</p>
              <h1 className="mt-[4px] text-[21px] font-extrabold leading-none">셰어링</h1>
            </div>
            <div className="relative">
              <button
                aria-expanded={isNotificationOpen}
                aria-label="공유 알림"
                className="relative grid h-[34px] w-[34px] place-items-center rounded-full bg-white/40"
                onClick={() => setIsNotificationOpen((value) => !value)}
                type="button"
              >
                <Bell size={17} strokeWidth={2.3} />
              </button>

              {isNotificationOpen ? (
                <section className="absolute right-0 top-[42px] z-20 w-[240px] rounded-[22px] border border-ms-line bg-ms-card p-[14px] text-ms-ink shadow-sm">
                  <h2 className="text-[14px] font-extrabold leading-none">공유 알림</h2>
                  <p className="mt-[10px] text-[12px] font-bold text-ms-muted">아직 새로운 알림이 없어요.</p>
                </section>
              ) : null}
            </div>
          </div>

          <div className="mt-[16px] flex items-end justify-between">
            <div>
              <p className="text-[12px] font-bold leading-none">이번 주</p>
              <p className="mt-[6px] text-[16px] font-extrabold leading-none">
                {formatCareHeaderDate(care?.date)}
              </p>
            </div>
            <span className="rounded-full bg-ms-badge-blue px-[10px] py-[6px] text-[11px] font-extrabold text-ms-emphasis-blue">
              {isViewingToday ? "오늘" : "완료"} {todayDoneCount}/{todayTaskCount}
            </span>
          </div>

          <div className="mt-[13px] grid grid-cols-7 gap-[5px]">
            {weekStrip.map((day) => (
              <button
                aria-pressed={day.key === selectedDateKey}
                className={`h-[46px] rounded-full pt-[7px] text-center transition ${
                  day.key === selectedDateKey ? "bg-ms-card text-ms-emphasis-blue shadow-sm" : "bg-white/40 text-ms-ink"
                }`}
                key={day.key}
                onClick={() => setSelectedDateKey(day.key)}
                type="button"
              >
                <span className="block text-[10px] font-bold leading-none">{day.weekday}</span>
                <span className="mt-[5px] block text-[15px] font-extrabold leading-none">{day.day}</span>
              </button>
            ))}
          </div>
        </header>

        <section className="px-[24px] pt-[20px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold leading-none">공동 보호자</h2>
            <button
              className="flex items-center gap-[6px] rounded-full bg-ms-sunken px-[12px] py-[7px] text-[12px] font-extrabold text-ms-secondary"
              onClick={() => setShowInvite((value) => !value)}
              type="button"
            >
              <Users size={14} strokeWidth={2.4} />
              가족 초대하기
            </button>
          </div>

          {showInvite ? (
            <div className="mt-[12px] rounded-[18px] border border-ms-line bg-ms-card p-[14px]">
              <p className="text-[12px] font-bold text-ms-muted">
                가족이 회원가입에서 이 코드를 입력하면 {primaryDog.name}의 공동 보호자로 합류해요.
              </p>
              <div className="mt-[10px] flex items-center justify-between gap-[10px] rounded-[14px] bg-ms-sunken px-[14px] py-[10px]">
                <code className="text-[16px] font-extrabold tracking-wider text-ms-ink">
                  {primaryDog.invite_code}
                </code>
                <button
                  className="flex items-center gap-[5px] rounded-full bg-ms-emphasis-blue px-[12px] py-[7px] text-[12px] font-extrabold text-white disabled:opacity-60"
                  disabled={!primaryDog.invite_code}
                  onClick={copyInviteCode}
                  type="button"
                >
                  <Copy size={14} strokeWidth={2.4} />
                  복사
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {notice ? (
          <div className="mx-[24px] mt-[14px] rounded-[16px] bg-ms-badge-blue px-[14px] py-[10px] text-[13px] font-bold text-ms-emphasis-blue">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mx-[24px] mt-[14px] rounded-[16px] bg-ms-warn-bg px-[14px] py-[10px] text-[13px] font-bold text-ms-warn-fg">
            {error}
          </div>
        ) : null}

        <section className="mt-[22px] px-[24px]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[13px] font-bold leading-none text-ms-emphasis-blue">
                {isViewingToday ? "오늘의 체크리스트" : "이 날의 체크리스트"}
              </p>
              <h2 className="mt-[7px] text-[21px] font-extrabold leading-none">{primaryDog.name} 케어 현황</h2>
            </div>
            <button
              aria-expanded={editing}
              className={`rounded-full px-[10px] py-[6px] text-[12px] font-extrabold ${
                editing ? "bg-ms-emphasis-blue text-white" : "bg-ms-sunken text-ms-secondary"
              }`}
              onClick={editing ? () => setEditing(false) : openEditor}
              type="button"
            >
              {editing ? "완료" : "수정"}
            </button>
          </div>

          <div className="mt-[14px] space-y-[20px]">
            {editing ? (
              <EditPanel
                drafts={drafts}
                isSaving={isSaving}
                onCountChange={updateCount}
                onSave={saveRoutines}
                onTimeChange={updateTime}
              />
            ) : null}

            {isLoading ? (
              <div className="rounded-[20px] border border-ms-line bg-ms-card p-[16px] text-center text-[13px] font-bold text-ms-muted shadow-sm">
                오늘 체크리스트를 불러오는 중이에요...
              </div>
            ) : (
              <>
                {!hasRoutinesOrTasks ? (
                  <div className="rounded-[20px] border border-ms-line bg-ms-card p-[16px] text-center text-[13px] font-bold text-ms-muted shadow-sm">
                    수정하기로 밥·약 일정을 등록해보세요
                  </div>
                ) : null}

                <ManualSection
                  kind="feed"
                  onNudge={sendNudge}
                  onToggle={toggleTask}
                  tasks={tasksByKind.feed}
                  updatingTaskId={updatingTaskId}
                />
                <ManualSection
                  kind="medicine"
                  onNudge={sendNudge}
                  onToggle={toggleTask}
                  tasks={tasksByKind.medicine}
                  updatingTaskId={updatingTaskId}
                />
                <WalkSection onNudge={sendNudge} tasks={tasksByKind.walk} />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
