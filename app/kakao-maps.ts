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
  }
}

export function loadKakaoMaps(appKey: string) {
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao.maps);
  }

  if (window.__meoksaKakaoMapsPromise) {
    return window.__meoksaKakaoMapsPromise;
  }

  window.__meoksaKakaoMapsPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false`;
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error("카카오 지도 SDK를 불러오지 못했어요."));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };
    script.onerror = () => reject(new Error("카카오 지도 스크립트 로딩에 실패했어요."));
    document.head.appendChild(script);
  });

  return window.__meoksaKakaoMapsPromise;
}
