"use client";

import { Footprints, LocateFixed, MapPin, RefreshCw, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { KakaoRouteMap } from "../kakao-route-map";
import { MAX_RECOMMENDATION_GPS_ACCURACY_M, watchAccurateCurrentOrigin } from "../lib/geolocation";
import type { DurationOptions, LatLon, RecommendationResponse } from "../lib/types";
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

  const originLabel =
    originSource === "gps" ? "현재 GPS 위치" : originSource === "manual" ? "지도에서 선택한 위치" : "기본 위치";

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page">
      <div className="relative w-full max-w-[375px] bg-ms-page text-ms-ink">
        {showPlanning && (
          <>
            {/* 카카오맵 위에 출발지 표시 핀 + GPS 정확도 칩을 얹는다.
                meoksa_FE 의 MapPreview 자리를 실제 KakaoRouteMap 으로 대체한 것 —
                코스 선택 전에는 여기서 코스 후보들과 출발지를 함께 보여준다. */}
            <section className="relative overflow-hidden bg-ms-sunken">
              <div className="pointer-events-none absolute left-[16px] top-[16px] z-10 flex h-[36px] items-center gap-[8px] rounded-full bg-ms-card px-[14px] text-[13px] font-bold text-ms-ink shadow-sm">
                <MapPin className="text-ms-emphasis-green" size={17} />
                {originLabel}
              </div>
              {gpsAccuracyMeters !== null && (
                <div
                  className={`pointer-events-none absolute right-[16px] top-[16px] z-10 rounded-full bg-ms-card px-[12px] py-[7px] text-[11px] font-bold shadow-sm ${
                    gpsAccuracyMeters <= MAX_RECOMMENDATION_GPS_ACCURACY_M ? "text-ms-emphasis-green" : "text-ms-warn-fg"
                  }`}
                >
                  GPS +/-{Math.round(gpsAccuracyMeters)}m
                </div>
              )}
              <KakaoRouteMap
                appKey={kakaoMapAppKey}
                courses={courses}
                origin={origin}
                onOriginPicked={pickOriginFromMap}
              />
            </section>

            <section className="relative z-0 -mt-[20px] rounded-t-[32px] bg-ms-page px-[24px] pt-[24px] pb-[24px]">
              <div className="flex items-end justify-between gap-[10px]">
                <div>
                  <p className="text-[12px] font-bold leading-none text-ms-emphasis-green">Route picks</p>
                  <h1 className="mt-[8px] text-[22px] font-extrabold leading-none">
                    {primaryDog.name} 산책 코스 선택
                  </h1>
                </div>
                <button
                  className="flex shrink-0 items-center gap-[4px] rounded-full bg-ms-card px-[11px] py-[7px] text-[11px] font-bold text-ms-secondary shadow-sm active:bg-ms-sunken"
                  onClick={useCurrentLocation}
                  type="button"
                >
                  <LocateFixed size={13} /> 현재 위치
                </button>
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

                  <button
                    className="mt-[14px] flex h-[56px] w-full items-center justify-center gap-[10px] rounded-full bg-ms-action-green text-[15px] font-extrabold text-ms-on-green shadow-sm active:bg-ms-action-green-pressed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={onPrimaryAction}
                    type="button"
                  >
                    {isBusy ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : choice === "free" ? (
                      <Footprints size={18} />
                    ) : (
                      <Route size={18} />
                    )}
                    {choice === "free" ? "자유 산책 시작하기" : "이 시간으로 코스 추천받기"}
                  </button>
                </>
              )}

              {(message || error) && (
                <div
                  className={`mt-[14px] rounded-[14px] px-[14px] py-[12px] text-[13px] font-bold ${
                    error ? "bg-ms-warn-bg text-ms-warn-fg" : "bg-ms-ok-bg text-ms-ok-fg"
                  }`}
                >
                  {error || message}
                </div>
              )}

              {mode === "results" && recommendation?.status === "ok" && (
                <div className="mt-[14px]">
                  <CourseResults
                    courses={courses}
                    isBusy={isBusy}
                    selectedRank={selectedRank}
                    warnings={recommendation.warnings}
                    onBack={() => setMode("choose")}
                    onRefresh={() => requestRecommendations({ refresh: true })}
                    onSelectRank={setSelectedRank}
                  />
                </div>
              )}
            </section>
          </>
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
      </div>
    </main>
  );
}
