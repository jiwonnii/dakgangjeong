"use client";

import { CalendarCheck, ChevronRight, CloudSun, PawPrint, Lock, Pill, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PetBowlIcon } from "../_components/PetBowlIcon";
import { useAuth } from "../auth-context";
import { getApproximateCurrentOrigin } from "../lib/geolocation";
import type { CareTodayResponse, WarningsResponse } from "../lib/types";
import { NotificationBell } from "../notification-bell";
import type { StreakResponse, WalkRecord, WalkRecordListResponse } from "../records/record-utils";
import { kstDateKeyFromIso, toDateKey } from "../records/record-utils";

// 적정 산책 범위(km). 강아지별 맞춤 범위를 계산해 주는 엔드포인트가 아직
// 없어서, 밴드 시각화만을 위한 고정값을 그대로 쓴다.
const BAND_MIN = 1.5;
const BAND_MAX = 3;

const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 요약 슬라이드 좌우 여백과 카드 사이 간격
const SUMMARY_PAD = 24;
const SUMMARY_GAP = 10;

// 월간 요약 티저 카드의 배경 장식(원 무더기).
const BUBBLE_SIZE = 58;
const BUBBLE_STEP = 60;
const BUBBLE_DOTS = Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: 5 }, (_, col) => ({
    key: `${row}-${col}`,
    right: col * BUBBLE_STEP - (row % 2 === 1 ? BUBBLE_STEP / 2 : 0) - 16,
    top: row * BUBBLE_STEP - 46
  }))
).flat();

// 차트 좌표계. 값이 클수록 위로 간다.
const CHART_W = 300;
const CHART_H = 128;
const PAD_X = 14;
const PAD_Y = 20;

function xFor(index: number, count: number) {
  return PAD_X + (index * (CHART_W - PAD_X * 2)) / Math.max(1, count - 1);
}

function yFor(km: number, chartMax: number) {
  return PAD_Y + (1 - km / chartMax) * (CHART_H - PAD_Y * 2);
}

// 밴드 경계를 부드러운 곡선으로 잇는다(Catmull-Rom → 3차 베지어).
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const BAND_MID = (BAND_MIN + BAND_MAX) / 2;
const WAVE_AMPLITUDE = 0.35; // km 단위. 중심선이 흔들리는 폭

// 밴드를 3겹의 굵은 곡선 스트로크로 쌓는다. 같은 파형을 픽셀 단위로 위/아래로
// 밀어서 겹치므로 세 밴드가 항상 평행하고, 시작/끝 x좌표도 동일하게 맞는다.
// 위로 갈수록 진하고 얇게, 아래로(데이터 선에 가까울수록) 연하고 굵게 배치한다.
const BAND_STROKE_WIDTH = 10; // px
const BAND_LAYER_GAP = 16; // px, 밴드 사이 수직 간격
const BAND_LAYERS = [
  { shiftPx: BAND_LAYER_GAP, colorVar: "--band-fill-top" },
  { shiftPx: 0, colorVar: "--band-fill-solid" },
  { shiftPx: -BAND_LAYER_GAP, colorVar: "--band-fill-bottom" }
];

type DayPoint = { dateKey: string; label: string; km: number; walkCount: number };

type WarningEntry = WarningsResponse["warnings"][number];

/**
 * 오늘의 산책 경고 문구를 강아지 이름을 넣어 더 구체적으로 바꾼다(표시 전용).
 * 실제 경고 판단(warning-check.ts)은 건드리지 않고, 이미 내려온 메시지를
 * type 값으로 구분해 문장만 다시 쓴다. 알 수 없는 type이 오면 기존 메시지
 * 앞에 이름을 붙이는 방식으로 안전하게 대체한다.
 */
function hasFinalConsonant(text: string): boolean {
  const lastChar = text.trim().slice(-1);
  const code = lastChar.charCodeAt(0);

  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }

  return (code - 0xac00) % 28 !== 0;
}

function subjectParticle(name: string) {
  return hasFinalConsonant(name) ? "이" : "가";
}

function topicParticle(name: string) {
  return hasFinalConsonant(name) ? "은" : "는";
}

