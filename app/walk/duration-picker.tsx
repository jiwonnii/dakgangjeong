"use client";

import { PawPrint, SlidersHorizontal, Sparkles, TimerReset, type LucideIcon } from "lucide-react";
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
  free: PawPrint
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
  const tickValues = Array.from(
    { length: Math.round((sliderMax - CUSTOM_MIN_MINUTES) / CUSTOM_STEP_MINUTES) + 1 },
    (_, index) => CUSTOM_MIN_MINUTES + index * CUSTOM_STEP_MINUTES
  );

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
              className={`h-[108px] overflow-hidden rounded-[18px] p-[12px] text-left transition ${
                isSelected ? "border border-ms-brand" : "border border-transparent bg-ms-sunken"
              }`}
              key={card.value}
              onClick={() => onChoiceChange(card.value)}
              style={isSelected ? { backgroundColor: "color-mix(in srgb, var(--brand) 12%, white)" } : undefined}
              type="button"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`grid h-[32px] w-[32px] place-items-center rounded-[11px] ${
                    isSelected ? "bg-white text-ms-brand" : "bg-ms-card text-ms-emphasis-green"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <span className="flex items-center gap-[6px]">
                  <span
                    className={`rounded-full px-[8px] py-[4px] text-[10px] font-extrabold ${
                      isSelected ? "bg-white text-ms-brand" : "bg-ms-card text-ms-muted"
                    }`}
                  >
                    {card.badge}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full border-2 ${
                      isSelected ? "border-ms-brand" : "border-ms-line-strong"
                    }`}
                  >
                    {isSelected ? <span className="h-[6px] w-[6px] rounded-full bg-ms-brand" /> : null}
                  </span>
                </span>
              </div>
              <p
                className={`mt-[10px] truncate text-[14px] font-extrabold leading-none ${
                  isSelected ? "text-ms-brand" : "text-ms-ink"
                }`}
              >
                {card.title}
              </p>
              <p
                className={`mt-[7px] truncate text-[11px] font-semibold leading-none ${
                  isSelected ? "text-ms-brand" : "text-ms-secondary"
                }`}
              >
                {card.hint}
              </p>
            </button>
          );
        })}
      </div>

      {/* 시안(눈금자 스타일) 참고 — 실제 조작은 투명한 type=range input이 맡고,
          눈금은 그 위에 장식으로 그린다. */}
      {choice === "custom" && (
        <div className="mt-[10px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
          <div className="text-center">
            <p className="text-[13px] font-bold text-ms-secondary">목표 시간</p>
            <p className="mt-[6px] text-[36px] font-extrabold leading-none">{cappedCustomMinutes}</p>
            <p className="mt-[4px] text-[11px] font-bold text-ms-muted">분</p>
          </div>

          <div className="relative mt-[18px] h-[32px]">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between">
              {tickValues.map((tickValue) => (
                <span
                  className={`w-[2px] rounded-full ${
                    tickValue === cappedCustomMinutes ? "h-[26px] bg-ms-ink" : "h-[12px] bg-ms-line-strong"
                  }`}
                  key={tickValue}
                />
              ))}
            </div>
            <input
              aria-label="사용자 지정 산책 시간"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
