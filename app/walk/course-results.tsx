"use client";

import { AlertTriangle, ChevronLeft, RefreshCw, ShieldAlert, Trees } from "lucide-react";
import { formatMeters, formatPercent } from "../lib/format";
import type { RecommendedCourse } from "../lib/types";

export function CourseResults({
  courses,
  selectedRank,
  warnings,
  isBusy,
  onSelectRank,
  onBack,
  onRefresh
}: {
  courses: RecommendedCourse[];
  selectedRank: number;
  warnings: Array<{ level: string; code: string; message: string }>;
  isBusy: boolean;
  onSelectRank: (rank: number) => void;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="grid gap-[12px]">
      <div className="grid grid-cols-2 gap-[10px]">
        <button
          className="flex h-[44px] items-center justify-center gap-[6px] rounded-full border border-ms-line bg-ms-card text-[13px] font-bold text-ms-ink shadow-sm active:bg-ms-sunken"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft size={16} /> 시간 다시 고르기
        </button>
        <button
          className="flex h-[44px] items-center justify-center gap-[6px] rounded-full border border-ms-line bg-ms-card text-[13px] font-bold text-ms-ink shadow-sm active:bg-ms-sunken disabled:opacity-60"
          disabled={isBusy}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw className={isBusy ? "animate-spin" : undefined} size={16} /> 다시 추천받기
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="grid gap-[8px]">
          {warnings.map((warning) => (
            <div
              className="flex items-start gap-[8px] rounded-[14px] bg-ms-warn-bg px-[14px] py-[12px] text-[12px] font-bold text-ms-warn-fg"
              key={`${warning.code}-${warning.message}`}
            >
              <AlertTriangle size={16} />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-[10px]">
        {courses.map((course) => {
          const isSelected = selectedRank === course.rank;

          return (
            <button
              className={`grid gap-[10px] rounded-[18px] p-[16px] text-left shadow-sm transition ${
                isSelected ? "bg-ms-action-green" : "border border-ms-line bg-ms-card"
              }`}
              key={course.rank}
              onClick={() => onSelectRank(course.rank)}
              type="button"
            >
              <div className="flex items-center justify-between gap-[10px]">
                <strong
                  className={`text-[15px] font-extrabold ${isSelected ? "text-ms-on-green" : "text-ms-ink"}`}
                  title={`${course.direction} 방향`}
                >
                  {course.rank}순위 · {course.courseName ?? course.direction}
                </strong>
                <span
                  className={`shrink-0 rounded-full px-[10px] py-[5px] text-[11px] font-extrabold ${
                    isSelected ? "bg-ms-action-green-pressed text-ms-on-green" : "bg-ms-sunken text-ms-emphasis-green"
                  }`}
                >
                  {course.score}점
                </span>
              </div>
              <p className={`text-[12px] font-semibold ${isSelected ? "text-ms-on-green" : "text-ms-secondary"}`}>
                {course.aiExplanation ?? course.explanation?.summary}
              </p>
              <div
                className={`grid grid-cols-2 gap-[8px] text-[12px] font-bold sm:grid-cols-4 ${
                  isSelected ? "text-ms-on-green" : "text-ms-ink"
                }`}
              >
                <span>{formatMeters(course.distanceMeters)}</span>
                <span>{course.durationMinutes}분</span>
                <span className="flex items-center gap-[4px]">
                  <ShieldAlert size={13} /> 위험 {course.facts.riskZoneCount}곳
                </span>
                <span className="flex items-center gap-[4px]">
                  <Trees size={13} /> 공원 {formatPercent(course.facts.parkRatio)}
                </span>
              </div>
              {isSelected && (
                <details className="rounded-[14px] bg-ms-sunken p-[12px] text-[12px]">
                  <summary className="cursor-pointer font-extrabold text-ms-ink">
                    이 코스 산책 시 고려사항
                  </summary>
                  <div className="mt-[10px] grid gap-[6px]">
                    {course.cautions && course.cautions.length > 0 ? (
                      course.cautions.map((caution) => (
                        <div
                          className="flex items-start gap-[6px] rounded-[10px] bg-ms-card p-[10px] text-[11px] font-semibold text-ms-secondary"
                          key={caution}
                        >
                          <ShieldAlert className="mt-[1px] shrink-0" size={13} />
                          <span>{caution}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[10px] bg-ms-card p-[10px] text-[11px] font-semibold text-ms-secondary">
                        이 코스는 특별히 주의할 점이 없어요.
                      </div>
                    )}
                  </div>
                </details>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
