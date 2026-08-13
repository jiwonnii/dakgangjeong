"use client";

import { Footprints } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { CareProgressCard } from "./care-progress-card";
import { DogInfoCard } from "./dog-info-card";
import { WalkVerdictCard } from "./walk-verdict-card";

export function MainTab() {
  const { primaryDog } = useAuth();

  // 강아지가 없으면 AppShell 이 등록 안내로 대체하므로 여기까지 오지 않는다.
  if (!primaryDog) {
    return null;
  }

  return (
    <>
      <WalkVerdictCard dogId={primaryDog.id} />
      <Link
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ms-brand text-sm font-bold text-ms-on-brand active:bg-ms-brand-pressed"
        href="/walk"
      >
        <Footprints size={17} />
        산책 시작하기
      </Link>
      <DogInfoCard />
      <CareProgressCard dogId={primaryDog.id} />
    </>
  );
}
