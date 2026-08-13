"use client";

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
      <DogInfoCard />
      <CareProgressCard dogId={primaryDog.id} />
    </>
  );
}
