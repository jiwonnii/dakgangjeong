"use client";

import { useEffect, useRef } from "react";

/**
 * 로그인 전 웰컴 히어로. 로고가 화면 오른쪽 밖에서 통통 튀어 들어와 가운데서 멈춘다.
 *
 * 키프레임을 나열하지 않고 매 프레임 계산한다. 핵심은 튐을 "시간"이 아니라
 * "이동한 거리"에 묶는 것 — 다가오며 감속할 때 튐도 같이 잦아들어서 발이
 * 바닥에서 미끄러지지 않는다. 아래 수치는 목업에서 확정한 값이라 임의로
 * 키우면 금방 과해진다 (튐 높이는 몸 높이의 10% 선).
 */

const STAGE = 250; // 무대 한 변
const DOG = 150; // 로고 한 변
const GROUND_Y = 172; // 발이 닿는 바닥선 (무대 좌표)

const START_X = 250; // 화면 오른쪽 밖 시작 위치
const START_S = 0.68; // 멀리 있을 때 크기
const END_S = 1;
const LIFT = 18; // 멀수록 화면 위쪽에 (원근)

const HOP = 16; // 튐 높이
const GAP = 58; // 한 번 튈 때마다의 이동 거리
const SQ = 0.08; // 눌림/늘어남 정도
const TRAVEL_MS = 2400; // 들어오는 데 걸리는 시간
const SETTLE_MS = 1100; // 도착 후 잔탄
const SETTLE_BOUNCE_MS = 300;

/** 이동 곡선: 일정하게 오다가 마지막에 감속해서 멈춘다. */
function travelled(t: number) {
  const easeOutCubic = (v: number) => 1 - Math.pow(1 - v, 3);
  return t < 0.72 ? (t / 0.72) * 0.8 : 0.8 + 0.2 * easeOutCubic((t - 0.72) / 0.28);
}

/** 한 번의 튐 안에서의 모양. f: 0(착지) → 1(다음 착지) */
function shape(f: number, amp: number) {
  const air = 4 * f * (1 - f); // 포물선 궤적
  const edge = Math.min(f, 1 - f);
  const sq = Math.pow(Math.max(0, 1 - edge / 0.17), 2); // 닿는 순간에만
  return {
    air,
    sx: 1 + SQ * 0.9 * sq * amp - SQ * 0.35 * air * amp,
    sy: 1 - SQ * sq * amp + SQ * 0.5 * air * amp,
    rot: -2 * Math.sin(Math.PI * f) * amp
  };
}

export function WelcomeHero({ onArrive }: { onArrive?: () => void }) {
  const dogRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const arriveRef = useRef(onArrive);

  arriveRef.current = onArrive;

  useEffect(() => {
    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      arriveRef.current?.();
    };
    // 연출이 어떤 이유로든 끝까지 못 가도 로그인 폼은 반드시 뜬다.
    // (아래 UI가 도착 신호를 기다려 나타나므로, 이게 없으면 폼이 영영 안 보인다)
    const failsafe = window.setTimeout(announce, TRAVEL_MS + 400);

    const dog = dogRef.current;
    const inner = innerRef.current;
    const shadow = shadowRef.current;
    const ring = ringRef.current;
    if (!dog || !inner || !shadow || !ring) {
      announce();
      return () => window.clearTimeout(failsafe);
    }

    const rest = () => {
      dog.style.transform = "translate(0px,0px) rotate(0deg) scale(1,1)";
      shadow.style.transform = "translate(0px,0px) scale(1,1)";
      shadow.style.opacity = "0.42";
      inner.style.animation = "welcome-hero-breathe 2.4s ease-in-out infinite";
      ring.style.opacity = "1";
      ring.style.animation = "welcome-hero-pulse-ring 2.6s ease-in-out infinite";
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rest();
      announce();
      return () => window.clearTimeout(failsafe);
    }

    let raf = 0;
    let start = 0;
    let prev = 0;
    let phase = 0;
    let lastX = START_X;

    const frame = (now: number) => {
      if (!start) {
        start = now;
        prev = now;
      }
      const elapsed = now - start;
      const dt = Math.min(48, now - prev);
      prev = now;

      let x: number;
      let s: number;
      let amp: number;
      let done = false;

      if (elapsed < TRAVEL_MS) {
        const d = travelled(elapsed / TRAVEL_MS);
        x = START_X * (1 - d);
        s = START_S + (END_S - START_S) * d;
        amp = 1;
        phase += Math.abs(x - lastX) / (GAP * s); // 튐을 이동 거리에 묶는다
        lastX = x;
      } else {
        const u = Math.min(1, (elapsed - TRAVEL_MS) / SETTLE_MS);
        x = 0;
        s = 1;
        amp = Math.pow(1 - u, 2.1); // 잔탄이 잦아든다
        phase += dt / SETTLE_BOUNCE_MS;
        done = u >= 1;
      }

      const m = shape(phase - Math.floor(phase), amp);
      const hop = HOP * m.air * amp * s;
      const lift = -(1 - s) * LIFT;

      dog.style.transform =
        `translate(${x}px,${lift - hop}px) rotate(${m.rot}deg) scale(${s * m.sx},${s * m.sy})`;
      shadow.style.transform =
        `translate(${x}px,${lift}px) scale(${s * (1 - 0.24 * m.air * amp)},${s * (1 - 0.26 * m.air * amp)})`;
      shadow.style.opacity = String((0.42 - 0.17 * m.air * amp) * (0.5 + 0.5 * s));

      if (!announced && elapsed >= TRAVEL_MS) {
        ring.style.opacity = "1";
        announce();
      }

      if (done) {
        rest();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <div className="relative flex w-full justify-center overflow-hidden bg-ms-page pb-4 pt-10">
      <div className="relative" style={{ width: STAGE, height: STAGE }}>
        {/* 바닥면 — 3D로 읽히게 하는 접지면 */}
        <div
          className="pointer-events-none absolute left-1/2"
          style={{
            top: GROUND_Y,
            width: 320,
            height: 74,
            marginLeft: -160,
            marginTop: -37,
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(12,12,12,.05) 0%, transparent 72%)"
          }}
        />

        {/* 도착 후 켜지는 후광 */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full opacity-0 transition-opacity duration-500"
          ref={ringRef}
          style={{
            width: 196,
            height: 196,
            marginLeft: -98,
            marginTop: -98,
            background: "radial-gradient(circle, rgba(255,187,0,.46) 0%, transparent 70%)"
          }}
        />

        {/* 접지 그림자 — 닿는 순간 좁고 진하게 조여든다 */}
        <div
          className="absolute left-1/2 rounded-full opacity-0"
          ref={shadowRef}
          style={{
            top: GROUND_Y,
            width: 120,
            height: 28,
            marginLeft: -60,
            marginTop: -14,
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(12,12,12,.44) 0%, rgba(12,12,12,.14) 48%, transparent 74%)",
            willChange: "transform, opacity"
          }}
        />

        <div
          className="absolute left-1/2 top-1/2"
          ref={dogRef}
          style={{
            width: DOG,
            height: DOG,
            marginLeft: -DOG / 2,
            marginTop: -DOG / 2,
            transformOrigin: "50% 84%", // 발이 닿는 지점 — 눌려도 바닥에 붙어 있게
            willChange: "transform"
          }}
        >
          <div className="h-full w-full" ref={innerRef}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="산책하개 로고"
              className="h-full w-full object-contain"
              src="/logo.png"
              style={{ filter: "drop-shadow(0 12px 18px rgba(20, 10, 5, 0.22))" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
