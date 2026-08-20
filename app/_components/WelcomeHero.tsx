import type { CSSProperties, ReactNode } from "react";

type FloatIconProps = {
  left: number;
  top: number;
  animationName: string;
  duration: string;
  delay: string;
  children: ReactNode;
};

/**
 * 로고 주위를 도는 아이콘 하나의 위치·리듬을 잡는 래퍼.
 * left/top 값은 로고 링(210px)·서로와 겹치지 않도록 원형으로 계산해둔 좌표라
 * 임의로 조금씩만 옮겨야 한다 (겹치면 안 됨).
 */
function FloatIcon({ left, top, animationName, duration, delay, children }: FloatIconProps) {
  const style: CSSProperties = {
    left,
    top,
    filter: "drop-shadow(0 6px 10px rgba(20, 10, 30, 0.16))",
    transformOrigin: "50% 50%",
    animation: `${animationName} ${duration} ease-in-out infinite`,
    animationDelay: delay
  };

  return (
    <div className="absolute flex items-center justify-center" style={style}>
      {children}
    </div>
  );
}

/**
 * 로그인 전 웰컴 히어로. Phantom 온보딩의 "떠다니는 아이콘 클러스터" 연출을
 * 먹사의 산책 소품(발자국·뼈다귀·목줄·경로 핀·해)으로 다시 그린 것.
 * 각 좌표·주기는 겹침 없이 로고 링에 최대한 붙도록 검증해둔 값이다.
 */