function personalizeWarningMessage(warning: WarningEntry, dogName: string): string {
  const i = subjectParticle(dogName);
  const eun = topicParticle(dogName);

  switch (warning.type) {
    case "summer_daytime_heat":
      return `오늘은 기온이 높아서 아스팔트에 ${dogName}${i} 화상을 입을 수 있어요. 저녁 7시 이후 산책을 권해요.`;
    case "winter_deicer":
      return `최근 눈이 온 지역이라 제설제가 남아있을 수 있어요. ${dogName}${eun} 산책 후 발을 꼭 닦아주세요.`;
    case "heat":
      return warning.level === "danger"
        ? `체감온도가 많이 높아요. ${dogName}${eun} 열사병 위험이 있으니 오늘 산책은 미루는 게 좋아요.`
        : `날이 더워요. ${dogName}${i} 지치지 않도록 짧게, 그늘 위주로 다녀오세요.`;
    case "cold":
      return warning.level === "danger"
        ? `너무 추워요. ${dogName}${eun} 저체온증 위험이 있으니 오늘 산책은 미루는 게 좋아요.`
        : `날이 추워요. ${dogName}${eun} 짧게 걷고 발 보호를 신경 써주세요.`;
    case "pm10":
    case "pm25":
      return warning.level === "danger"
        ? `미세먼지가 매우 나빠요. ${dogName}${i} 호흡기에 무리가 갈 수 있어 오늘은 산책을 짧게 하거나 미루는 게 좋아요.`
        : `미세먼지가 나쁜 편이에요. ${dogName}${eun} 오래 걷지 않는 게 좋아요.`;
    case "precipitation":
      return warning.level === "danger"
        ? `호우·대설 특보 수준이에요. ${dogName}${eun} 오늘 산책은 피해주세요.`
        : `비나 눈 소식이 있어요. ${dogName}${eun} 젖지 않도록 우산이나 방수 용품을 챙기세요.`;
    default:
      return `${dogName}${i} 오늘 조심해야 해요: ${warning.message}`;
  }
}

/** 오늘을 포함해 최근 7일을 과거→오늘 순서로 만든다. */
function buildTrailingWeek(): DayPoint[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    return {
      dateKey: toDateKey(date),
      label: WEEK_LABELS[date.getDay()],
      km: 0,
      walkCount: 0
    };
  });
}

const VERDICT_COPY: Record<
  "loading" | "unknown" | "normal" | "caution" | "danger",
  { headline: React.ReactNode; badge: string }
> = {
  loading: { headline: "오늘 산책 정보를 확인하고 있어요", badge: "확인 중" },
  unknown: { headline: "오늘 산책 판단을 확인할 수 없어요", badge: "알 수 없음" },
  normal: {
    headline: (
      <>
        오늘은 <span className="text-ms-emphasis">조금 더</span> 걸어도
        <br />
        좋은 날이에요
      </>
    ),
    badge: "좋음"
  },
  caution: {
    headline: (
      <>
        오늘은 <span className="text-ms-emphasis">조금 주의</span>가<br />
        필요한 날이에요
      </>
    ),
    badge: "주의"
  },
  danger: {
    headline: (
      <>
        오늘은 산책을<br />
        <span className="text-ms-emphasis">자제</span>하는 게 좋아요
      </>
    ),
    badge: "지양"
  }
};

