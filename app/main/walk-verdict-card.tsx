"use client";

import { CloudSun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { getApproximateCurrentOrigin } from "../lib/geolocation";
import type { WarningLevel, WarningsResponse } from "../lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui";

const VERDICT: Record<WarningLevel, { label: string; box: string; badge: string }> = {
  normal: {
    label: "좋음",
    box: "border-primary/30 bg-green-50",
    badge: "bg-primary text-primary-foreground"
  },
  caution: {
    label: "주의",
    box: "border-yellow-300 bg-yellow-50",
    badge: "bg-yellow-500 text-white"
  },
  danger: {
    label: "지양",
    box: "border-destructive/30 bg-red-50",
    badge: "bg-destructive text-white"
  }
};

/** 오늘 산책해도 좋은지 — 날씨·미세먼지 기반. 코스 순위와는 무관한 배너다. */
export function WalkVerdictCard({ dogId }: { dogId: string }) {
  const { api } = useAuth();
  const [data, setData] = useState<WarningsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError("");

    getApproximateCurrentOrigin()
      .then((origin) => {
        const query = new URLSearchParams({
          dogId,
          lat: String(origin.lat),
          lon: String(origin.lon)
        });
        return api<WarningsResponse>(`/api/walk-routes/warnings?${query.toString()}`);
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "산책 판단을 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, dogId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm font-bold text-muted-foreground">오늘 산책해도 될지 확인하는 중이에요...</p>
        </CardContent>
      </Card>
    );
  }

  // 위치를 못 얻었거나 조회에 실패한 경우. 이 카드만 죽고 아래는 정상이어야 한다.
  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudSun size={20} /> 오늘의 산책
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-bold text-muted-foreground">위치를 알 수 없어 산책 판단을 할 수 없어요.</p>
          {error && <p className="text-xs font-semibold text-muted-foreground">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const verdict = VERDICT[data.overallLevel];

  return (
    <div className={`grid gap-3 rounded-lg border p-4 ${verdict.box}`}>
      <div className="flex items-center gap-3">
        <CloudSun size={20} />
        <strong className="text-sm font-black">오늘의 산책</strong>
        <span className={`rounded-full px-3 py-1 text-sm font-black ${verdict.badge}`}>{verdict.label}</span>
      </div>

      {data.warnings.length === 0 ? (
        <p className="text-sm font-bold text-muted-foreground">특별한 주의사항이 없어요.</p>
      ) : (
        <ul className="grid gap-2">
          {data.warnings.map((warning) => (
            <li className="text-sm font-bold" key={`${warning.type}-${warning.message}`}>
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
