"use client";

export type KakaoLatLng = {
  getLat(): number;
  getLng(): number;
};

export type KakaoMapInstance = {
  setBounds(bounds: unknown): void;
  setCenter(point: unknown): void;
  relayout(): void;
};

export type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (lat: number, lon: number) => KakaoLatLng;
  LatLngBounds: new () => { extend(point: KakaoLatLng): void };
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number }
  ) => KakaoMapInstance;
  Marker: new (options: { position: KakaoLatLng }) => { setMap(map: KakaoMapInstance): void };
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement | string;
    xAnchor?: number;
    yAnchor?: number;
  }) => { setMap(map: KakaoMapInstance): void };
  Polyline: new (options: {
    path: KakaoLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
  }) => { setMap(map: KakaoMapInstance): void };
  event: {
    addListener(
      target: KakaoMapInstance,
      type: "click",
      handler: (event: { latLng: KakaoLatLng }) => void
    ): void;
  };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
    __meoksaKakaoMapsPromise?: Promise<KakaoMaps>;
    __meoksaKakaoMapsLoaded?: boolean;
  }
}

export function loadKakaoMaps(appKey: string) {
  if (!appKey.trim()) {
    return Promise.reject(new Error("KAKAO_MAP_APP_KEY가 비어 있어 지도를 표시할 수 없어요."));
  }

  if (window.__meoksaKakaoMapsLoaded && window.kakao?.maps) {
    return Promise.resolve(window.kakao.maps);
  }

  if (window.__meoksaKakaoMapsPromise) {
    return window.__meoksaKakaoMapsPromise;
  }

  window.__meoksaKakaoMapsPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const scriptId = "meoksa-kakao-maps-sdk";
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false`;
    const fail = (error: Error) => {
      window.__meoksaKakaoMapsPromise = undefined;
      window.__meoksaKakaoMapsLoaded = false;
      script.remove();
      reject(error);
    };
    const loadTimeout = window.setTimeout(() => {
      fail(
        new Error(
          "카카오 지도 SDK 응답이 지연되고 있어요. 네트워크 상태와 Kakao Web 플랫폼 도메인 등록을 확인해 주세요."
        )
      );
    }, 10_000);

    script.onload = () => {
      window.clearTimeout(loadTimeout);

      if (!window.kakao?.maps) {
        fail(new Error("카카오 지도 SDK를 불러오지 못했어요."));
        return;
      }

      window.kakao.maps.load(() => {
        window.__meoksaKakaoMapsLoaded = true;
        resolve(window.kakao!.maps);
      });
    };
    script.onerror = () => {
      window.clearTimeout(loadTimeout);
      fail(
        new Error(
          "카카오 지도 스크립트 로딩에 실패했어요. 네트워크 상태와 Kakao JavaScript 키의 Web 플랫폼 도메인 등록을 확인해 주세요."
        )
      );
    };
    document.head.appendChild(script);
  });

  return window.__meoksaKakaoMapsPromise;
}