export function MainTab() {
  const { api, options, primaryDog } = useAuth();

  const [warnings, setWarnings] = useState<WarningsResponse | null>(null);
  const [warningsError, setWarningsError] = useState("");
  const [isWarningsLoading, setIsWarningsLoading] = useState(true);

  const [care, setCare] = useState<CareTodayResponse | null>(null);

  const [records, setRecords] = useState<WalkRecord[]>([]);
  const [streak, setStreak] = useState<StreakResponse | null>(null);

  const [summarySlide, setSummarySlide] = useState(0);

  const dogId = primaryDog?.id ?? "";

  useEffect(() => {
    if (!dogId) {
      return;
    }

    let cancelled = false;
    setIsWarningsLoading(true);
    setWarningsError("");

    getApproximateCurrentOrigin()
      .then((origin) => {
        const query = new URLSearchParams({ dogId, lat: String(origin.lat), lon: String(origin.lon) });
        return api<WarningsResponse>(`/api/walk-routes/warnings?${query.toString()}`);
      })
      .then((payload) => {
        if (!cancelled) {
          setWarnings(payload);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWarningsError(err instanceof Error ? err.message : "산책 판단을 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsWarningsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId]);

  useEffect(() => {
    if (!dogId) {
      return;
    }

    let cancelled = false;

    api<CareTodayResponse>(`/api/care/today?dogId=${encodeURIComponent(dogId)}`)
      .then((payload) => {
        if (!cancelled) {
          setCare(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCare(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId]);

  useEffect(() => {
    if (!dogId) {
      return;
    }

    let cancelled = false;
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const query = new URLSearchParams({
      dogId,
      from: from.toISOString(),
      to: new Date().toISOString(),
      limit: "100",
      offset: "0"
    });

    api<WalkRecordListResponse>(`/api/walk-records?${query.toString()}`)
      .then((payload) => {
        if (!cancelled) {
          setRecords(payload.records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecords([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId]);

  useEffect(() => {
    if (!dogId) {
      return;
    }

    let cancelled = false;

    api<StreakResponse>(`/api/walk-records/streak?dogId=${encodeURIComponent(dogId)}`)
      .then((payload) => {
        if (!cancelled) {
          setStreak(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStreak(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId]);

  const week = useMemo(() => {
    const days = buildTrailingWeek();
    const byDateKey = new Map(days.map((day) => [day.dateKey, day]));

    records.forEach((record) => {
      const key = kstDateKeyFromIso(record.startedAt);
      const day = byDateKey.get(key);
      if (day) {
        day.km += (record.distanceMeters ?? 0) / 1000;
        day.walkCount += 1;
      }
    });

    return days;
  }, [records]);

  const weekKm = week.map((day) => day.km);
  const chartMax = Math.max(4, Math.ceil(Math.max(...weekKm, 0)));
  const weekTotal = weekKm.reduce((sum, value) => sum + value, 0);
  const walkedDays = weekKm.filter((value) => value > 0).length;
  const weekAverage = week.length > 0 ? weekTotal / week.length : 0;
  const last5Days = week.slice(-5);
  const walkCountMax = Math.max(1, ...last5Days.map((day) => day.walkCount));
  const todayKm = week[week.length - 1]?.km ?? 0;

  const bandCenters = week.map((_, index) => BAND_MID + WAVE_AMPLITUDE * Math.sin(index * 1.1 + 0.6));
  const bandLayerPaths = BAND_LAYERS.map(({ shiftPx }) =>
    smoothPath(
      bandCenters.map((center, index) => ({
        x: xFor(index, week.length),
        y: yFor(center, chartMax) - shiftPx
      }))
    )
  );
  // 실제 산책 데이터 선도 밴드와 같은 방식(Catmull-Rom)으로 곡선화해서,
  // 시작점·끝점이 각 요일 x좌표에 정확히 물리도록 한다.
  const linePoints = weekKm.map((km, index) => ({ x: xFor(index, week.length), y: yFor(km, chartMax) }));
  const linePath = smoothPath(linePoints);

  const careRows = useMemo(() => {
    const tasks = care?.tasks ?? [];
    return (["feed", "medicine"] as const).map((taskType) => {
      const ofType = tasks.filter((task) => task.taskType === taskType);
      const done = ofType.filter((task) => task.status === "completed").length;
      const total = ofType.length;
      return {
        taskType,
        label: taskType === "feed" ? "밥" : "약",
        icon: taskType === "feed" ? PetBowlIcon : Pill,
        done,
        total,
        detail: total === 0 ? "등록된 일정이 없어요" : done >= total ? "완료" : `${total - done}회 남음`
      };
    });
  }, [care]);

  const verdictKey = isWarningsLoading
    ? "loading"
    : warningsError || !warnings
      ? "unknown"
      : warnings.overallLevel;
  const verdict = VERDICT_COPY[verdictKey];
  const dogNameForWarnings = primaryDog?.name ?? "반려견";
  const heroSubtext =
    verdictKey === "loading" || verdictKey === "unknown"
      ? warningsError || "위치를 확인하고 오늘 산책 상태를 판단하고 있어요."
      : verdictKey === "normal"
        ? `지금까지 오늘 ${todayKm.toFixed(1)}km 걸었어요. 적정 범위까지 조금 남았습니다.`
        : (warnings?.warnings ?? [])
            .map((warning) => personalizeWarningMessage(warning, dogNameForWarnings))
            .join(" ") || "오늘은 평소보다 가볍게 산책해 보세요.";

  const firstWarning = (warnings?.warnings ?? [])[0];
  const weatherLine =
    verdictKey === "loading" || verdictKey === "unknown"
      ? "산책 판단을 준비하고 있어요"
      : firstWarning
        ? personalizeWarningMessage(firstWarning, dogNameForWarnings)
        : "특별한 주의사항이 없어요.";

  function handleSummaryScroll(event: React.UIEvent<HTMLDivElement>) {
    const track = event.currentTarget;
    const panel = track.firstElementChild;
    const step = panel ? panel.getBoundingClientRect().width + SUMMARY_GAP : track.clientWidth;
    setSummarySlide(Math.round(track.scrollLeft / step));
  }

  // 강아지가 없으면 AppShell 이 등록 안내로 대체하므로 여기까지 오지 않는다.
  if (!primaryDog) {
    return null;
  }

  const tags = primaryDog.personality_tags ?? [];
  const labelByValue = new Map((options?.personalityTags ?? []).map((tag) => [tag.value, tag.label]));
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(
    new Date()
  );
  const currentMonthLabel = `${new Date().getMonth() + 1}월`;

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page">
      <div className="w-full max-w-[375px] pb-[104px] text-ms-ink">
        <header className="flex h-[72px] items-center justify-between px-[24px]">
          <img alt="산책가개" className="h-[40px] w-[40px] rounded-[12px]" src="/logo.png" />
          <NotificationBell
            buttonClassName="relative grid h-[40px] w-[40px] place-items-center rounded-full bg-ms-sunken text-ms-ink"
            dogId={primaryDog.id}
            panelClassName="absolute right-0 top-[48px] z-20 w-[292px] rounded-[22px] border border-ms-line bg-ms-card p-[14px] text-ms-ink shadow-sm"
          />
        </header>

        {/* 히어로: 숫자가 아니라 해석 문장이 먼저 온다 — 오늘의 산책 판단(경고) 결과로 결정된다 */}
        <section className="px-[24px] pt-[8px]">
          <p className="text-[13px] font-medium text-ms-secondary">
            {primaryDog.name} · {todayLabel}
          </p>
          <h1 className="mt-[10px] text-[23px] font-bold leading-[1.45] tracking-[-0.01em]">{verdict.headline}</h1>
          <p className="mt-[12px] text-[14px] leading-[1.6] text-ms-secondary">{heroSubtext}</p>
        </section>

        {/* 오늘의 산책 판단 카드. 산책 시작 버튼이 여기 있다 */}
        <section className="mt-[22px] px-[24px]">
          <div className="rounded-[20px] bg-ms-weather p-[18px] text-center">
            <div className="flex items-center justify-center">
              <CloudSun className="text-ms-ink" size={28} strokeWidth={1.7} />
            </div>
            <p className="mt-[10px] text-[15px] font-bold leading-none">오늘의 산책 · {verdict.badge}</p>
            <p className="mt-[6px] text-[13px] leading-[1.5] text-ms-secondary">{weatherLine}</p>
            <Link
              className="mt-[14px] flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[16px] bg-ms-action-green text-[16px] font-bold text-ms-on-green active:opacity-90"
              href="/walk"
            >
              <Play fill="currentColor" size={16} strokeWidth={2.2} />
              산책 시작하기
            </Link>
          </div>
        </section>

        {/* 적정 범위 밴드. 색이 판단을 맡고, 검정 선이 사실을 맡는다. */}
        <section className="mt-[28px] px-[24px]">
          <div className="rounded-[20px] bg-ms-card p-[18px] shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">이번 주 산책</h2>
              <p className="text-[13px] font-medium text-ms-secondary">
                합계 <span className="font-bold text-ms-ink">{weekTotal.toFixed(1)}km</span>
              </p>
            </div>

            <svg
              aria-label={`이번 주 산책 거리. 합계 ${weekTotal.toFixed(1)}km, 적정 범위 하루 ${BAND_MIN}~${BAND_MAX}km`}
              className="mt-[14px] w-full"
              role="img"
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            >
              {BAND_LAYERS.map((layer, index) => (
                <path
                  d={bandLayerPaths[index]}
                  fill="none"
                  key={layer.colorVar}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={BAND_STROKE_WIDTH}
                  style={{ stroke: `var(${layer.colorVar})` }}
                />
              ))}

              <path
                d={linePath}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                style={{ stroke: "var(--band-line)" }}
              />

              {weekKm.map((km, index) => (
                <circle
                  cx={xFor(index, week.length)}
                  cy={yFor(km, chartMax)}
                  key={week[index].dateKey}
                  r="3.5"
                  strokeWidth="2.5"
                  style={{ fill: "var(--band-point)", stroke: "var(--band-line)" }}
                />
              ))}
            </svg>

            <ul className="mt-[8px] flex justify-between px-[10px] text-[11px] font-semibold text-ms-muted">
              {week.map((day) => (
                <li key={day.dateKey}>{day.label}</li>
              ))}
            </ul>

            <p className="mt-[14px] text-[13px] font-medium leading-[1.6] text-ms-secondary">
              초록 구간이 {primaryDog.name}에게 맞는 하루 {BAND_MIN}~{BAND_MAX}km예요. 넘겨도 모자라도 범위
              밖입니다.
            </p>
          </div>
        </section>

        <section className="mt-[28px] px-[24px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">웰빙</h2>
            <Link className="flex items-center gap-[2px] text-[13px] font-medium text-ms-secondary" href="/sharing">
              전체
              <ChevronRight size={16} strokeWidth={1.8} />
            </Link>
          </div>

          <ul className="mt-[12px] grid grid-cols-2 gap-[10px]">
            {/* 산책 타일: 최근 5일 실제 산책 횟수를 캡슐 5개로 보여준다 */}
            <li className="h-[148px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
              <div className="flex items-start justify-between">
                <PawPrint className="text-ms-secondary" size={19} strokeWidth={2} />
                <span className="rounded-full bg-ms-ok-bg px-[9px] py-[4px] text-[12px] font-bold text-ms-ok-fg">
                  {last5Days[last5Days.length - 1]?.walkCount ?? 0}회
                </span>
              </div>
              <p className="mt-[14px] text-[14px] font-bold leading-none">산책</p>

              <div className="mt-[10px] flex items-end justify-between gap-[4px]">
                {last5Days.map((day) => (
                  <div className="flex flex-1 flex-col items-center gap-[4px]" key={day.dateKey}>
                    <div className="h-[28px] w-[10px] overflow-hidden rounded-full bg-ms-sunken">
                      <div
                        className="w-full rounded-full bg-ms-brand"
                        style={{
                          height: `${(day.walkCount / walkCountMax) * 100}%`,
                          marginTop: `${100 - (day.walkCount / walkCountMax) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-ms-muted">{day.label}</span>
                  </div>
                ))}
              </div>
            </li>

            {careRows.map((item) => {
              const Icon = item.icon;
              const isDone = item.total > 0 && item.done === item.total;

              return (
                <li
                  className="h-[148px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] shadow-sm"
                  key={item.taskType}
                >
                  <div className="flex items-start justify-between">
                    <Icon className="text-ms-secondary" size={19} strokeWidth={2} />
                    <span
                      className={`rounded-full px-[9px] py-[4px] text-[12px] font-bold ${
                        isDone ? "bg-ms-ok-bg text-ms-ok-fg" : "bg-ms-sunken text-ms-secondary"
                      }`}
                    >
                      {item.done}/{item.total}
                    </span>
                  </div>
                  <p className="mt-[14px] text-[14px] font-bold leading-none">{item.label}</p>
                  <p className="mt-[7px] text-[12px] leading-[1.4] text-ms-muted">{item.detail}</p>
                </li>
              );
            })}

            <li
              className="relative flex h-[148px] flex-col items-center justify-center gap-[10px] overflow-hidden rounded-[18px] shadow-sm"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--brand) 28%, white) 0%, var(--p-white) 55%)"
              }}
            >
              <span
                aria-hidden="true"
                className="block h-[34px] w-[34px]"
                style={{
                  backgroundColor: "var(--brand)",
                  WebkitMaskImage: "url(/불꽃.png)",
                  maskImage: "url(/불꽃.png)",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center"
                }}
              />
              <p className="text-[14px] font-extrabold leading-none text-ms-ink">
                {streak?.streakDays ?? 0}일 연속 달성
              </p>
              {streak && !streak.walkedToday ? (
                <p className="text-[11px] font-bold text-ms-muted">오늘 산책하면 이어져요</p>
              ) : null}
            </li>
          </ul>

          {tags.length > 0 ? (
            <div className="mt-[10px] flex flex-wrap gap-[6px]">
              {tags.map((tag) => (
                <span
                  className="rounded-full bg-ms-sunken px-[10px] py-[5px] text-[12px] font-bold text-ms-secondary"
                  key={tag}
                >
                  {labelByValue.get(tag) ?? tag}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {/* 내 활동 요약: 월간(유료) → 옆으로 넘기면 주간(무료) */}
        <section className="mt-[28px]">
          <div className="flex items-center justify-between px-[24px]">
            <h2 className="text-[15px] font-bold">내 활동 요약</h2>
            <div className="flex gap-[5px]">
              {[0, 1].map((index) => (
                <span
                  className={`h-[6px] rounded-full transition-all ${
                    summarySlide === index ? "w-[16px] bg-ms-emphasis" : "w-[6px] bg-ms-line-strong"
                  }`}
                  key={index}
                />
              ))}
            </div>
          </div>

          <div
            className="mt-[12px] flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={handleSummaryScroll}
            style={{
              gap: SUMMARY_GAP,
              paddingInline: SUMMARY_PAD,
              scrollPaddingInline: SUMMARY_PAD
            }}
          >
            <article className="relative w-full flex-none snap-start overflow-hidden rounded-[20px] bg-ms-card p-[18px] shadow-sm">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  maskImage: "linear-gradient(125deg, transparent 12%, black 55%)",
                  WebkitMaskImage: "linear-gradient(125deg, transparent 12%, black 55%)"
                }}
              >
                {BUBBLE_DOTS.map((dot) => (
                  <span
                    className="absolute rounded-full bg-ms-sunken"
                    key={dot.key}
                    style={{
                      height: BUBBLE_SIZE,
                      right: dot.right,
                      top: dot.top,
                      width: BUBBLE_SIZE
                    }}
                  />
                ))}
              </div>

              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold">월간</p>
                  <span className="flex items-center gap-[4px] rounded-full bg-ms-sunken px-[9px] py-[4px] text-[11px] font-bold text-ms-secondary">
                    <Lock size={11} strokeWidth={2.4} />
                    유료
                  </span>
                </div>
                <p className="mt-[10px] text-[32px] font-extrabold leading-none">{currentMonthLabel}</p>
                <p className="mt-[14px] text-[13px] leading-[1.6] text-ms-secondary">
                  한 달치 산책 추이와 {primaryDog.name}의 활동량 변화는 유료 플랜에서 볼 수 있어요.
                </p>
                <Link
                  className="mt-[16px] flex h-[42px] w-full items-center justify-center rounded-[14px] bg-ms-brand text-[14px] font-bold text-ms-on-brand active:bg-ms-brand-pressed"
                  href="/records"
                >
                  월간 요약 열기
                </Link>
              </div>
            </article>

            <article className="w-full flex-none snap-start rounded-[20px] bg-ms-weekly p-[18px] text-ms-on-weekly shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold">주간 요약</p>
                <span className="rounded-full bg-white px-[9px] py-[4px] text-[11px] font-bold text-ms-weekly">
                  무료
                </span>
              </div>
              <dl className="mt-[14px] grid grid-cols-3 gap-[8px]">
                <div>
                  <dt className="text-[12px] text-ms-on-weekly-secondary">총 거리</dt>
                  <dd className="mt-[6px] text-[18px] font-bold">{weekTotal.toFixed(1)}km</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-ms-on-weekly-secondary">산책한 날</dt>
                  <dd className="mt-[6px] text-[18px] font-bold">{walkedDays}일</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-ms-on-weekly-secondary">하루 평균</dt>
                  <dd className="mt-[6px] text-[18px] font-bold">{weekAverage.toFixed(1)}km</dd>
                </div>
              </dl>
              <p className="mt-[14px] text-[13px] leading-[1.6] text-ms-on-weekly-secondary">
                최근 기록 {records.length}개를 기준으로 이번 주 산책 리듬을 정리했어요.
              </p>
              <Link
                className="mt-[16px] flex h-[42px] w-full items-center justify-center rounded-[14px] bg-white text-[14px] font-bold text-ms-weekly active:bg-white/90"
                href="/records"
              >
                주간 요약 열기
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
