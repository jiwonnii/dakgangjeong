"use client";

import {
  Clock3,
  Gauge,
  MapPin,
  Pause,
  Play,
  Route,
  Save,
  Square
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  routeGeoJsonToPolyline,
  useWalkRecordingController,
  type WalkPolylinePoint,
  type WalkRecordRecommendedCourse,
  type WalkRecordRouteGeoJson
} from "./walkTracking";
import { Button, Input } from "./ui";
import { WalkActiveRouteMap } from "./walk-active-route-map";

type WalkRecorderPanelProps = {
  token: string;
  dogId: string;
  dogName: string;
  kakaoMapAppKey: string;
  selectedCourse: {
    rank: number;
    direction: string;
    courseName?: string;
    distanceMeters: number;
    durationMinutes: number;
    score: number;
    aiExplanation?: string;
    explanation?: {
      summary?: string;
      factors?: Array<{
        key: string;
        label: string;
        score?: number;
        weight?: number;
        contribution?: number;
        detail?: string;
        preferenceAdjustment?: number;
      }>;
    };
    cautions?: string[];
    facts?: Record<string, unknown>;
    path?: WalkRecordRouteGeoJson;
  } | null;
  /**
   * 자유 산책처럼 바깥에서 산책을 시작시키고 싶을 때 쓰는 신호.
   * 값이 늘어날 때마다 한 번 시작한다. 이미 걷는 중이면 무시한다.
   * (작업 3에서 산책 중 화면을 제대로 배치할 때 다시 손볼 자리다.)
   */
  startSignal?: number;
  onWalkCompleted?: () => void;
  onWalkStatusChange?: (status: "idle" | "active" | "review") => void;
};

const DEFAULT_MAP_CENTER: WalkPolylinePoint = { latitude: 37.5665, longitude: 126.978 };

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
}

function formatKilometers(meters: number) {
  return (meters / 1000).toFixed(2);
}

function formatAverageSpeed(distanceMeters: number, elapsedSeconds: number) {
  if (elapsedSeconds <= 0) {
    return "--";
  }

  const metersPerSecond = distanceMeters / elapsedSeconds;
  const kilometersPerHour = metersPerSecond * 3.6;
  return `${kilometersPerHour.toFixed(1)} km/h`;
}

function coursePathToPolyline(course: WalkRecorderPanelProps["selectedCourse"]): WalkPolylinePoint[] {
  return (
    course?.path?.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude
    })) ?? []
  );
}

function selectedCourseToRecommendedCourse(
  course: WalkRecorderPanelProps["selectedCourse"]
): WalkRecordRecommendedCourse | undefined {
  if (!course) {
    return undefined;
  }

  return {
    rank: course.rank,
    direction: course.direction,
    courseName: course.courseName,
    distanceMeters: course.distanceMeters,
    durationMinutes: course.durationMinutes,
    score: course.score,
    aiExplanation: course.aiExplanation,
    explanation: course.explanation,
    cautions: course.cautions,
    facts: course.facts,
    path: course.path ?? { type: "LineString", coordinates: [] }
  };
}

