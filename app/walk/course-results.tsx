"use client";

import { AlertTriangle, ChevronLeft, RefreshCw, ShieldAlert, Trees } from "lucide-react";
import { formatMeters, formatPercent } from "../lib/format";
import type { RecommendedCourse } from "../lib/types";
import { Button } from "../ui";

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
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft size={17} /> 시간 다시 고르기
        </Button>
        <Button disabled={isBusy} type="button" variant="outline" onClick={onRefresh}>
          <RefreshCw className={isBusy ? "animate-spin" : undefined} size={17} /> 다시 추천받기
        </Button>
      </div>

      {warnings.length > 0 && (
        <div className="grid gap-2">
          {warnings.map((warning) => (
            <div
              className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm font-bold text-yellow-900"
              key={`${warning.code}-${warning.message}`}
            >
              <AlertTriangle size={18} />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {courses.map((course) => (
          <button
            className={`grid gap-3 rounded-lg border p-4 text-left shadow-sm ${
              selectedRank === course.rank ? "border-primary bg-green-50" : "border-border bg-white"
            }`}
            key={course.rank}
            type="button"
            onClick={() => onSelectRank(course.rank)}
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="text-base font-black">
                {course.rank}순위 / {course.direction}
              </strong>
              <span className="rounded-full bg-primary px-2 py-1 text-xs font-black text-primary-foreground">
                {course.score}점
              </span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              {course.aiExplanation ?? course.explanation?.summary}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm font-bold sm:grid-cols-4">
              <span>{formatMeters(course.distanceMeters)}</span>
              <span>{course.durationMinutes}분</span>
              <span className="flex items-center gap-1">
                <ShieldAlert size={15} /> 위험 {course.facts.riskZoneCount}곳
              </span>
              <span className="flex items-center gap-1">
                <Trees size={15} /> 공원 {formatPercent(course.facts.parkRatio)}
              </span>
            </div>
            {selectedRank === course.rank && course.explanation?.factors && (
              <details className="rounded-md bg-white p-3 text-sm">
                <summary className="cursor-pointer font-black">점수 계산 보기</summary>
                <div className="mt-3 grid gap-2">
                  {course.explanation.factors.map((factor) => (
                    <div className="rounded-md bg-muted p-2" key={factor.key}>
                      <strong>{factor.label}</strong>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">
                        점수 {factor.score} / 가중치 {factor.weight} / 반영 {factor.contribution}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{factor.detail}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
