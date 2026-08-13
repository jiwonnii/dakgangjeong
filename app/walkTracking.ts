import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WalkPoint = {
  lat: number;
  lon: number;
  accuracy: number | null;
  recordedAt: string;
};

export type WalkTrackingStatus = "idle" | "running" | "paused" | "finished";

export type WalkTrackingState = {
  status: WalkTrackingStatus;
  serverRecordId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  activeStartedAt: string | null;
  accumulatedActiveMs: number;
  distanceMeters: number;
  points: WalkPoint[];
  lastAcceptedPoint: WalkPoint | null;
  lastError: string | null;
};

export type WalkPolylinePoint = {
  latitude: number;
  longitude: number;
};

const STORAGE_KEY = "meoksa-active-walk";
const MAX_ACCEPTED_ACCURACY_M = 80;
const MIN_ACCEPTED_DISTANCE_M = 2;
const MAX_ACCEPTED_SPEED_MPS = 7;

const idleState: WalkTrackingState = {
  status: "idle",
  serverRecordId: null,
  startedAt: null,
  endedAt: null,
  activeStartedAt: null,
  accumulatedActiveMs: 0,
  distanceMeters: 0,
  points: [],
  lastAcceptedPoint: null,
  lastError: null
};

function nowIso() {
  return new Date().toISOString();
}

export function haversineMeters(a: Pick<WalkPoint, "lat" | "lon">, b: Pick<WalkPoint, "lat" | "lon">): number {
  const radiusM = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radiusM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function elapsedMs(state: WalkTrackingState, at = Date.now()): number {
  if (state.status !== "running" || !state.activeStartedAt) {
    return state.accumulatedActiveMs;
  }

  return state.accumulatedActiveMs + Math.max(0, at - new Date(state.activeStartedAt).getTime());
}

function isSecureGeolocationContext(): boolean {
  return window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "위치 권한이 거부됐어요. 브라우저 주소창의 위치 권한을 허용으로 바꿔주세요.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "현재 위치를 확인할 수 없어요. 기기 위치 서비스와 네트워크 상태를 확인해 주세요.";
  }

  if (error.code === error.TIMEOUT) {
    return "위치 확인 시간이 초과됐어요. 실외에서 다시 시도하거나 고정밀 위치를 켜 주세요.";
  }

  return error.message || "위치 확인 중 알 수 없는 오류가 발생했어요.";
}

function shouldAcceptPoint(previous: WalkPoint | null, next: WalkPoint): { ok: true; distance: number } | { ok: false; reason: string } {
  if (next.accuracy !== null && next.accuracy > MAX_ACCEPTED_ACCURACY_M) {
    return { ok: false, reason: `GPS 정확도가 낮아 좌표를 제외했어요. 정확도 +/-${Math.round(next.accuracy)}m` };
  }

  if (!previous) {
    return { ok: true, distance: 0 };
  }

  const distance = haversineMeters(previous, next);

  if (distance < MIN_ACCEPTED_DISTANCE_M) {
    return { ok: false, reason: "이동 거리가 너무 작아 중복 좌표로 처리했어요." };
  }

  const elapsedSeconds =
    (new Date(next.recordedAt).getTime() - new Date(previous.recordedAt).getTime()) / 1000;

  if (elapsedSeconds <= 0) {
    return { ok: false, reason: "이전 좌표보다 오래된 GPS 좌표라 제외했어요." };
  }

  const speedMps = distance / elapsedSeconds;
  if (speedMps > MAX_ACCEPTED_SPEED_MPS) {
    return { ok: false, reason: `GPS 점프가 감지돼 좌표를 제외했어요. 추정 속도 ${speedMps.toFixed(1)}m/s` };
  }

  return { ok: true, distance };
}

function persistState(state: WalkTrackingState) {
  if (state.status === "idle" || state.status === "finished") {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState(): WalkTrackingState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return idleState;
  }

  try {
    const parsed = JSON.parse(raw) as WalkTrackingState;
    if (parsed.status !== "running" && parsed.status !== "paused") {
      return idleState;
    }

    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return idleState;
  }
}

export function toPolyline(points: readonly WalkPoint[]): WalkPolylinePoint[] {
  return points.map((point) => ({
    latitude: point.lat,
    longitude: point.lon
  }));
}

