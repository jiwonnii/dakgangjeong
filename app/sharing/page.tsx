"use client";

import { Copy, Pencil, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import type { CareTask, CareTodayResponse } from "../lib/types";
import { Button, Card, CardContent } from "../ui";
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
  const [updatingTaskId, setUpdatingTaskId] = useState("");

  const loadCare = useCallback(async () => {
    if (!primaryDog) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const payload = await api<CareTodayResponse>(
        `/api/care/today?dogId=${encodeURIComponent(primaryDog.id)}`
      );
      setCare(payload);
      setDrafts(makeDraftsFromRoutines(payload.routines));
    } catch (err) {
      setError(err instanceof Error ? err.message : "오늘 체크리스트를 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, [api, primaryDog]);

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
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-28 pt-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-muted-foreground">{primaryDog.name}</p>
          <h1 className="text-2xl font-black">셰어링</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowInvite((value) => !value)} type="button" variant="outline">
            <Users size={17} />
            가족 초대하기
          </Button>
          <Button onClick={editing ? () => setEditing(false) : openEditor} type="button" variant="outline">
            <Pencil size={17} />
            {editing ? "닫기" : "수정하기"}
          </Button>
        </div>
      </header>

      {notice && (
        <div className="rounded-md border border-primary/30 bg-green-50 px-4 py-3 text-sm font-black text-primary">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-bold text-destructive">
          {error}
        </div>
      )}

      {showInvite && (
        <Card>
          <CardContent className="grid gap-3 pt-4">
            <div>
              <p className="text-sm font-black">가족 초대 코드</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                가족이 회원가입에서 이 코드를 입력하면 {primaryDog.name}의 공동 보호자로 합류해요.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted px-4 py-3">
              <code className="text-lg font-black tracking-wider">{primaryDog.invite_code}</code>
              <Button disabled={!primaryDog.invite_code} onClick={copyInviteCode} type="button">
                <Copy size={17} />
                복사
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <EditPanel
          drafts={drafts}
          isSaving={isSaving}
          onCountChange={updateCount}
          onSave={saveRoutines}
          onTimeChange={updateTime}
        />
      )}

      {isLoading ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-bold text-muted-foreground">오늘 체크리스트를 불러오는 중이에요...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {!hasRoutinesOrTasks && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-black text-muted-foreground">
                  수정하기로 밥·약 일정을 등록해보세요
                </p>
              </CardContent>
            </Card>
          )}

          <ManualSection
            kind="feed"
            onToggle={toggleTask}
            tasks={tasksByKind.feed}
            updatingTaskId={updatingTaskId}
          />
          <ManualSection
            kind="medicine"
            onToggle={toggleTask}
            tasks={tasksByKind.medicine}
            updatingTaskId={updatingTaskId}
          />
          <WalkSection tasks={tasksByKind.walk} />
        </>
      )}
    </main>
  );
}
