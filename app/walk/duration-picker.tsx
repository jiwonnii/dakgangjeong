"use client";

import type { DurationOptions } from "../lib/types";

export type DurationChoice = "minimum" | "recommended" | "custom" | "free";

/** 사용자 지정 산책 시간의 범위와 눈금. 20분 하한의 근거는 walk-tuning.ts 참고. */
export const CUSTOM_MIN_MINUTES = 20;
export const CUSTOM_MAX_MINUTES = 240;
export const CUSTOM_STEP_MINUTES = 10;

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

export function DurationPicker({
  choice,
  customMinutes,
  durationOptions,
  onChoiceChange,
  onCustomMinutesChange
}: {
  choice: DurationChoice;
  customMinutes: number;
  durationOptions: DurationOptions | null;
  onChoiceChange: (choice: DurationChoice) => void;
  onCustomMinutesChange: (minutes: number) => void;
}) {
  // 강아지별 상한(퍼피·노령견은 더 낮다)을 넘겨 고르면 서버가 거절한다.
  // 에러를 보여주느니 슬라이더를 아예 그만큼만 움직이게 한다.
  const dogMaxMinutes = durationOptions?.maximumMinutes;
  const sliderMax =
    dogMaxMinutes !== undefined
      ? Math.max(CUSTOM_MIN_MINUTES, Math.min(CUSTOM_MAX_MINUTES, Math.floor(dogMaxMinutes / 10) * 10))
      : CUSTOM_MAX_MINUTES;
  const isCappedByDog = sliderMax < CUSTOM_MAX_MINUTES;

  const cards: Array<{ value: DurationChoice; label: string; hint?: string }> = [
    {
      value: "minimum",
      label: "최소 산책",
      hint: durationOptions ? formatMinutes(durationOptions.minimumMinutes) : undefined
    },
    {
      value: "recommended",
      label: "적정 산책",
      hint: durationOptions ? formatMinutes(durationOptions.recommendedMinutes) : undefined
    },
    { value: "custom", label: "사용자 지정", hint: formatMinutes(customMinutes) },
    { value: "free", label: "자유 산책", hint: "코스 없이" }
  ];

  return (
    <div className="grid gap-2">
      <span className="text-sm font-black text-muted-foreground">산책 시간 선택</span>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <button
            className={`grid min-h-[72px] content-center gap-1 rounded-md border px-2 text-center text-sm font-black ${
              choice === card.value
                ? "border-primary bg-green-50 text-primary"
                : "border-border bg-white text-foreground"
            }`}
            key={card.value}
            type="button"
            onClick={() => onChoiceChange(card.value)}
          >
            <span>{card.label}</span>
            {card.hint && <span className="text-xs font-bold text-muted-foreground">{card.hint}</span>}
          </button>
        ))}
      </div>

      {choice === "custom" && (
        <div className="grid gap-2 rounded-md border border-border bg-muted p-3">
          <div className="flex items-center justify-between gap-2 text-sm font-black">
            <span>산책 시간</span>
            <span className="text-primary">{formatMinutes(customMinutes)}</span>
          </div>
          <input
            aria-label="사용자 지정 산책 시간"
            className="w-full"
            max={sliderMax}
            min={CUSTOM_MIN_MINUTES}
            step={CUSTOM_STEP_MINUTES}
            type="range"
            value={Math.min(customMinutes, sliderMax)}
            onChange={(event) => onCustomMinutesChange(Number(event.target.value))}
          />
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{formatMinutes(CUSTOM_MIN_MINUTES)}</span>
            <span>{formatMinutes(sliderMax)}</span>
          </div>
          {isCappedByDog && (
            <p className="text-xs font-bold text-muted-foreground">
              이 강아지에게 권장되는 상한이 {formatMinutes(sliderMax)}이라 여기까지만 고를 수 있어요.
            </p>
          )}
        </div>
      )}

      {choice === "free" && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm font-bold text-muted-foreground">
          코스를 추천하지 않고 바로 산책을 시작해요. 걸은 거리와 경로는 그대로 기록돼요.
        </p>
      )}
    </div>
  );
}
