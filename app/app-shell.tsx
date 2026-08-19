"use client";

import { LayoutGrid, PawPrint, Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { AuthScreen } from "./auth-screen";
import { OnboardingScreen } from "./onboarding-screen";

// 3탭 구성 (meoksa_FE 디자인 기준). "산책하기"는 메인 화면의 CTA로, "기록"은
// 마이페이지에서 링크로 들어간다 — 탭 자체는 아니다.
const TABS = [
  { href: "/", label: "홈", icon: PawPrint },
  { href: "/sharing", label: "셰어링", icon: Share2 },
  { href: "/my", label: "마이페이지", icon: LayoutGrid }
] as const;

function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[375px] bg-ms-page px-6 pb-[18px] pt-[10px]">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-ms-line bg-ms-card p-1.5 shadow-sm">
        {TABS.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li className="flex-1 list-none" key={tab.href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex h-[46px] w-full flex-col items-center justify-center gap-[2px] rounded-full text-[10px] font-bold transition ${
                  isActive ? "bg-ms-sunken text-ms-emphasis" : "text-ms-muted"
                }`}
                href={tab.href}
              >
                <Icon fill={isActive && tab.href === "/" ? "currentColor" : "none"} size={19} strokeWidth={isActive ? 2.3 : 1.9} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * 로그인 여부와 강아지 등록 여부에 따라 무엇을 보여줄지 정한다.
 *
 * - 로그인 전: 탭 없이 로그인 화면만
 * - 로그인 후 강아지 미등록: 탭은 보이되 어느 탭이든 등록 안내로 대체
 * - 강아지 등록 완료: 탭 + 각 탭의 내용
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isRestored, token, status } = useAuth();

  if (!isRestored) {
    return (
      <main className="grid min-h-screen place-items-center bg-ms-page p-6 text-sm font-bold text-ms-muted">
        불러오는 중이에요...
      </main>
    );
  }

  if (!token) {
    return <AuthScreen />;
  }

  const needsOnboarding = status !== null && status.nextStep !== "complete";

  // 각 화면이 meoksa_FE 디자인 그대로 375px 모바일 프레임을 스스로 그리므로,
  // 여기서는 패딩 있는 래퍼를 씌우지 않고 콘텐츠를 그대로 내보낸다.
  // 하단 탭바만 공통으로 얹는다.
  return (
    <>
      {needsOnboarding ? <OnboardingScreen /> : children}
      <TabBar />
    </>
  );
}
