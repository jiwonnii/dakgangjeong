"use client";

import { useState } from "react";
import { CalendarDays, LogOut, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

// 카드 배경 장식용 원. meoksa_FE MyPageScreen의 BUBBLE_DOTS를 단순화해 재사용했다.
const BUBBLE_DOTS = [
  { key: "0-0", left: -10, top: -18 },
  { key: "0-1", left: 44, top: -18 },
  { key: "0-2", left: 98, top: -18 },
  { key: "1-0", left: 18, top: 30 },
  { key: "1-1", left: 72, top: 30 },
  { key: "1-2", left: 126, top: 30 }
];

type SectionCardProps = {
  title: string;
  caption: string;
  children: React.ReactNode;
};

function SectionCard({ title, caption, children }: SectionCardProps) {
  return (
    <section className="rounded-[22px] border border-ms-line bg-ms-card shadow-sm">
      <div className="px-[18px] py-[16px]">
        <span className="block text-[16px] font-extrabold leading-none text-ms-ink">{title}</span>
        <span className="mt-[7px] block text-[12px] font-semibold leading-none text-ms-muted">{caption}</span>
      </div>
      <div className="border-t border-ms-line px-[18px] py-[16px]">{children}</div>
    </section>
  );
}

export default function MyTabPage() {
  const router = useRouter();
  const { api, isRestored, signOut, token } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage("");
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // 서버 세션 정리에 실패해도 이 기기의 로그인 상태는 지운다.
    } finally {
      signOut();
      router.replace("/");
      setIsSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("정말 탈퇴하시겠어요? 계정과 연결된 정보가 삭제돼요.")) return;
    setIsDeleting(true);
    setErrorMessage("");
    try {
      await api("/api/auth/account", { method: "DELETE" });
      signOut();
      router.replace("/");
    } catch {
      setErrorMessage("회원 탈퇴를 완료하지 못했어요.");
      setIsDeleting(false);
    }
  }

  if (!isRestored) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-ms-page px-6 text-sm font-bold text-ms-muted">
        마이페이지를 불러오는 중이에요.
      </main>
    );
  }
  if (!token) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-ms-page px-6 text-sm font-bold text-ms-muted">
        로그인이 필요해요.
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-ms-page text-ms-ink">
      <div className="w-full max-w-[354px] pb-[112px]">
        <section className="px-[24px] pb-[26px] pt-[60px]">
          <div className="flex items-center justify-between">
            <h1 className="text-[35px] font-extrabold leading-none tracking-[0]">Insight</h1>
            <Link
              aria-label="보호자·강아지 정보 수정"
              className="grid h-[42px] w-[42px] place-items-center rounded-full border border-ms-line bg-ms-card text-ms-emphasis shadow-sm"
              href="/my/profile"
            >
              <Settings size={21} strokeWidth={2} />
            </Link>
          </div>

          <div className="mt-[30px] flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold leading-none">내 활동 요약</h2>
          </div>

          {/*
            meoksa_FE는 여기서 4주치 잠금 카드 + 유료 "월간" 카드를 보여줬지만,
            백엔드에는 그런 결제/잠금 개념이 없다. 대신 실제 산책 기록이 있는
            /records로 바로 연결되는 카드 하나로 단순화했다. 시각적 언어(둥근
            모서리, 버블 장식, 카드 톤)는 FE 것을 그대로 가져왔다.
          */}
          <Link
            aria-label="산책 기록 보기"
            className="relative mt-[16px] block h-[130px] w-full overflow-hidden rounded-[24px] bg-ms-card shadow-sm"
            href="/records"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                maskImage: "linear-gradient(125deg, transparent 12%, black 60%)",
                WebkitMaskImage: "linear-gradient(125deg, transparent 12%, black 60%)"
              }}
            >
              {BUBBLE_DOTS.map((dot) => (
                <span
                  className="absolute h-[46px] w-[46px] rounded-full bg-ms-sunken"
                  key={dot.key}
                  style={{ left: dot.left, top: dot.top }}
                />
              ))}
            </div>
            <div className="relative flex h-full flex-col justify-between p-[18px]">
              <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-ms-sunken text-ms-emphasis">
                <CalendarDays size={18} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[17px] font-extrabold leading-none">내 산책 기록 보기</p>
                <p className="mt-[7px] text-[12px] font-semibold text-ms-muted">
                  캘린더, 연속 기록, 지난 산책을 한눈에 확인해요
                </p>
              </div>
            </div>
          </Link>
        </section>

        {errorMessage ? (
          <p className="mx-[24px] rounded-[14px] bg-ms-warn-bg px-[14px] py-[10px] text-[13px] font-extrabold text-ms-warn-fg">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-[10px] px-[24px]">
          <SectionCard caption="로그아웃 및 회원 탈퇴" title="계정">
            <div className="grid gap-[8px]">
              <button
                className="flex h-[48px] items-center justify-between rounded-[16px] bg-ms-sunken px-[14px] text-[14px] font-extrabold text-ms-ink disabled:opacity-55"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                <span className="flex items-center gap-[8px]">
                  <LogOut size={17} strokeWidth={2.2} />
                  {isSigningOut ? "로그아웃 중" : "로그아웃"}
                </span>
                <span className="text-[12px] font-bold text-ms-muted">현재 기기에서 나가기</span>
              </button>
              <button
                className="flex h-[48px] items-center justify-between rounded-[16px] border border-ms-line bg-ms-card px-[14px] text-[14px] font-extrabold text-ms-emphasis disabled:opacity-55"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                type="button"
              >
                <span className="flex items-center gap-[8px]">
                  <Trash2 size={17} strokeWidth={2.2} />
                  {isDeleting ? "탈퇴 중" : "회원 탈퇴"}
                </span>
                <span className="text-[12px] font-bold text-ms-muted">계정 삭제</span>
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
