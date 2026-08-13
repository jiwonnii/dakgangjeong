"use client";

import { CheckCircle2, ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import type { CareTaskType, CareTodayResponse } from "../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui";

const ROW_ORDER: Array<{ taskType: CareTaskType; label: string }> = [
  { taskType: "feed", label: "밥" },
  { taskType: "medicine", label: "약" },
  { taskType: "walk", label: "산책" }
];

/**
 * 오늘 밥·약·산책을 몇 번 중 몇 번 했는지.
 *
 * 메인에서는 보여주기만 한다. 체크와 수정은 셰어링 탭 담당이다.
 * 루틴이 없는 종류는 줄 자체를 그리지 않는다 — 약을 안 먹는 강아지에게
 * "약 0/0" 을 보여줄 이유가 없다.
 */
export function CareProgressCard({ dogId }: { dogId: string }) {
  const { api } = useAuth();
  const [data, setData] = useState<CareTodayResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError("");

    api<CareTodayResponse>(`/api/care/today?dogId=${encodeURIComponent(dogId)}`)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오늘의 케어를 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId]);

  const rows = useMemo(() => {
    const tasks = data?.tasks ?? [];

    return ROW_ORDER.map(({ taskType, label }) => {
      const ofType = tasks.filter((task) => task.taskType === taskType);

      return {
        taskType,
        label,
        total: ofType.length,
        done: ofType.filter((task) => task.status === "completed").length
      };
    }).filter((row) => row.total > 0);
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-bold text-muted-foreground">오늘의 케어를 불러오는 중이에요...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList size={20} /> 오늘 할 일
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-bold text-muted-foreground">오늘의 케어를 불러오지 못했어요.</p>
          <p className="text-xs font-semibold text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const allDone = rows.length > 0 && rows.every((row) => row.done >= row.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList size={20} /> 오늘 할 일
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm font-bold text-muted-foreground">셰어링에서 밥·약 일정을 등록해보세요.</p>
        ) : (
          <>
            <div className="grid gap-2">
              {rows.map((row) => {
                const done = row.done >= row.total;

                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm font-extrabold"
                    key={row.taskType}
                  >
                    <span className="flex items-center gap-2">
                      {done && <CheckCircle2 className="text-primary" size={16} />}
                      {row.label}
                    </span>
                    <span className={done ? "text-primary" : "text-muted-foreground"}>
                      {row.done} / {row.total}
                    </span>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-green-50 px-3 py-2 text-sm font-black text-primary">
                <CheckCircle2 size={17} /> 오늘 할 일을 다 했어요
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
