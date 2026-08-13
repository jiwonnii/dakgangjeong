"use client";

import { CalendarDays, Footprints, Home, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-context";
import { AuthScreen } from "./auth-screen";
import { OnboardingScreen } from "./onboarding-screen";

const TABS = [
  { href: "/", label: "메인", icon: Home },
  { href: "/walk", label: "산책하기", icon: Footprints },
  { href: "/records", label: "기록", icon: CalendarDays },
  { href: "/sharing", label: "셰어링", icon: Users },
  { href: "/my", label: "마이페이지", icon: UserRound }
] as const;

function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white">
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-5">
        {TABS.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`grid min-h-[60px] content-center justify-items-center gap-1 py-2 text-xs font-black ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                href={tab.href}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
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
      <main className="grid min-h-screen place-items-center p-6 text-sm font-bold text-muted-foreground">
        불러오는 중이에요...
      </main>
    );
  }

  if (!token) {
    return <AuthScreen />;
  }

  const needsOnboarding = status !== null && status.nextStep !== "complete";

  return (
    <>
      <main className="mx-auto grid w-full max-w-3xl content-start gap-4 p-4 pb-24">
        {needsOnboarding ? <OnboardingScreen /> : children}
      </main>
      <TabBar />
    </>
  );
}
