"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "../kakao-maps";
import type { LineString } from "./record-utils";

export function WalkRecordMap({
  appKey,
  route
}: {
  appKey: string;
  route: LineString | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!appKey || !route || route.coordinates.length < 2 || !containerRef.current) {
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
        const path = route.coordinates.map(([lon, lat]) => new maps.LatLng(lat, lon));
        const bounds = new maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));

        const map = new maps.Map(containerRef.current, { center: path[0], level: 4 });
        new maps.Polyline({
          path,
          strokeWeight: 7,
          strokeColor: "#2d7051",
          strokeOpacity: 0.95,
          strokeStyle: "solid"
        }).setMap(map);
        map.setBounds(bounds);
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
  }, [appKey, route]);

  if (!route || route.coordinates.length < 2) {
    return (
      <div className="grid min-h-[240px] place-items-center rounded-md border border-border bg-muted p-4 text-center text-sm font-bold text-muted-foreground">
        저장된 GPS 경로가 없어요.
      </div>
    );
  }

  if (!appKey) {
    return (
      <div className="grid min-h-[240px] place-items-center rounded-md border border-border bg-muted p-4 text-center text-sm font-bold text-muted-foreground">
        KAKAO_MAP_APP_KEY가 없어 지도를 표시할 수 없어요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <div className="kakao-map-root" ref={containerRef} />
      <div className="border-t border-border px-3 py-2 text-xs font-bold text-muted-foreground">
        실제 걸은 GPS 경로예요.
      </div>
      {mapError && <div className="border-t border-border px-3 py-2 text-sm font-bold text-destructive">{mapError}</div>}
    </div>
  );
}
