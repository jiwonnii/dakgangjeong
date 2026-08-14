import { Check, Footprints, Pill, RotateCw, Save, Soup, UserRound } from "lucide-react";
import type { CareTask } from "../lib/types";
import {
  CARE_LABELS,
  guardianLabel,
  SHARING_CARE_KINDS,
  taskBandLabel,
  timeBandLabel,
  type RoutineDraft,
  type SharingCareKind
} from "./care-utils";

type Drafts = Record<SharingCareKind, RoutineDraft>;

/** "내일부터 쓸 일정" — 밥/약/산책 횟수와 시간대를 고른다. 저장은 내일부터 반영된다. */
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
    <article className="rounded-[20px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
      <h2 className="text-[16px] font-extrabold leading-none text-ms-ink">내일부터 쓸 일정</h2>

      <div className="mt-[14px] grid gap-[10px]">
        {SHARING_CARE_KINDS.map((kind) => (
          <div className="rounded-[16px] bg-ms-sunken p-[13px]" key={kind}>
            <div className="flex items-center justify-between gap-[10px]">
              <span className="text-[14px] font-extrabold text-ms-ink">{CARE_LABELS[kind]} 횟수</span>
              <div className="flex gap-[6px]">
                {[0, 1, 2, 3].map((count) => {
                  const isSelected = drafts[kind].count === count;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`h-[32px] rounded-full px-[11px] text-[12px] font-extrabold transition ${
                        isSelected ? "bg-ms-brand text-ms-on-brand" : "bg-ms-card text-ms-secondary"
                      }`}
                      key={count}
                      onClick={() => onCountChange(kind, count)}
                      type="button"
                    >
                      {count === 0 ? "안 함" : `${count}회`}
                    </button>
                  );
                })}
              </div>
            </div>

            {drafts[kind].times.length > 0 ? (
              <div className="mt-[10px] grid gap-[8px]">
                {drafts[kind].times.map((time, index) => (
                  <label className="flex items-center justify-between gap-[10px]" key={`${kind}-${index}`}>
                    <span className="text-[12px] font-bold text-ms-muted">
                      {timeBandLabel(time, drafts[kind].count, index)}
                    </span>
                    <input
                      className="h-[36px] rounded-[12px] border border-ms-line bg-ms-card px-[10px] text-[13px] font-bold text-ms-ink outline-none transition focus:border-ms-line-strong"
                      onChange={(event) => onTimeChange(kind, index, event.target.value)}
                      type="time"
                      value={time}
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button
        className="mt-[14px] flex h-[46px] w-full items-center justify-center gap-[8px] rounded-full bg-ms-brand text-[14px] font-extrabold text-ms-on-brand transition active:bg-ms-brand-pressed disabled:opacity-60"
        disabled={isSaving}
        onClick={() => void onSave()}
        type="button"
      >
        {isSaving ? <RotateCw className="animate-spin" size={16} /> : <Save size={16} />}
        저장
      </button>
    </article>
  );
}

/** 밥/약 체크리스트. FE의 CareRow를 그대로 옮기되, 슬롯은 오늘 실제 태스크에서 온다. */
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
  const Icon = kind === "feed" ? Soup : Pill;
  const doneCount = tasks.filter((task) => task.status === "completed").length;

  return (
    <article className="rounded-[20px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex items-center gap-[10px]">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-[14px] bg-ms-weather text-ms-emphasis-green">
            <Icon size={19} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-[16px] font-extrabold leading-none text-ms-ink">{CARE_LABELS[kind]}</h2>
            <p className="mt-[6px] text-[12px] font-semibold text-ms-muted">
              {doneCount}/{tasks.length} 완료
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-[10px] py-[6px] text-[12px] font-extrabold ${
            tasks.length > 0 && doneCount === tasks.length ? "bg-ms-ok-bg text-ms-ok-fg" : "bg-ms-sunken text-ms-secondary"
          }`}
        >
          {tasks.length}회
        </span>
      </div>

      <div className="mt-[14px] grid gap-[8px]">
        {tasks.length === 0 ? (
          <p className="text-[12px] font-bold text-ms-muted">오늘 등록된 일정이 없어요.</p>
        ) : (
          tasks.map((task) => {
            const isChecked = task.status === "completed";
            const isUpdating = updatingTaskId === task.id;
            const doneLabel = task.completedBy
              ? `${task.guardianName ?? guardianLabel(task.completedBy)} 체크`
              : "완료";

            return (
              <button
                aria-pressed={isChecked}
                className={`flex h-[48px] items-center justify-between rounded-[16px] border px-[13px] transition disabled:opacity-60 ${
                  isChecked
                    ? "border-ms-action-green bg-ms-weather text-ms-ink"
                    : "border-ms-line bg-ms-card text-ms-secondary"
                }`}
                disabled={isUpdating}
                key={task.id}
                onClick={() => void onToggle(task)}
                type="button"
              >
                <span className="flex items-center gap-[9px]">
                  <span
                    className={`grid h-[24px] w-[24px] place-items-center rounded-full border ${
                      isChecked ? "border-ms-action-green bg-ms-action-green text-ms-on-green" : "border-ms-line"
                    }`}
                  >
                    {isChecked ? <Check size={15} strokeWidth={2.8} /> : null}
                  </span>
                  <span className="text-[14px] font-extrabold">{taskBandLabel(task, tasks)}</span>
                </span>
                <span className="text-[12px] font-bold text-ms-muted">{isChecked ? doneLabel : "미완료"}</span>
              </button>
            );
          })
        )}
      </div>
    </article>
  );
}

/** 산책 진행률. 산책 태스크는 실제 산책이 기록되면 앱이 자동으로 완료 처리하므로 체크 UI가 없다. */
export function WalkSection({ tasks }: { tasks: CareTask[] }) {
  const done = tasks.filter((task) => task.status === "completed").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <article className="rounded-[20px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex items-center gap-[10px]">
          <span className="grid h-[38px] w-[38px] place-items-center rounded-[14px] bg-ms-weather text-ms-emphasis-green">
            <Footprints size={19} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-[16px] font-extrabold leading-none text-ms-ink">산책</h2>
            <p className="mt-[6px] text-[12px] font-semibold text-ms-muted">
              앱에서 산책하거나 기록하면 자동으로 완료돼요
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-[10px] py-[6px] text-[12px] font-extrabold ${
            total > 0 && done === total ? "bg-ms-ok-bg text-ms-ok-fg" : "bg-ms-sunken text-ms-secondary"
          }`}
        >
          {done}/{total}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-[14px] text-[12px] font-bold text-ms-muted">오늘 등록된 일정이 없어요.</p>
      ) : (
        <>
          <div className="mt-[16px] h-[10px] overflow-hidden rounded-full bg-ms-sunken">
            <div className="h-full rounded-full bg-ms-action-green" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-[13px] flex items-center justify-between gap-[10px]">
            <div className="flex flex-wrap gap-[6px]">
              {tasks.map((task) => (
                <span
                  className={`rounded-full px-[9px] py-[5px] text-[11px] font-bold ${
                    task.status === "completed" ? "bg-ms-weather text-ms-emphasis-green" : "bg-ms-sunken text-ms-secondary"
                  }`}
                  key={task.id}
                >
                  {taskBandLabel(task, tasks)}
                </span>
              ))}
            </div>
            <span className="flex shrink-0 items-center gap-[5px] text-[12px] font-extrabold text-ms-emphasis-green">
              <UserRound size={14} strokeWidth={2.2} />
              앱 자동
            </span>
          </div>
        </>
      )}
    </article>
  );
}