export function toApiPath(points: readonly WalkPoint[]) {
  return points.map((point) => ({
    lat: point.lat,
    lon: point.lon,
    accuracy: point.accuracy ?? undefined,
    recordedAt: point.recordedAt
  }));
}

export type WalkRecordRouteGeoJson = {
  type: "LineString";
  coordinates: [number, number][];
};

export type WalkRecordRecommendedCourse = {
  rank: number;
  direction?: string;
  distanceMeters: number;
  durationMinutes: number;
  score?: number;
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
  path: WalkRecordRouteGeoJson;
};

export type WalkRecordResponse = {
  id: string;
  dogId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  averageSpeedMps: number | null;
  routeGeoJson: WalkRecordRouteGeoJson | null;
  recommendedCourse: WalkRecordRecommendedCourse | null;
  staticMapUrl: string | null;
  rating: number | null;
  likedNotes: string | null;
  dislikedNotes: string | null;
  likedFactor: string | null;
  dislikedFactor: string | null;
  aiSummary: string | null;
  createdAt: string;
};

type ApiRequestOptions = {
  apiBaseUrl: string;
  token: string;
  path: string;
  method?: string;
  body?: unknown;
};

async function walkApiRequest<T>({
  apiBaseUrl,
  token,
  path,
  method = "GET",
  body
}: ApiRequestOptions): Promise<T> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? "Walk record request failed.";
    throw new Error(message);
  }

  return payload as T;
}

