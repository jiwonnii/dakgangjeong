import { CheckCircle2, Clock3, RotateCw, Save } from "lucide-react";
import type { CareTask } from "../lib/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "../ui";
import {
  CARE_LABELS,
  formatKstDateTime,
  guardianLabel,
  SHARING_CARE_KINDS,
  taskBandLabel,
  timeBandLabel,
  type RoutineDraft,
  type SharingCareKind
} from "./care-utils";

type Drafts = Record<SharingCareKind, RoutineDraft>;

export function EditPanel({
  drafts,
  isSaving,
  onCountChange,
  onSave,
  onTimeChange
}: {
  drafts: Drafts;
  isSaving: boolean;
  onCountChange: (kind: SharingCareKind, count: number) => void;
  onSave: () => Promise<void>;
  onTimeChange: (kind: SharingCareKind, index: number, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 size={19} />
          내일부터 쓸 일정
        </CardTitle>
      </CardHeader>
      <CardContent>
        {SHARING_CARE_KINDS.map((kind) => (
          <div className="grid gap-3 rounded-md border border-border bg-muted/45 p-3" key={kind}>
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm font-black">{CARE_LABELS[kind]}</strong>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((count) => (
                  <Button
                    key={count}
                    onClick={() => onCountChange(kind, count)}
                    size="sm"
                    type="button"
                    variant={drafts[kind].count === count ? "default" : "outline"}
                  >
                    {count === 0 ? "안 함" : `${count}회`}
                  </Button>
                ))}
              </div>
            </div>

            {drafts[kind].times.map((time, index) => (
              <label className="grid gap-1 text-xs font-black text-muted-foreground" key={`${kind}-${index}`}>
                {timeBandLabel(time, drafts[kind].count, index)}
                <Input
                  onChange={(event) => onTimeChange(kind, index, event.target.value)}
                  type="time"
                  value={time}
                />
              </label>
            ))}
          </div>
        ))}

        <Button disabled={isSaving} onClick={() => void onSave()} type="button">
          {isSaving ? <RotateCw className="animate-spin" size={17} /> : <Save size={17} />}
          저장
        </Button>
      </CardContent>
    </Card>
  );
}

export function ManualSection({
  kind,
  onToggle,
  tasks,
  updatingTaskId
}: {
  kind: "feed" | "medicine";
  onToggle: (task: CareTask) => Promise<void>;
  tasks: CareTask[];
  updatingTaskId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{CARE_LABELS[kind]}</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm font-bold text-muted-foreground">오늘 등록된 일정이 없어요.</p>
        ) : (
          tasks.map((task) => (
            <label
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted px-3 py-3"
              key={task.id}
            >
              <span className="grid gap-1">
                <span className="text-sm font-black">{taskBandLabel(task, tasks)}</span>
                <span className="text-xs font-bold text-muted-foreground">
                  {task.status === "completed"
                    ? `${guardianLabel(task.completedBy)} · ${formatKstDateTime(task.completedAt)}`
                    : "아직 체크 전이에요"}
                </span>
              </span>
              <input
                checked={task.status === "completed"}
                className="mt-1 h-5 w-5 accent-primary"
                disabled={updatingTaskId === task.id}
                onChange={() => void onToggle(task)}
                type="checkbox"
              />
            </label>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function WalkSection({ tasks }: { tasks: CareTask[] }) {
  const done = tasks.filter((task) => task.status === "completed").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>산책</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm font-bold text-muted-foreground">오늘 등록된 일정이 없어요.</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-3 text-sm font-black">
              <span className="flex items-center gap-2">
                {done >= tasks.length && <CheckCircle2 className="text-primary" size={17} />}
                오늘 산책 진행률
              </span>
              <span className={done >= tasks.length ? "text-primary" : "text-muted-foreground"}>
                {done} / {tasks.length}
              </span>
            </div>

            <div className="grid gap-2">
              {tasks.map((task) => (
                <div className="rounded-md border border-border px-3 py-2 text-sm font-bold" key={task.id}>
                  {taskBandLabel(task, tasks)}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
