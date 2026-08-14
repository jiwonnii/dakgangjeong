"use client";

import {
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  Star,
  Timer,
  Waypoints
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  routeGeoJsonToPolyline,
  useWalkRecordingController,
  type WalkPolylinePoint,
  type WalkRecordRecommendedCourse,
  type WalkRecordRouteGeoJson
} from "./walkTracking";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "./ui";
import { WalkActiveRouteMap } from "./walk-active-route-map";

type WalkRecorderPanelProps = {
  token: string;
  dogId: string;
  dogName: string;
  kakaoMapAppKey: string;
  selectedCourse: {
    rank: number;
    direction: string;
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
    distanceMeters: course.distanceMeters,
    durationMinutes: course.durationMinutes,
    score: course.score,
    aiExplanation: course.aiExplanation,
    explanation: course.explanation,
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

  if (isReviewing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{dogName} 산책 리뷰</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-black text-muted-foreground">review</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WalkActiveRouteMap
            appKey={kakaoMapAppKey}
            caption="방금 걸은 GPS 이동 경로예요."
            fallbackCenter={mapFallbackCenter}
            points={previewPoints}
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
              <Timer size={17} /> {formatDuration(walk.elapsedSeconds)}
            </div>
            <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
              <Waypoints size={17} /> {formatDistance(walk.distanceMeters)}
            </div>
          </div>

          {reviewFactors.length > 0 && (
            <div className="grid gap-3 rounded-md border border-border bg-muted p-3 text-sm font-bold">
              <span className="text-muted-foreground">추천 판단 근거 피드백</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  좋았던 판단 근거
                  <select
                    className="min-h-12 rounded-md border border-input bg-background px-3 text-sm font-bold"
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
                <label className="grid gap-1">
                  아쉬웠던 판단 근거
                  <select
                    className="min-h-12 rounded-md border border-input bg-background px-3 text-sm font-bold"
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

          <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
            <label className="grid gap-1 text-sm font-bold">
              별점
              <Input max={5} min={1} type="number" value={rating} onChange={(event) => setRating(Number(event.target.value))} />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              좋았던 점
              <Input value={likedNotes} onChange={(event) => setLikedNotes(event.target.value)} placeholder="좋았던 길이나 컨디션" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              아쉬웠던 점
              <Input value={dislikedNotes} onChange={(event) => setDislikedNotes(event.target.value)} placeholder="불편했던 구간이나 특이사항" />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={walk.isSaving} type="button" variant="outline" onClick={handleSkipReview}>
              나중에
            </Button>
            <Button disabled={walk.isSaving} type="button" onClick={handleSaveReview}>
              <Save size={17} /> 리뷰 저장
            </Button>
          </div>

          {(walk.state.lastError || walk.serverError || panelMessage) && (
            <div
              className={`rounded-md border p-3 text-sm font-bold ${
                walk.state.lastError || walk.serverError
                  ? "border-destructive/30 bg-red-50 text-destructive"
                  : "border-primary/20 bg-green-50 text-primary"
              }`}
            >
              {walk.state.lastError || walk.serverError || panelMessage}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (canFinish) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{dogName} 산책 중</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-black text-muted-foreground">{walk.state.status}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCourse && (
            <div className="grid gap-1 rounded-md border border-border bg-green-50 p-3 text-sm font-bold text-primary">
              <span>선택한 추천 코스</span>
              <strong>
                {selectedCourse.rank}순위 / {selectedCourse.direction} / {formatDistance(selectedCourse.distanceMeters)} / {selectedCourse.durationMinutes}분
              </strong>
            </div>
          )}

          <WalkActiveRouteMap
            appKey={kakaoMapAppKey}
            caption={mapCaption}
            fallbackCenter={mapFallbackCenter}
            points={previewPoints}
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
              <Timer size={17} /> {formatDuration(walk.elapsedSeconds)}
            </div>
            <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
              <Waypoints size={17} /> {formatDistance(walk.distanceMeters)}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button disabled={!isRunning} type="button" variant="outline" onClick={walk.pause}>
              <Pause size={17} /> 일시정지
            </Button>
            <Button disabled={!isPaused} type="button" variant="outline" onClick={walk.resume}>
              <Play size={17} /> 재개
            </Button>
            <Button type="button" onClick={handleFinish}>
              <Square size={17} /> 종료
            </Button>
          </div>

          {(walk.state.lastError || walk.serverError || panelMessage) && (
            <div
              className={`rounded-md border p-3 text-sm font-bold ${
                walk.state.lastError || walk.serverError
                  ? "border-destructive/30 bg-red-50 text-destructive"
                  : "border-primary/20 bg-green-50 text-primary"
              }`}
            >
              {walk.state.lastError || walk.serverError || panelMessage}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{dogName} 산책 기록</span>
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-black text-muted-foreground">{walk.state.status}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedCourse && (
          <div className="grid gap-1 rounded-md border border-border bg-green-50 p-3 text-sm font-bold text-primary">
            <span>선택한 추천 코스</span>
            <strong>
              {selectedCourse.rank}순위 / {selectedCourse.direction} / {formatDistance(selectedCourse.distanceMeters)} / {selectedCourse.durationMinutes}분
            </strong>
          </div>
        )}

        <WalkActiveRouteMap
          appKey={kakaoMapAppKey}
          caption={mapCaption}
          fallbackCenter={mapFallbackCenter}
          points={previewPoints}
        />

        <div className="grid grid-cols-3 gap-2">
          <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
            <Timer size={17} /> {formatDuration(walk.elapsedSeconds)}
          </div>
          <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
            <Waypoints size={17} /> {formatDistance(walk.distanceMeters)}
          </div>
          <div className="flex min-h-12 items-center gap-2 rounded-md bg-muted px-3 text-sm font-black">
            <Star size={17} /> {rating} / 5
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-5">
          <Button disabled={walk.isSaving || isRunning} type="button" onClick={handleStart}>
            <Play size={17} /> 시작
          </Button>
          <Button disabled={!isRunning} type="button" variant="outline" onClick={walk.pause}>
            <Pause size={17} /> 일시정지
          </Button>
          <Button disabled={!isPaused} type="button" variant="outline" onClick={walk.resume}>
            <Play size={17} /> 재개
          </Button>
          <Button disabled={walk.isSaving || !canFinish} type="button" onClick={handleFinish}>
            <Square size={17} /> 종료 저장
          </Button>
          <Button type="button" variant="outline" onClick={walk.reset}>
            <RotateCcw size={17} /> 초기화
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
          <label className="grid gap-1 text-sm font-bold">
            별점
            <Input max={5} min={1} type="number" value={rating} onChange={(event) => setRating(Number(event.target.value))} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            좋았던 점
            <Input value={likedNotes} onChange={(event) => setLikedNotes(event.target.value)} placeholder="좋았던 길이나 컨디션" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            아쉬웠던 점
            <Input value={dislikedNotes} onChange={(event) => setDislikedNotes(event.target.value)} placeholder="불편했던 구간이나 특이사항" />
          </label>
        </div>

        {(walk.state.lastError || walk.serverError || panelMessage) && (
          <div
            className={`rounded-md border p-3 text-sm font-bold ${
              walk.state.lastError || walk.serverError
                ? "border-destructive/30 bg-red-50 text-destructive"
                : "border-primary/20 bg-green-50 text-primary"
            }`}
          >
            {walk.state.lastError || walk.serverError || panelMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