export function WalkRecorderPanel({
  token,
  dogId,
  dogName,
  kakaoMapAppKey,
  selectedCourse,
  startSignal,
  onWalkCompleted,
  onWalkStatusChange
}: WalkRecorderPanelProps) {
  const walk = useWalkRecordingController({ apiBaseUrl: "", token, dogId });
  const [rating, setRating] = useState(5);
  const [likedNotes, setLikedNotes] = useState("");
  const [dislikedNotes, setDislikedNotes] = useState("");
  const [likedFactor, setLikedFactor] = useState("");
  const [dislikedFactor, setDislikedFactor] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [panelMessage, setPanelMessage] = useState("");

  const savedRoute = useMemo(() => routeGeoJsonToPolyline(walk.serverRecord?.routeGeoJson ?? null), [walk.serverRecord?.routeGeoJson]);
  const selectedCourseRoute = useMemo(() => coursePathToPolyline(selectedCourse), [selectedCourse]);
  const reviewFactors = useMemo(() => selectedCourse?.explanation?.factors ?? [], [selectedCourse]);
  const previewPoints = useMemo(
    () => (walk.polyline.length > 0 ? walk.polyline : savedRoute.length > 0 ? savedRoute : selectedCourseRoute),
    [savedRoute, selectedCourseRoute, walk.polyline]
  );
  const mapFallbackCenter = previewPoints[0] ?? DEFAULT_MAP_CENTER;
  const mapCaption =
    walk.polyline.length > 0
      ? "실제 GPS 이동 경로를 표시하고 있어요."
      : selectedCourseRoute.length > 0
        ? "선택한 추천 코스를 미리 보여줘요. 산책을 시작하면 실제 GPS 이동 경로로 바뀌어요."
        : "산책을 시작하면 GPS 이동 경로가 지도에 선으로 표시돼요.";
  const isRunning = walk.state.status === "running";
  const isPaused = walk.state.status === "paused";
  const canFinish = isRunning || isPaused;
  const averageSpeedLabel = formatAverageSpeed(walk.distanceMeters, walk.elapsedSeconds);

  useEffect(() => {
    onWalkStatusChange?.(isReviewing ? "review" : canFinish ? "active" : "idle");
  }, [canFinish, isReviewing, onWalkStatusChange]);

  async function handleStart() {
    setPanelMessage("");
    setIsReviewing(false);
    await walk.startWalk({ recommendedCourse: selectedCourseToRecommendedCourse(selectedCourse) });
    setPanelMessage("산책을 시작했어요.");
  }

  // 자유 산책: 바깥(walk-tab)에서 startSignal 을 올리면 여기서 산책을 시작한다.
  const lastStartSignalRef = useRef(startSignal);
  useEffect(() => {
    if (startSignal === undefined || startSignal === lastStartSignalRef.current) {
      return;
    }

    lastStartSignalRef.current = startSignal;

    if (walk.state.status === "running" || walk.state.status === "paused") {
      return;
    }

    handleStart().catch((error) => {
      setPanelMessage(error instanceof Error ? error.message : "산책을 시작하지 못했어요.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  function handleFinish() {
    setPanelMessage("");
    walk.finish();
    setIsReviewing(true);
  }

  async function handleSaveReview() {
    setPanelMessage("");
    const record = await walk.finishWalk({
      rating,
      likedFactor: likedFactor || undefined,
      dislikedFactor: dislikedFactor || undefined,
      likedNotes: likedNotes || undefined,
      dislikedNotes: dislikedNotes || undefined
    });
    setPanelMessage(`산책 완료: ${formatDistance(record.distanceMeters ?? 0)}`);
    setIsReviewing(false);
    setLikedNotes("");
    setDislikedNotes("");
    setLikedFactor("");
    setDislikedFactor("");
    setRating(5);
    onWalkCompleted?.();
    walk.reset();
  }

  async function handleSkipReview() {
    setPanelMessage("");
    const record = await walk.finishWalk({});
    setPanelMessage(`산책 완료: ${formatDistance(record.distanceMeters ?? 0)}`);
    setIsReviewing(false);
    setLikedNotes("");
    setDislikedNotes("");
    setRating(5);
    onWalkCompleted?.();
    walk.reset();
  }

  const statusMessage = walk.state.lastError || walk.serverError || panelMessage;
  const statusIsError = Boolean(walk.state.lastError || walk.serverError);

  function StatusBanner() {
    if (!statusMessage) {
      return null;
    }

    return (
      <div
        className={`mt-[14px] rounded-[14px] px-[14px] py-[12px] text-[13px] font-bold ${
          statusIsError ? "bg-ms-warn-bg text-ms-warn-fg" : "bg-ms-ok-bg text-ms-ok-fg"
        }`}
      >
        {statusMessage}
      </div>
    );
  }

  // 리뷰 화면: meoksa_FE 에는 대응하는 시안이 없어서, 코스 카드/입력 필드 시각
  // 언어(rounded-[18px], ms-card, ms-line, ms-brand 버튼)를 그대로 가져와 짰다.
  if (isReviewing) {
    return (
      <section className="px-[24px] pb-[120px] pt-[10px]">
        <p className="text-[12px] font-bold leading-none text-ms-emphasis-green">Review</p>
        <h1 className="mt-[8px] text-[22px] font-extrabold leading-none">{dogName} 산책 리뷰</h1>

        <div className="mt-[16px] overflow-hidden rounded-[18px] border border-ms-line shadow-sm">
          <WalkActiveRouteMap
            appKey={kakaoMapAppKey}
            caption="방금 걸은 GPS 이동 경로예요."
            fallbackCenter={mapFallbackCenter}
            points={previewPoints}
          />
        </div>

        <div className="mt-[14px] grid grid-cols-3 gap-[12px]">
          <article className="rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[14px] shadow-sm">
            <Clock3 className="text-ms-emphasis" size={20} />
            <p className="mt-[14px] text-[12px] font-bold text-ms-muted">시간</p>
            <p className="mt-[5px] text-[22px] font-extrabold">{formatDuration(walk.elapsedSeconds)}</p>
          </article>
          <article className="rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[14px] shadow-sm">
            <Route className="text-ms-walk-minimum" size={20} />
            <p className="mt-[14px] text-[12px] font-bold text-ms-muted">거리</p>
            <p className="mt-[5px] text-[22px] font-extrabold">{formatDistance(walk.distanceMeters)}</p>
          </article>
          <article className="rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[14px] shadow-sm">
            <Gauge className="text-ms-emphasis-green" size={20} />
            <p className="mt-[14px] text-[12px] font-bold text-ms-muted">평균 속도</p>
            <p className="mt-[5px] text-[22px] font-extrabold">{averageSpeedLabel}</p>
          </article>
        </div>

        {reviewFactors.length > 0 && (
          <div className="mt-[14px] grid gap-[10px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
            <span className="text-[12px] font-bold text-ms-muted">추천 판단 근거 피드백</span>
            <div className="grid gap-[10px] sm:grid-cols-2">
              <label className="grid gap-[4px] text-xs font-bold text-ms-secondary">
                좋았던 판단 근거
                <select
                  className="h-10 rounded-2xl border border-ms-line bg-ms-card px-2.5 text-sm font-semibold text-ms-ink outline-none focus:border-ms-brand"
                  value={likedFactor}
                  onChange={(event) => setLikedFactor(event.target.value)}
                >
                  <option value="">선택 안 함</option>
                  {reviewFactors.map((factor) => (
                    <option key={`liked-${factor.key}`} value={factor.key}>
                      {factor.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-[4px] text-xs font-bold text-ms-secondary">
                아쉬웠던 판단 근거
                <select
                  className="h-10 rounded-2xl border border-ms-line bg-ms-card px-2.5 text-sm font-semibold text-ms-ink outline-none focus:border-ms-brand"
                  value={dislikedFactor}
                  onChange={(event) => setDislikedFactor(event.target.value)}
                >
                  <option value="">선택 안 함</option>
                  {reviewFactors.map((factor) => (
                    <option key={`disliked-${factor.key}`} value={factor.key}>
                      {factor.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="mt-[14px] grid gap-[10px] rounded-[18px] border border-ms-line bg-ms-card p-[16px] shadow-sm">
          <label className="grid gap-[6px] text-[12px] font-bold text-ms-secondary">
            별점 (1~5)
            <Input max={5} min={1} type="number" value={rating} onChange={(event) => setRating(Number(event.target.value))} />
          </label>
          <label className="grid gap-[6px] text-[12px] font-bold text-ms-secondary">
            좋았던 점
            <Input value={likedNotes} onChange={(event) => setLikedNotes(event.target.value)} placeholder="좋았던 길이나 컨디션" />
          </label>
          <label className="grid gap-[6px] text-[12px] font-bold text-ms-secondary">
            아쉬웠던 점
            <Input value={dislikedNotes} onChange={(event) => setDislikedNotes(event.target.value)} placeholder="불편했던 구간이나 특이사항" />
          </label>
        </div>

        <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
          <Button disabled={walk.isSaving} type="button" variant="outline" onClick={handleSkipReview}>
            나중에
          </Button>
          <Button disabled={walk.isSaving} type="button" onClick={handleSaveReview}>
            <Save size={17} /> 리뷰 저장
          </Button>
        </div>

        <StatusBanner />
      </section>
    );
  }

  // 산책 중 화면: meoksa_FE "Walking now" 시안 그대로 — 큰 거리 숫자, 시간/거리
  // 2열 카드, 알약 모양 일시정지·종료 버튼. 실시간 GPS 지도는 이 화면 상단에
  // 붙여 FE 의 MapPreview 자리를 대신한다.
  if (canFinish) {
    return (
      <>
        <section className="relative overflow-hidden bg-ms-sunken">
          <div className="pointer-events-none absolute left-[16px] top-[16px] z-10 flex h-[36px] items-center gap-[8px] rounded-full bg-ms-card px-[14px] text-[13px] font-bold text-ms-ink shadow-sm">
            <MapPin className="text-ms-emphasis-green" size={17} />
            {selectedCourse ? `${selectedCourse.direction} 코스` : "자유 산책"}
          </div>
          <WalkActiveRouteMap appKey={kakaoMapAppKey} caption={mapCaption} fallbackCenter={mapFallbackCenter} points={previewPoints} />
        </section>

        <section className="relative z-0 -mt-[20px] rounded-t-[32px] bg-ms-page px-[24px] pt-[24px] pb-[120px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold leading-none text-ms-emphasis">Walking now</p>
              <h1 className="mt-[9px] text-[22px] font-extrabold leading-none">{dogName} 산책 중</h1>
            </div>
            <span
              className={`rounded-full px-[12px] py-[8px] text-[12px] font-extrabold ${
                isPaused ? "bg-ms-warn-bg text-ms-warn-fg" : "bg-ms-sunken text-ms-emphasis"
              }`}
            >
              {isPaused ? "일시정지" : "진행 중"}
            </span>
          </div>

          <div className="mt-[25px] text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-ms-muted">Kilometers</p>
            <p className="mt-[6px] text-[72px] font-black leading-none tracking-normal">
              {formatKilometers(walk.distanceMeters)}
            </p>
          </div>

          {/* 칼로리 카드는 뺐다 — 산책 중엔 거리(위 큰 숫자)와 시간, 목표,
              평균 속도만 보여준다 (meoksa_FE 규칙) */}
          <div className="mt-[28px] grid grid-cols-3 gap-[12px]">
            <article className="rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[14px] shadow-sm">
              <Clock3 className="text-ms-emphasis" size={20} />
              <p className="mt-[14px] text-[12px] font-bold text-ms-muted">시간</p>
              <p className="mt-[5px] text-[22px] font-extrabold">{formatDuration(walk.elapsedSeconds)}</p>
            </article>
            <article className="rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[14px] shadow-sm">
              <Route className="text-ms-walk-minimum" size={20} />
              <p className="mt-[14px] text-[12px] font-bold text-ms-muted">목표</p>
              <p className="mt-[5px] text-[22px] font-extrabold">
                {selectedCourse ? `${selectedCourse.durationMinutes}분` : "자유"}
              </p>
            </article>
            <article className="rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[14px] shadow-sm">
              <Gauge className="text-ms-emphasis-green" size={20} />
              <p className="mt-[14px] text-[12px] font-bold text-ms-muted">평균 속도</p>
              <p className="mt-[5px] text-[22px] font-extrabold">{averageSpeedLabel}</p>
            </article>
          </div>

          {selectedCourse && (
            <div className="mt-[14px] rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[13px] text-[12px] font-bold text-ms-secondary shadow-sm">
              선택한 추천 코스 · {selectedCourse.rank}순위 · {selectedCourse.direction} · {formatDistance(selectedCourse.distanceMeters)}
            </div>
          )}

          {/* 아이콘만 있는 원형 버튼은 뭔지 안 읽혀서 못 찾겠다는 피드백이 있었다.
              글씨를 붙인 알약 버튼으로 바꾼다 (meoksa_FE 규칙) */}
          <div className="mt-[28px] flex items-center justify-center gap-[12px]">
            <button
              className="flex h-[56px] flex-1 items-center justify-center gap-[8px] rounded-full border border-ms-line bg-ms-card text-[15px] font-extrabold text-ms-emphasis shadow-sm active:bg-ms-sunken"
              onClick={isPaused ? walk.resume : walk.pause}
              type="button"
            >
              {isPaused ? <Play fill="currentColor" size={18} /> : <Pause fill="currentColor" size={18} />}
              {isPaused ? "다시 시작" : "일시정지"}
            </button>
            <button
              className="flex h-[56px] flex-1 items-center justify-center gap-[8px] rounded-full bg-ms-ink text-[15px] font-extrabold text-ms-on-dark shadow-sm disabled:opacity-60"
              disabled={walk.isSaving}
              onClick={handleFinish}
              type="button"
            >
              <Square fill="currentColor" size={16} />
              산책 끝내기
            </button>
          </div>

          <StatusBanner />
        </section>
      </>
    );
  }

  // 산책 시작 전 화면: 위쪽(walk-tab)의 시간 선택/코스 목록에 이어서, 선택한
  // 코스 요약과 "이 경로로 산책 시작하기" CTA만 보여준다 — meoksa_FE 의
  // 하단 요약 카드 + 알약 버튼 자리 그대로.
  return (
    <section className="px-[24px] pb-[120px]">
      {selectedCourse && (
        <div className="mt-[14px] rounded-[18px] border border-ms-line bg-ms-card px-[16px] py-[13px] shadow-sm">
          <p className="text-[12px] font-bold text-ms-secondary">선택한 추천 코스</p>
          <p className="mt-[4px] text-[14px] font-extrabold text-ms-ink">
            {selectedCourse.rank}순위 · {selectedCourse.direction}
          </p>
        </div>
      )}

      <div className="mt-[14px] grid grid-cols-3 rounded-[18px] border border-ms-line bg-ms-card px-[18px] py-[13px] shadow-sm">
        <div>
          <p className="text-[11px] font-bold text-ms-muted">거리</p>
          <p className="mt-[6px] text-[18px] font-extrabold">
            {selectedCourse ? formatDistance(selectedCourse.distanceMeters) : "자유"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-ms-muted">시간</p>
          <p className="mt-[6px] text-[18px] font-extrabold">
            {selectedCourse ? `${selectedCourse.durationMinutes}분` : "--"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-ms-muted">점수</p>
          <p className="mt-[6px] text-[18px] font-extrabold">{selectedCourse ? `${selectedCourse.score}점` : "--"}</p>
        </div>
      </div>

      <button
        className="mt-[12px] flex h-[56px] w-full items-center justify-center gap-[10px] rounded-full bg-ms-brand text-[15px] font-extrabold text-white shadow-sm active:opacity-90 disabled:opacity-60"
        disabled={walk.isSaving || isRunning}
        onClick={handleStart}
        type="button"
      >
        <Play fill="currentColor" size={19} />
        이 경로로 산책 시작하기
      </button>

      <StatusBanner />
    </section>
  );
}
