"use client";

import type { LatLon } from "./types";

/** 이 정확도(m) 안으로 들어오면 추천 출발지로 바로 받아들인다. */
export const MAX_RECOMMENDATION_GPS_ACCURACY_M = 100;

const WATCH_TIMEOUT_MS = 15_000;

export function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "위치 권한이 차단되어 있어요. 브라우저 설정에서 위치 권한을 허용해 주세요.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "현재 위치를 확인할 수 없어요. 모바일 기기에서 GPS를 켜고 다시 시도해 주세요.";
  }

  if (error.code === error.TIMEOUT) {
    return "현재 위치 요청 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.";
  }

  return "현재 위치를 가져오지 못했어요. 다시 시도해 주세요.";
}

export type AccurateOrigin = {
  origin: LatLon;
  accuracy: number | null;
};

/**
 * 대략적인 현재 위치를 한 번만 받아온다.
 *
 * 날씨·미세먼지처럼 수 km 오차가 무의미한 조회에 쓴다. 아래
 * `watchAccurateCurrentOrigin` 은 100m 정확도를 얻으려고 최대 15초를 기다리는데,
 * 화면 맨 위 배너를 그리자고 15초를 붙잡고 있을 이유가 없다.
 */
export function getApproximateCurrentOrigin(): Promise<LatLon> {
  return new Promise<LatLon>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("이 브라우저는 위치 정보를 사용할 수 없어요."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lon: Number(position.coords.longitude.toFixed(6))
        });
      },
      (positionError) => reject(new Error(getGeolocationErrorMessage(positionError))),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 }
    );
  });
}

/**
 * 충분히 정확한 현재 위치를 하나 받아온다.
 *
 * `watchPosition` 으로 여러 번 받으면서 가장 정확한 값을 들고 있다가,
 * MAX_RECOMMENDATION_GPS_ACCURACY_M 안으로 들어오면 즉시 resolve 한다.
 * 15초 안에 그만한 정확도가 안 나오면 reject 한다 — 부정확한 좌표로 코스를
 * 추천하면 엉뚱한 동네가 나오므로, 지도 클릭으로 직접 찍게 유도하는 편이 낫다.
 *
 * `onAccuracy` 는 중간 정확도를 화면에 보여주기 위한 것이다.
 */
export function watchAccurateCurrentOrigin(options: {
  onAccuracy?: (accuracyMeters: number | null) => void;
} = {}): Promise<AccurateOrigin> {
  const { onAccuracy } = options;

  return new Promise<AccurateOrigin>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("이 브라우저는 위치 정보를 사용할 수 없어요."));
      return;
    }

    let best: AccurateOrigin | null = null;
    let finished = false;
    let watchId: number | null = null;

    const stop = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (finished) {
          return;
        }

        const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;
        const nextOrigin: LatLon = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lon: Number(position.coords.longitude.toFixed(6))
        };

        if (!best || (accuracy !== null && (best.accuracy === null || accuracy < best.accuracy))) {
          best = { origin: nextOrigin, accuracy };
          onAccuracy?.(accuracy);
        }

        if (accuracy !== null && accuracy <= MAX_RECOMMENDATION_GPS_ACCURACY_M) {
          finished = true;
          stop();
          onAccuracy?.(accuracy);
          resolve({ origin: nextOrigin, accuracy });
        }
      },
      (positionError) => {
        finished = true;
        stop();
        reject(new Error(getGeolocationErrorMessage(positionError)));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: WATCH_TIMEOUT_MS
      }
    );

    window.setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      stop();

      const bestSoFar: AccurateOrigin | null = best;

      if (!bestSoFar) {
        reject(new Error("현재 위치를 한 번도 받지 못했어요. 모바일 GPS를 켜고 다시 시도해 주세요."));
        return;
      }

      onAccuracy?.(bestSoFar.accuracy);
      reject(
        new Error(
          `현재 위치 정확도가 낮아요. 브라우저가 ${
            bestSoFar.accuracy === null
              ? "정확도를 알 수 없는"
              : `+/-${Math.round(bestSoFar.accuracy)}m 범위의`
          } 위치만 줬어요. HTTPS 접속이나 지도 클릭으로 출발지를 지정해 주세요.`
        )
      );
    }, WATCH_TIMEOUT_MS);
  });
}