export function WelcomeHero() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 260px 190px at 30% 8%, color-mix(in srgb, var(--p-ember-600) 42%, white) 0%, transparent 88%), " +
          "radial-gradient(ellipse 280px 200px at 74% 4%, color-mix(in srgb, var(--p-periwinkle-400) 40%, white) 0%, transparent 88%), " +
          "var(--p-gray-50)",
        backgroundBlendMode: "screen, screen, normal"
      }}
    >
      <div className="flex items-center justify-center pb-4 pt-10">
        <div className="relative" style={{ width: 328, height: 328 }}>
          {/* 로고 */}
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <div
              className="absolute rounded-full"
              style={{
                width: 210,
                height: 210,
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--p-ember-300) 55%, transparent) 0%, transparent 72%)",
                animation: "welcome-hero-pulse-ring 2s ease-in-out infinite"
              }}
            />
            <div
              className="relative flex items-center justify-center"
              style={{ width: 172, height: 172, animation: "welcome-hero-breathe 2s ease-in-out infinite" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="먹사 로고"
                className="h-full w-full object-contain"
                src="/logo.png"
                style={{ filter: "drop-shadow(0 14px 22px rgba(20, 10, 5, 0.28))" }}
              />
            </div>
          </div>

          {/* 발자국 (주황) */}
          <FloatIcon animationName="welcome-hero-float-a" delay="-0.1s" duration="2.9s" left={147} top={9}>
            <svg fill="none" height="34" viewBox="0 0 34 34" width="34">
              <ellipse cx="17" cy="21" fill="var(--p-orange-500)" rx="8.4" ry="7.2" />
              <ellipse cx="6.5" cy="12.5" fill="var(--p-orange-500)" rx="3.4" ry="4.2" />
              <ellipse cx="14" cy="7" fill="var(--p-orange-500)" rx="3.6" ry="4.6" />
              <ellipse cx="22.5" cy="7.5" fill="var(--p-orange-500)" rx="3.6" ry="4.6" />
              <ellipse cx="28.5" cy="13.5" fill="var(--p-orange-500)" rx="3.2" ry="4" />
            </svg>
          </FloatIcon>

          {/* 뼈다귀 */}
          <FloatIcon animationName="welcome-hero-float-b" delay="-0.9s" duration="2.7s" left={263.5} top={82}>
            <svg fill="none" height="26" viewBox="0 0 40 26" width="40">
              <path
                d="M8 13c-1.6 0-2.9-1.3-2.9-3s1.3-3 2.9-3c1 0 1.9.5 2.4 1.3h19.2c.5-.8 1.4-1.3 2.4-1.3 1.6 0 2.9 1.3 2.9 3s-1.3 3-2.9 3c-1 0-1.9-.5-2.4-1.3H10.4C9.9 12.5 9 13 8 13z"
                fill="var(--p-ember-500)"
              />
              <circle cx="7" cy="8.5" fill="var(--p-ember-500)" r="3.2" />
              <circle cx="7" cy="17.5" fill="var(--p-ember-500)" r="3.2" />
              <circle cx="33" cy="8.5" fill="var(--p-ember-500)" r="3.2" />
              <circle cx="33" cy="17.5" fill="var(--p-ember-500)" r="3.2" />
            </svg>
          </FloatIcon>

          {/* 목줄 고리 */}
          <FloatIcon animationName="welcome-hero-float-d" delay="-0.3s" duration="3.1s" left={263.5} top={213}>
            <svg fill="none" height="40" viewBox="0 0 40 40" width="40">
              <circle cx="14" cy="10" fill="none" r="7" stroke="var(--p-periwinkle-400)" strokeWidth="3.4" />
              <path
                d="M18 15.5C24 19 30 22 34 30"
                fill="none"
                stroke="var(--p-periwinkle-400)"
                strokeLinecap="round"
                strokeWidth="3.4"
              />
              <circle cx="35.5" cy="32.5" fill="var(--p-periwinkle-400)" r="3" />
            </svg>
          </FloatIcon>

          {/* 경로 핀 */}
          <FloatIcon animationName="welcome-hero-drift" delay="-1.2s" duration="2.9s" left={146} top={281}>
            <svg fill="none" height="42" viewBox="0 0 36 42" width="36">
              <path
                d="M18 40C18 40 32 26.8 32 16.5C32 8.5 25.7 2 18 2C10.3 2 4 8.5 4 16.5C4 26.8 18 40 18 40Z"
                fill="var(--p-orange-600)"
              />
              <circle cx="18" cy="16" fill="#fff" r="6" />
              <path
                d="M13 16.5l3.4 3.4L23 13"
                fill="none"
                stroke="var(--p-orange-600)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </FloatIcon>

          {/* 발자국 (초록, 작게) */}
          <FloatIcon animationName="welcome-hero-float-c" delay="-0.6s" duration="3s" left={32.5} top={221}>
            <svg fill="none" height="24" viewBox="0 0 34 34" width="24">
              <ellipse cx="17" cy="21" fill="var(--p-green-500)" rx="8.4" ry="7.2" />
              <ellipse cx="6.5" cy="12.5" fill="var(--p-green-500)" rx="3.4" ry="4.2" />
              <ellipse cx="14" cy="7" fill="var(--p-green-500)" rx="3.6" ry="4.6" />
              <ellipse cx="22.5" cy="7.5" fill="var(--p-green-500)" rx="3.6" ry="4.6" />
              <ellipse cx="28.5" cy="13.5" fill="var(--p-green-500)" rx="3.2" ry="4" />
            </svg>
          </FloatIcon>

          {/* 해 — 3D로 계속 회전 */}
          <FloatIcon animationName="welcome-hero-drift-sun" delay="-1.6s" duration="3.3s" left={29.5} top={80}>
            <div style={{ perspective: 400 }}>
              <svg
                fill="none"
                height="30"
                style={{ animation: "welcome-hero-spin-y 2s linear infinite", transformStyle: "preserve-3d" }}
                viewBox="0 0 30 30"
                width="30"
              >
                <circle cx="15" cy="15" fill="var(--p-ember-300)" r="6.4" />
                <g stroke="var(--p-ember-300)" strokeLinecap="round" strokeWidth="2.2">
                  <path d="M15 1.5v3.6" />
                  <path d="M15 24.9v3.6" />
                  <path d="M28.5 15h-3.6" />
                  <path d="M5.1 15H1.5" />
                  <path d="M24.6 5.4l-2.5 2.5" />
                  <path d="M7.9 22.1l-2.5 2.5" />
                  <path d="M24.6 24.6l-2.5-2.5" />
                  <path d="M7.9 7.9L5.4 5.4" />
                </g>
              </svg>
            </div>
          </FloatIcon>

          {/* 반짝임 */}
          <FloatIcon animationName="welcome-hero-sparkle" delay="-0.4s" duration="2s" left={216} top={49}>
            <svg fill="none" height="18" viewBox="0 0 18 18" width="18">
              <path
                d="M9 0C9 5 13 9 18 9C13 9 9 13 9 18C9 13 5 9 0 9C5 9 9 5 9 0Z"
                fill="var(--p-periwinkle-300)"
              />
            </svg>
          </FloatIcon>
          <FloatIcon animationName="welcome-hero-sparkle" delay="-1.3s" duration="2.4s" left={96} top={263}>
            <svg fill="none" height="14" viewBox="0 0 18 18" width="14">
              <path d="M9 0C9 5 13 9 18 9C13 9 9 13 9 18C9 13 5 9 0 9C5 9 9 5 9 0Z" fill="var(--p-green-500)" />
            </svg>
          </FloatIcon>
        </div>
      </div>
    </div>
  );
}
