"use client";

import { Footprints, SlidersHorizontal, Sparkles, TimerReset, type LucideIcon } from "lucide-react";
import type { DurationOptions } from "../lib/types";

export type DurationChoice = "minimum" | "recommended" | "custom" | "free";

/** 사용자 지정 산책 시간의 범위와 눈금. 20분 하한의 근거는 walk-tuning.ts 참고. */
export const CUSTOM_MIN_MINUTES = 20;
export const CUSTOM_MAX_MINUTES = 240;
export const CUSTOM_STEP_MINUTES = 10;

const CARD_ICONS: Record<DurationChoice, LucideIcon> = {
  minimum: TimerReset,
  recommended: Sparkles,
  custom: SlidersHorizontal,
  free: Footprints
};

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
  const cappedCustomMinutes = Math.min(customMinutes, sliderMax);
  const sliderProgress = ((cappedCustomMinutes - CUSTOM_MIN_MINUTES) / (sliderMax - CUSTOM_MIN_MINUTES)) * 100;

  const cards: Array<{ value: DurationChoice; title: string; badge: string; hint: string }> = [
    {
      value: "minimum",
      title: "최소 산책",
      badge: "짧게",
      hint: durationOptions ? formatMinutes(durationOptions.minimumMinutes) : "불러오는 중"
    },
    {
      value: "recommended",
      title: "적정 산책",
      badge: "추천",
      hint: durationOptions ? formatMinutes(durationOptions.recommendedMinutes) : "불러오는 중"
    },
    { value: "custom", title: "사용자 지정", badge: formatMinutes(cappedCustomMinutes), hint: "슬라이더로 직접 설정" },
    { value: "free", title: "자유 산책", badge: "자유", hint: "코스 없이" }
  ];

  return (
    <div className="mt-[18px]">
      <p className="text-[12px] font-bold text-ms-muted">산책 시간 선택</p>

      {/* 선택 표시는 체크마크나 링이 아니라 색으로 — meoksa_FE WalkScreen 규칙 그대로 */}
      <div className="mt-[10px] grid grid-cols-2 gap-[10px]">
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.value];
          const isSelected = choice === card.value;

          return (
            <button
              aria-pressed={isSelected}
              className={`h-[108px] overflow-hidden rounded-[18px] p-[12px] text-left shadow-sm transition ${
                isSelected ? "bg-ms-action-green" : "border border-ms-line bg-ms-card"
              }`}
              key={card.value}
              onClick={() => onChoiceChange(card.value)}
              type="button"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`grid h-[32px] w-[32px] place-items-center rounded-[11px] ${
                    isSelected
                      ? "bg-ms-action-green-pressed text-ms-on-green"
                      : "bg-ms-sunken text-ms-emphasis-green"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <span
                  className={`rounded-full px-[8px] py-[4px] text-[10px] font-extrabold ${
                    isSelected ? "bg-ms-action-green-pressed text-ms-on-green" : "bg-ms-sunken text-ms-muted"
                  }`}
                >
                  {card.badge}
                </span>
              </div>
              <p
                className={`mt-[10px] truncate text-[14px] font-extrabold leading-none ${
                  isSelected ? "text-ms-on-green" : "text-ms-ink"
                }`}
              >
                {card.title}
              </p>
              <p
                className={`mt-[7px] truncate text-[11px] font-semibold leading-none ${
                  isSelected ? "text-ms-on-green" : "text-ms-secondary"
                }`}
              >
                {card.hint}
              </p>
            </button>
          );
        })}
      </div>

      {/* 시안(초록 트랙 + 흰 손잡이 안 주황 점) 참고 — .km-slider-* 는 globals.css 참고 */}
      {choice === "custom" && (
        <div className="mt-[10px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-bold text-ms-secondary">목표 시간</p>
            <p className="text-[20px] font-extrabold">{formatMinutes(cappedCustomMinutes)}</p>
          </div>
          <div
            className="km-slider-shell mt-[14px]"
            style={{ "--km-slider-progress": `${sliderProgress}%` } as React.CSSProperties}
          >
            <span className="km-slider-cap km-slider-cap-left" />
            <span className="km-slider-cap km-slider-cap-right" />
            <span className="km-slider-track">
              <span className="km-slider-fill" />
              <span className="km-slider-thumb-visual" />
            </span>
            <input
              aria-label="사용자 지정 산책 시간"
              className="km-slider"
              max={sliderMax}
              min={CUSTOM_MIN_MINUTES}
              onChange={(event) => onCustomMinutesChange(Number(event.target.value))}
              step={CUSTOM_STEP_MINUTES}
              type="range"
              value={cappedCustomMinutes}
            />
          </div>
          <div className="mt-[8px] flex justify-between text-[11px] font-semibold text-ms-muted">
            <span>{formatMinutes(CUSTOM_MIN_MINUTES)}</span>
            <span>{formatMinutes(sliderMax)}</span>
          </div>
          {isCappedByDog && (
            <p className="mt-[8px] text-[11px] font-semibold text-ms-muted">
              이 강아지에게 권장되는 상한이 {formatMinutes(sliderMax)}이라 여기까지만 고를 수 있어요.
            </p>
          )}
        </div>
      )}

      {choice === "free" && (
        <p className="mt-[10px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] text-[13px] font-semibold text-ms-secondary shadow-sm">
          코스를 추천하지 않고 바로 산책을 시작해요. 걸은 거리와 경로는 그대로 기록돼요.
        </p>
      )}
    </div>
  );
}