export function useWalkTracking() {
  const [state, setState] = useState<WalkTrackingState>(() => restoreState());
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const stateRef = useRef(state);
  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const acceptPosition = useCallback((position: GeolocationPosition) => {
    const nextPoint: WalkPoint = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      recordedAt: new Date(position.timestamp || Date.now()).toISOString()
    };

    setState((current) => {
      if (current.status !== "running") {
        return current;
      }

      const accepted = shouldAcceptPoint(current.lastAcceptedPoint, nextPoint);
      if (!accepted.ok) {
        return { ...current, lastError: accepted.reason };
      }

      return {
        ...current,
        distanceMeters: current.distanceMeters + accepted.distance,
        points: [...current.points, nextPoint],
        lastAcceptedPoint: nextPoint,
        lastError: null
      };
    });
  }, []);

  const startWatching = useCallback(() => {
    if (!isSecureGeolocationContext()) {
      setState((current) => ({
        ...current,
        lastError:
          "브라우저가 위치 API를 차단했어요. 로컬 PC는 http://localhost 또는 http://127.0.0.1로 열고, 휴대폰 테스트는 HTTPS 터널을 사용해야 해요."
      }));
      return;
    }

    if (!navigator.geolocation) {
      setState((current) => ({ ...current, lastError: "이 브라우저는 위치 API를 지원하지 않아요." }));
      return;
    }

    stopWatching();
    watchIdRef.current = navigator.geolocation.watchPosition(
      acceptPosition,
      (error) => {
        setState((current) => ({ ...current, lastError: geolocationErrorMessage(error) }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
      }
    );
  }, [acceptPosition, stopWatching]);

  const start = useCallback((options: {
    serverRecordId?: string;
    startedAt?: string;
    distanceMeters?: number;
    points?: WalkPoint[];
  } = {}) => {
    const startedAt = options.startedAt ?? nowIso();
    const points = options.points ?? [];
    setState({
      ...idleState,
      status: "running",
      serverRecordId: options.serverRecordId ?? null,
      startedAt,
      activeStartedAt: startedAt,
      distanceMeters: options.distanceMeters ?? 0,
      points,
      lastAcceptedPoint: points.length > 0 ? points[points.length - 1] : null
    });
    startWatching();
  }, [startWatching]);

  const pause = useCallback(() => {
    stopWatching();
    setState((current) => {
      if (current.status !== "running") {
        return current;
      }

      return {
        ...current,
        status: "paused",
        accumulatedActiveMs: elapsedMs(current),
        activeStartedAt: null
      };
    });
  }, [stopWatching]);

  const resume = useCallback(() => {
    setState((current) => {
      if (current.status !== "paused") {
        return current;
      }

      return {
        ...current,
        status: "running",
        activeStartedAt: nowIso()
      };
    });
    startWatching();
  }, [startWatching]);

  const finish = useCallback(() => {
    stopWatching();
    const current = stateRef.current;
    const endedAt = nowIso();
    const finishedState: WalkTrackingState = {
      ...current,
      status: "finished",
      endedAt,
      accumulatedActiveMs: elapsedMs(current, new Date(endedAt).getTime()),
      activeStartedAt: null
    };

    setState(finishedState);
    localStorage.removeItem(STORAGE_KEY);
    return finishedState;
  }, [stopWatching]);

  const reset = useCallback(() => {
    stopWatching();
    localStorage.removeItem(STORAGE_KEY);
    setState(idleState);
  }, [stopWatching]);

  useEffect(() => {
    stateRef.current = state;
    persistState(state);
  }, [state]);

  useEffect(() => {
    if (state.status !== "running") {
      setClockNowMs(Date.now());
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [state.status]);

  useEffect(() => {
    if (state.status === "running") {
      startWatching();
    }

    return stopWatching;
  }, []);

  const elapsedSeconds = Math.floor(elapsedMs(state, clockNowMs) / 1000);
  const polyline = useMemo(() => toPolyline(state.points), [state.points]);

  return {
    state,
    elapsedSeconds,
    distanceMeters: Math.round(state.distanceMeters),
    polyline,
    apiPath: toApiPath(state.points),
    start,
    pause,
    resume,
    finish,
    reset
  };
}

export function routeGeoJsonToPolyline(routeGeoJson: WalkRecordRouteGeoJson | null): WalkPolylinePoint[] {
  if (!routeGeoJson) {
    return [];
  }

  return routeGeoJson.coordinates.map(([lon, lat]) => ({
    latitude: lat,
    longitude: lon
  }));
}

function routeGeoJsonToWalkPoints(routeGeoJson: WalkRecordRouteGeoJson | null, recordedAt: string): WalkPoint[] {
  if (!routeGeoJson) {
    return [];
  }

  return routeGeoJson.coordinates.map(([lon, lat]) => ({
    lat,
    lon,
    accuracy: null,
    recordedAt
  }));
}

export function useWalkRecordingController({
  apiBaseUrl,
  token,
  dogId
}: {
  apiBaseUrl: string;
  token: string | null | undefined;
  dogId: string | null | undefined;
}) {
  const tracking = useWalkTracking();
  const [serverRecord, setServerRecord] = useState<WalkRecordResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const trackingStateRef = useRef(tracking.state);
  const lastProgressSaveBucketRef = useRef(0);

  useEffect(() => {
    trackingStateRef.current = tracking.state;
  }, [tracking.state]);

  useEffect(() => {
    if (!token || !dogId) {
      return;
    }

    let cancelled = false;
    const localStateAtMount = tracking.state;
    const query = new URLSearchParams({ dogId });

    walkApiRequest<{ record: WalkRecordResponse | null }>({
      apiBaseUrl,
      token,
      path: `/api/walk-records/in-progress?${query.toString()}`
    })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setServerRecord(data.record);

        if (data.record) {
          const localMatchesServer =
            localStateAtMount.serverRecordId === data.record.id &&
            (localStateAtMount.status === "running" || localStateAtMount.status === "paused");

          if (!localMatchesServer) {
            tracking.start({
              serverRecordId: data.record.id,
              startedAt: data.record.startedAt,
              distanceMeters: data.record.distanceMeters ?? 0,
              points: routeGeoJsonToWalkPoints(data.record.routeGeoJson, data.record.startedAt)
            });
          }

          return;
        }

        if (localStateAtMount.status === "running" || localStateAtMount.status === "paused") {
          tracking.reset();
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setServerError(error instanceof Error ? error.message : "Failed to restore active walk.");
        }
      });

    return () => {
      cancelled = true;
    };
    // Only run when the attached user/dog changes. `tracking.state` is captured
    // once so a restored local walk can be compared with the server record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, dogId, token, tracking.reset, tracking.start]);

  const startWalk = useCallback(async (input: { recommendedCourse?: WalkRecordRecommendedCourse } = {}) => {
    if (!token) {
      throw new Error("Login is required to start a walk.");
    }

    if (!dogId) {
      throw new Error("Dog profile is required to start a walk.");
    }

    setIsSaving(true);
    setServerError(null);

    try {
      const startedAt = nowIso();
      const data = await walkApiRequest<{ record: WalkRecordResponse }>({
        apiBaseUrl,
        token,
        path: "/api/walk-records/start",
        method: "POST",
        body: { dogId, startedAt, recommendedCourse: input.recommendedCourse }
      });

      setServerRecord(data.record);
      tracking.start({ serverRecordId: data.record.id, startedAt: data.record.startedAt });
      return data.record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start walk.";
      setServerError(message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [apiBaseUrl, dogId, token, tracking.start]);

  const saveWalkProgress = useCallback(
    async (state: WalkTrackingState) => {
      if (!token || state.status !== "running" || !state.serverRecordId) {
        return;
      }

      try {
        const data = await walkApiRequest<{ record: WalkRecordResponse }>({
          apiBaseUrl,
          token,
          path: `/api/walk-records/${state.serverRecordId}/progress`,
          method: "PATCH",
          body: {
            distanceMeters: Math.round(state.distanceMeters),
            path: toApiPath(state.points)
          }
        });

        setServerRecord(data.record);
        setServerError(null);
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "Failed to save walk progress.");
      }
    },
    [apiBaseUrl, token]
  );

  useEffect(() => {
    if (tracking.state.status !== "running" || !tracking.state.serverRecordId || tracking.elapsedSeconds < 30) {
      return;
    }

    const progressSaveBucket = Math.floor(tracking.elapsedSeconds / 30);
    if (progressSaveBucket <= lastProgressSaveBucketRef.current) {
      return;
    }

    lastProgressSaveBucketRef.current = progressSaveBucket;
    saveWalkProgress(trackingStateRef.current);
  }, [saveWalkProgress, tracking.elapsedSeconds, tracking.state.serverRecordId, tracking.state.status]);

  const finishWalk = useCallback(
    async (review: { rating?: number; likedFactor?: string; dislikedFactor?: string; likedNotes?: string; dislikedNotes?: string; staticMapUrl?: string } = {}) => {
      if (!token) {
        throw new Error("Login is required to finish a walk.");
      }

      const finishedState = tracking.finish();
      const walkRecordId = finishedState.serverRecordId;

      if (!walkRecordId) {
        throw new Error("No server walk record is attached to the active walk.");
      }

      setIsSaving(true);
      setServerError(null);

      try {
        const data = await walkApiRequest<{ record: WalkRecordResponse }>({
          apiBaseUrl,
          token,
          path: `/api/walk-records/${walkRecordId}/finish`,
          method: "PATCH",
          body: {
            endedAt: finishedState.endedAt ?? nowIso(),
            distanceMeters: Math.round(finishedState.distanceMeters),
            durationSeconds: Math.floor(finishedState.accumulatedActiveMs / 1000),
            path: toApiPath(finishedState.points),
            ...review
          }
        });

        setServerRecord(data.record);
        return data.record;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to finish walk.";
        setServerError(message);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [apiBaseUrl, token, tracking.finish]
  );

  const createManualWalk = useCallback(
    async (input: {
      distanceMeters: number;
      durationSeconds: number;
      walkedAt?: string;
      rating?: number;
      likedNotes?: string;
      dislikedNotes?: string;
      likedFactor?: string;
      dislikedFactor?: string;
    }) => {
      if (!token) {
        throw new Error("Login is required to create a manual walk.");
      }

      if (!dogId) {
        throw new Error("Dog profile is required to create a manual walk.");
      }

      setIsSaving(true);
      setServerError(null);

      try {
        const data = await walkApiRequest<{ record: WalkRecordResponse }>({
          apiBaseUrl,
          token,
          path: "/api/walk-records/manual",
          method: "POST",
          body: { dogId, ...input }
        });

        setServerRecord(data.record);
        return data.record;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create manual walk.";
        setServerError(message);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [apiBaseUrl, dogId, token]
  );

  return {
    ...tracking,
    serverRecord,
    isSaving,
    serverError,
    startWalk,
    finishWalk,
    createManualWalk
  };
}
