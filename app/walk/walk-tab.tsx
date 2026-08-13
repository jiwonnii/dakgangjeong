"use client";

import { Footprints, LocateFixed, MapPinned, RefreshCw, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { KakaoRouteMap } from "../kakao-route-map";
import { MAX_RECOMMENDATION_GPS_ACCURACY_M, watchAccurateCurrentOrigin } from "../lib/geolocation";
import type { DurationOptions, LatLon, RecommendationResponse } from "../lib/types";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../ui";
import { WalkRecorderPanel } from "../walk-recorder-panel-next";
import { CourseResults } from "./course-results";
import { DurationPicker, type DurationChoice } from "./duration-picker";

const DEFAULT_ORIGIN: LatLon = { lat: 37.5665, lon: 126.978 };
const DEFAULT_CUSTOM_MINUTES = 30;

export function WalkTab() {
  const { api, kakaoMapAppKey, primaryDog, token } = useAuth();

  const [origin, setOrigin] = useState<LatLon>(DEFAULT_ORIGIN);
  const [originSource, setOriginSource] = useState<"default" | "gps" | "manual">("default");
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [choice, setChoice] = useState<DurationChoice>("recommended");
  const [customMinutes, setCustomMinutes] = useState(DEFAULT_CUSTOM_MINUTES);
  const [durationOptions, setDurationOptions] = useState<DurationOptions | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [selectedRank, setSelectedRank] = useState(1);
  const [mode, setMode] = useState<"choose" | "results">("choose");
  const [walkStage, setWalkStage] = useState<"idle" | "active" | "review">("idle");
  const [startSignal, setStartSignal] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const dogId = primaryDog?.id;

  // 최소·적정이 몇 분인지 코스를 뽑기 전에 보여주려면 따로 조회해야 한다.
  // 추천 응답에도 같은 값이 들어있지만 그건 추천을 받은 뒤에나 온다.
  useEffect(() => {
    if (!dogId) {
      return;
    }

    let cancelled = false;
    const query = new URLSearchParams({ dogId, lat: String(origin.lat), lon: String(origin.lon) });

    api<{ durationOptions: DurationOptions }>(`/api/walk-routes/duration-options?${query.toString()}`)
      .then((payload) => {
        if (!cancelled) {
          setDurationOptions(payload.durationOptions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDurationOptions(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId, origin.lat, origin.lon]);

  const courses = useMemo(
    () => (recommendation?.status === "ok" ? recommendation.courses : []),
    [recommendation]
  );
  const selectedCourse = courses.find((course) => course.rank === selectedRank) ?? courses[0] ?? null;
  const showPlanning = walkStage === "idle";

  const pickOriginFromMap = useCallback((nextOrigin: LatLon) => {
    setOrigin(nextOrigin);
    setOriginSource("manual");
    setGpsAccuracyMeters(null);
    setMessage("지도에서 선택한 위치를 출발지로 설정했어요.");
  }, []);

  async function locateMe() {
    setError("");
    const result = await watchAccurateCurrentOrigin({ onAccuracy: setGpsAccuracyMeters });
    setOrigin(result.origin);
    setOriginSource("gps");
    return result.origin;
  }

  async function useCurrentLocation() {
    try {
      await locateMe();
      setMessage("현재 위치를 출발지로 설정했어요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "현재 위치를 가져오지 못했어요.");
    }
  }

  async function requestRecommendations(options: { origin?: LatLon; refresh?: boolean } = {}) {
    if (!dogId) {
      setError("강아지 등록을 먼저 완료해 주세요.");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      const payload = await api<RecommendationResponse>("/api/walk-routes/recommendations", {
        method: "POST",
        body: JSON.stringify({
          dogId,
          origin: options.origin ?? origin,
          durationChoice: choice === "free" ? "recommended" : choice,
          customMinutes: choice === "custom" ? customMinutes : undefined,
          refresh: options.refresh ?? false
        })
      });

      setRecommendation(payload);

      if (payload.status === "ok") {
        setSelectedRank(payload.courses[0]?.rank ?? 1);
        setMode("results");
        setMessage(options.refresh ? "코스를 새로 추천했어요." : "추천 코스를 불러왔어요.");
        return;
      }

      setMessage(payload.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "추천 코스를 불러오지 못했어요.");
    } finally {
      setIsBusy(false);
    }
  }

  function startFreeWalk() {
    setError("");
    setRecommendation(null);
    setMode("choose");
    setStartSignal((value) => value + 1);
    setMessage("자유 산책을 시작했어요. 코스 없이 걸은 거리와 경로가 기록돼요.");
  }

  async function onPrimaryAction() {
    if (choice === "free") {
      startFreeWalk();
      return;
    }

    await requestRecommendations();
  }

  function handleWalkCompleted() {
    setMode("choose");
    setRecommendation(null);
    setSelectedRank(1);
    setMessage("");
    setError("");
  }

  if (!primaryDog) {
    return null;
  }

  return (
    <>
      {showPlanning && (
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinned size={20} /> {primaryDog.name} 산책하기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KakaoRouteMap
            appKey={kakaoMapAppKey}
            courses={courses}
            origin={origin}
            onOriginPicked={pickOriginFromMap}
          />

          <div className="grid gap-2 rounded-md border border-border bg-muted p-3 text-sm font-bold">
            <span className="text-muted-foreground">출발 위치</span>
            <strong>
              {originSource === "gps"
                ? "현재 GPS 위치"
                : originSource === "manual"
                  ? "지도에서 선택한 위치"
                  : "기본 위치"}
            </strong>
            <span>
              {origin.lat.toFixed(6)}, {origin.lon.toFixed(6)}
            </span>
            {gpsAccuracyMeters !== null && (
              <span
                className={
                  gpsAccuracyMeters <= MAX_RECOMMENDATION_GPS_ACCURACY_M ? "text-primary" : "text-destructive"
                }
              >
                GPS 정확도 +/-{Math.round(gpsAccuracyMeters)}m
              </span>
            )}
          </div>

          {mode === "choose" && (
            <>
              <DurationPicker
                choice={choice}
                customMinutes={customMinutes}
                durationOptions={durationOptions}
                onChoiceChange={setChoice}
                onCustomMinutesChange={setCustomMinutes}
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={useCurrentLocation}>
                  <LocateFixed size={17} /> 현재 위치
                </Button>
                <Button disabled={isBusy} type="button" onClick={onPrimaryAction}>
                  {isBusy ? (
                    <RefreshCw className="animate-spin" size={17} />
                  ) : choice === "free" ? (
                    <Footprints size={17} />
                  ) : (
                    <Route size={17} />
                  )}
                  {choice === "free" ? "산책 시작" : "코스 추천"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
        </Card>
      )}

      {showPlanning && (message || error) && (
        <div
          className={`rounded-lg border p-3 text-sm font-bold ${
            error ? "border-destructive/30 bg-red-50 text-destructive" : "border-primary/20 bg-green-50 text-primary"
          }`}
        >
          {error || message}
        </div>
      )}

      {showPlanning && mode === "results" && recommendation?.status === "ok" && (
        <CourseResults
          courses={courses}
          isBusy={isBusy}
          selectedRank={selectedRank}
          warnings={recommendation.warnings}
          onBack={() => setMode("choose")}
          onRefresh={() => requestRecommendations({ refresh: true })}
          onSelectRank={setSelectedRank}
        />
      )}

      <WalkRecorderPanel
        dogId={primaryDog.id}
        dogName={primaryDog.name}
        kakaoMapAppKey={kakaoMapAppKey}
        selectedCourse={selectedCourse}
        startSignal={startSignal}
        token={token}
        onWalkCompleted={handleWalkCompleted}
        onWalkStatusChange={setWalkStage}
      />
    </>
  );
}
