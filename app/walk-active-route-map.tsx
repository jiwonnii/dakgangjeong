"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "./kakao-maps";
import type { WalkPolylinePoint } from "./walkTracking";

export function WalkActiveRouteMap({
  appKey,
  actualPoints,
  plannedPoints = [],
  fallbackCenter,
  caption
}: {
  appKey: string;
  actualPoints: readonly WalkPolylinePoint[];
  plannedPoints?: readonly WalkPolylinePoint[];
  fallbackCenter: WalkPolylinePoint;
  caption: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!appKey || !containerRef.current) {
      return;
    }

    let cancelled = false;
    setMapError("");

    loadKakaoMaps(appKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = "";
        const actualPath =
          actualPoints.length > 0
            ? actualPoints.map((point) => new maps.LatLng(point.latitude, point.longitude))
            : [new maps.LatLng(fallbackCenter.latitude, fallbackCenter.longitude)];
        const plannedPath = plannedPoints.map((point) => new maps.LatLng(point.latitude, point.longitude));
        const visiblePath = actualPoints.length > 0 ? actualPath : plannedPath.length > 0 ? plannedPath : actualPath;
        const center = visiblePath[visiblePath.length - 1] ?? visiblePath[0];
        const map = new maps.Map(containerRef.current, { center, level: visiblePath.length > 1 ? 4 : 5 });
        const bounds = new maps.LatLngBounds();
        [...plannedPath, ...actualPath].forEach((point) => bounds.extend(point));

        if (plannedPath.length > 1) {
          new maps.Polyline({
            path: plannedPath,
            strokeWeight: 6,
            strokeColor: "#8a96a3",
            strokeOpacity: 0.72,
            strokeStyle: "shortdash"
          }).setMap(map);
        }

        if (actualPath.length > 1 && actualPoints.length > 0) {
          new maps.Polyline({
            path: actualPath,
            strokeWeight: 7,
            strokeColor: "#2d7051",
            strokeOpacity: 0.95,
            strokeStyle: "solid"
          }).setMap(map);
          new maps.Marker({ position: actualPath[0] }).setMap(map);
          new maps.Marker({ position: actualPath[actualPath.length - 1] }).setMap(map);
          map.setBounds(bounds);
        } else if (plannedPath.length > 1) {
          new maps.Marker({ position: plannedPath[0] }).setMap(map);
          new maps.Marker({ position: plannedPath[plannedPath.length - 1] }).setMap(map);
          map.setBounds(bounds);
        } else {
          new maps.Marker({ position: center }).setMap(map);
          map.setCenter(center);
        }

        window.setTimeout(() => map.relayout(), 0);
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "지도를 불러오지 못했어요.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actualPoints, appKey, fallbackCenter.latitude, fallbackCenter.longitude, plannedPoints]);

  if (!appKey) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-lg border border-border bg-white p-4 text-center text-sm font-bold text-muted-foreground">
        KAKAO_MAP_APP_KEY가 .env.local에 없어 산책 지도를 표시할 수 없어요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="kakao-map-root" ref={containerRef} />
      <div className="border-t border-border px-3 py-2 text-xs font-bold text-muted-foreground">
        {caption}
      </div>
      {mapError && <div className="border-t border-border px-3 py-2 text-sm font-bold text-destructive">{mapError}</div>}
    </div>
  );
}
