import { BellRing, Check, PawPrint, Lock, Pill, RotateCw, Save, UserRound } from "lucide-react";
import { PetBowlIcon } from "../_components/PetBowlIcon";
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
                        isSelected ? "bg-ms-emphasis-blue text-white" : "bg-ms-card text-ms-secondary"
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
        className="mt-[14px] flex h-[46px] w-full items-center justify-center gap-[8px] rounded-full bg-ms-emphasis-blue text-[14px] font-extrabold text-white transition active:opacity-90 disabled:opacity-60"
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
  onNudge,
  onToggle,
  tasks,
  updatingTaskId
}: {
  kind: "feed" | "medicine";
  onNudge: (task: CareTask) => Promise<void>;
  onToggle: (task: CareTask) => Promise<void>;
  tasks: CareTask[];
  updatingTaskId: string;
}) {
  const Icon = kind === "feed" ? PetBowlIcon : Pill;
  const doneCount = tasks.filter((task) => task.status === "completed").length;

  return (
    <section>
      <div className="flex items-center justify-between px-[4px]">
        <p className="text-[12px] font-bold text-ms-muted">{CARE_LABELS[kind]}</p>
        <span className="text-[11px] font-bold text-ms-muted">
          {doneCount}/{tasks.length}
        </span>
      </div>

      <div className="mt-[8px] grid gap-[8px]">
        {tasks.length === 0 ? (
          <p className="rounded-[16px] bg-ms-sunken px-[16px] py-[14px] text-[12px] font-bold text-ms-muted">
            오늘 등록된 일정이 없어요.
          </p>
        ) : (
          tasks.map((task) => {
            const isChecked = task.status === "completed";
            const isUpdating = updatingTaskId === task.id;
            const doneLabel = task.completedBy
              ? `${task.guardianName ?? guardianLabel(task.completedBy)} 체크`
              : "완료";

            return (
              <div
                className={`flex h-[58px] w-full items-center gap-[8px] rounded-[20px] px-[16px] transition ${
                  isChecked ? "border border-ms-line bg-ms-card" : "bg-ms-sunken"
                }`}
                key={task.id}
              >
                <button
                  aria-pressed={isChecked}
                  className="flex flex-1 items-center gap-[12px] text-left disabled:opacity-60"
                  disabled={isUpdating}
                  onClick={() => void onToggle(task)}
                  type="button"
                >
                  <span
                    className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 ${
                      isChecked
                        ? "border-ms-emphasis-blue bg-ms-emphasis-blue text-white"
                        : "border-ms-line-strong bg-ms-card"
                    }`}
                  >
                    {isChecked ? <Check size={15} strokeWidth={3} /> : null}
                  </span>

                  <span className="flex-1 text-left">
                    <span
                      className={`block text-[14px] font-extrabold ${
                        isChecked ? "text-ms-muted line-through" : "text-ms-ink"
                      }`}
                    >
                      {taskBandLabel(task, tasks)}
                    </span>
                    {isChecked ? (
                      <span className="mt-[2px] block text-[11px] font-bold text-ms-muted">{doneLabel}</span>
                    ) : null}
                  </span>
                </button>

                {!isChecked ? (
                  <button
                    aria-label="콕 찌르기"
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-ms-badge-blue text-ms-emphasis-blue active:opacity-70"
                    onClick={() => void onNudge(task)}
                    type="button"
                  >
                    <BellRing size={15} strokeWidth={2.2} />
                  </button>
                ) : null}

                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-ms-badge-blue text-ms-emphasis-blue">
                  <Icon size={16} strokeWidth={2.2} />
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

/** 산책 진행률. 산책 태스크는 실제 산책이 기록되면 앱이 자동으로 완료 처리하므로 체크 UI가 없다. */
export function WalkSection({
  onNudge,
  tasks
}: {
  onNudge: (task: CareTask) => Promise<void>;
  tasks: CareTask[];
}) {
  const done = tasks.filter((task) => task.status === "completed").length;
  const total = tasks.length;

  return (
    <section>
      <div className="flex items-center justify-between px-[4px]">
        <p className="text-[12px] font-bold text-ms-muted">산책</p>
        <span className="text-[11px] font-bold text-ms-muted">
          {done}/{total}
        </span>
      </div>

      <div className="mt-[8px] grid gap-[8px]">
        {total === 0 ? (
          <p className="rounded-[16px] bg-ms-sunken px-[16px] py-[14px] text-[12px] font-bold text-ms-muted">
            오늘 등록된 일정이 없어요.
          </p>
        ) : (
          tasks.map((task) => {
            const isChecked = task.status === "completed";

            return (
              <div
                className={`flex h-[58px] w-full items-center gap-[8px] rounded-[20px] px-[16px] ${
                  isChecked ? "border border-ms-line bg-ms-card" : "bg-ms-sunken opacity-70"
                }`}
                key={task.id}
              >
                <span
                  className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ${
                    isChecked
                      ? "border-2 border-ms-emphasis-blue bg-ms-emphasis-blue text-white"
                      : "border border-dashed border-ms-line-strong bg-transparent text-ms-muted"
                  }`}
                >
                  {isChecked ? <Check size={15} strokeWidth={3} /> : <Lock size={11} strokeWidth={2.4} />}
                </span>

                <span
                  className={`flex-1 text-left text-[14px] font-extrabold ${
                    isChecked ? "text-ms-muted line-through" : "text-ms-ink"
                  }`}
                >
                  {taskBandLabel(task, tasks)}
                </span>

                {!isChecked ? (
                  <button
                    aria-label="콕 찌르기"
                    className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-ms-badge-blue text-ms-emphasis-blue active:opacity-70"
                    onClick={() => void onNudge(task)}
                    type="button"
                  >
                    <BellRing size={15} strokeWidth={2.2} />
                  </button>
                ) : null}

                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-ms-badge-blue text-ms-emphasis-blue">
                  <PawPrint size={16} strokeWidth={2.2} />
                </span>
              </div>
            );
          })
        )}
      </div>

      {total > 0 ? (
        <p className="mt-[10px] flex items-center justify-end gap-[5px] px-[4px] text-[11px] font-bold text-ms-emphasis-blue">
          <UserRound size={13} strokeWidth={2.2} />
          앱에서 산책하면 자동으로 체크돼요
        </p>
      ) : null}
    </section>
  );
}
