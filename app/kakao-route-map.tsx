"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "./kakao-maps";
import type { LatLon, PetFacility, RecommendedCourse } from "./lib/types";

const COURSE_COLORS = ["#2d7051", "#2f6fd6", "#c07a1a"];
const FACILITY_MARKER_STYLES: Record<
  PetFacility["facilityType"],
  { label: string; background: string; color: string; border: string }
> = {
  hospital: { label: "병", background: "#fff1f2", color: "#be123c", border: "#fb7185" },
  grooming: { label: "미", background: "#eff6ff", color: "#1d4ed8", border: "#60a5fa" },
  cafe: { label: "카", background: "#f7fee7", color: "#3f6212", border: "#a3e635" },
  other: { label: "펫", background: "#f8fafc", color: "#334155", border: "#94a3b8" }
};

function createFacilityOverlayContent(facility: PetFacility) {
  const style = FACILITY_MARKER_STYLES[facility.facilityType];
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:4px",
    "height:28px",
    "max-width:112px",
    "padding:0 8px",
    "border-radius:999px",
    `border:1px solid ${style.border}`,
    `background:${style.background}`,
    `color:${style.color}`,
    "font-size:11px",
    "font-weight:800",
    "line-height:1",
    "box-shadow:0 2px 8px rgba(15,23,42,0.14)",
    "white-space:nowrap",
    "pointer-events:none"
  ].join(";");
  wrapper.title = facility.name;
  wrapper.textContent = style.label;

  return wrapper;
}

/** 추천 코스들을 지도에 그리고, 지도를 클릭하면 출발지를 바꿀 수 있게 한다. */
export function KakaoRouteMap({
  appKey,
  courses,
  facilities = [],
  origin,
  onOriginPicked
}: {
  appKey: string;
  courses: RecommendedCourse[];
  facilities?: PetFacility[];
  origin: LatLon;
  onOriginPicked: (origin: LatLon) => void;
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

        const centerPoint = new maps.LatLng(origin.lat, origin.lon);
        const map = new maps.Map(containerRef.current, {
          center: centerPoint,
          level: courses.length > 0 ? 4 : 5
        });
        const bounds = new maps.LatLngBounds();

        bounds.extend(centerPoint);
        new maps.Marker({ position: centerPoint }).setMap(map);
        maps.event.addListener(map, "click", (event) => {
          onOriginPicked({
            lat: Number(event.latLng.getLat().toFixed(6)),
            lon: Number(event.latLng.getLng().toFixed(6))
          });
        });

        courses.forEach((course, index) => {
          const routePath = course.path.coordinates.map(([lon, lat]) => new maps.LatLng(lat, lon));

          if (routePath.length < 2) {
            return;
          }

          new maps.Polyline({
            path: routePath,
            strokeWeight: index === 0 ? 7 : 5,
            strokeColor: COURSE_COLORS[index] ?? "#2d7051",
            strokeOpacity: index === 0 ? 0.95 : 0.72,
            strokeStyle: "solid"
          }).setMap(map);

          routePath.forEach((point) => bounds.extend(point));
        });

        facilities.slice(0, 10).forEach((facility) => {
          const facilityPoint = new maps.LatLng(facility.lat, facility.lon);
          new maps.CustomOverlay({
            position: facilityPoint,
            content: createFacilityOverlayContent(facility),
            xAnchor: 0.5,
            yAnchor: 0.5
          }).setMap(map);
          bounds.extend(facilityPoint);
        });

        if (courses.length > 0 || facilities.length > 0) {
          map.setBounds(bounds);
        } else {
          map.setCenter(centerPoint);
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
  }, [appKey, courses, facilities, origin, onOriginPicked]);

  if (!appKey) {
    return (
      <div className="grid min-h-[260px] place-items-center rounded-lg border border-border bg-white p-4 text-center text-sm font-bold text-muted-foreground">
        KAKAO_MAP_APP_KEY가 .env.local에 없어 지도를 표시할 수 없어요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="kakao-map-root" ref={containerRef} />
      <div className="border-t border-border px-3 py-2 text-xs font-bold text-muted-foreground">
        GPS가 부정확하면 지도를 클릭해서 출발지를 직접 지정할 수 있어요.
      </div>
      {mapError && (
        <div className="border-t border-border px-3 py-2 text-sm font-bold text-destructive">{mapError}</div>
      )}
    </div>
  );
}
