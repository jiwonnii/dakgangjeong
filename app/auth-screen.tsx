"use client";

import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "./auth-context";

export function AuthScreen() {
  const { api, signIn } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const isSignIn = mode === "signIn";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signUp") {
        await api("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, confirmPassword: password })
        });
        setMessage("가입 메일을 보냈어요. 메일 확인 후 로그인해 주세요.");
        return;
      }

      const payload = await api<{ session: { access_token: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      await signIn(payload.session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했어요.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-ms-page text-ms-ink sm:flex sm:justify-center">
      <section className="flex min-h-screen w-[min(100vw,375px)] max-w-[375px] flex-col bg-ms-page px-6 pb-8 pt-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img alt="산책가개" className="h-12 w-12 rounded-[14px] object-cover shadow-sm" src="/logo.png" />
            <div>
              <p className="text-[13px] font-semibold leading-none text-ms-muted">도시 반려견 산책 판단</p>
              <h1 className="mt-1 text-[22px] font-extrabold leading-none tracking-normal text-ms-ink">산책가개</h1>
            </div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-ms-sunken text-ms-emphasis">
            <ShieldCheck size={19} strokeWidth={2.2} />
          </div>
        </header>

        <section className="mt-12">
          <p className="text-[15px] font-bold leading-none text-ms-emphasis">
            {isSignIn ? "다시 만나서 반가워요" : "처음 산책을 준비해요"}
          </p>
          <h2 className="mt-4 text-[32px] font-extrabold leading-[1.18] tracking-normal text-ms-ink">
            오늘 산책이
            <br />
            괜찮은지 먼저
            <br />
            확인해드릴게요.
          </h2>
          <p className="mt-5 text-[17px] font-medium leading-[1.55] tracking-normal text-ms-secondary">
            위치와 날씨, 강아지 상태를 보고 무리 없는 산책 범위를 알려드려요.
          </p>
        </section>

        <form className="mt-10 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 rounded-full bg-ms-sunken p-1">
            <button
              className={`h-11 rounded-full text-[15px] font-extrabold transition ${
                isSignIn ? "bg-ms-brand text-ms-on-brand shadow-sm" : "text-ms-muted"
              }`}
              onClick={() => setMode("signIn")}
              type="button"
            >
              로그인
            </button>
            <button
              className={`h-11 rounded-full text-[15px] font-extrabold transition ${
                !isSignIn ? "bg-ms-brand text-ms-on-brand shadow-sm" : "text-ms-muted"
              }`}
              onClick={() => setMode("signUp")}
              type="button"
            >
              가입하기
            </button>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-bold leading-none text-ms-secondary">이메일</span>
            <span className="flex h-14 items-center gap-3 rounded-[18px] border border-ms-line bg-ms-card px-4 transition focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
              <Mail className="shrink-0 text-ms-muted" size={19} strokeWidth={2.1} />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-semibold text-ms-ink outline-none placeholder:text-ms-muted"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-bold leading-none text-ms-secondary">비밀번호</span>
            <span className="flex h-14 items-center gap-3 rounded-[18px] border border-ms-line bg-ms-card px-4 transition focus-within:border-ms-line-strong focus-within:ring-4 focus-within:ring-[rgba(250,125,56,0.14)]">
              <LockKeyhole className="shrink-0 text-ms-muted" size={19} strokeWidth={2.1} />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-semibold text-ms-ink outline-none placeholder:text-ms-muted"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8자 이상 입력"
                required
                type="password"
                value={password}
              />
            </span>
          </label>

          <button
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ms-brand text-[17px] font-extrabold text-ms-on-brand transition active:scale-[0.99] active:bg-ms-brand-pressed disabled:opacity-60"
            disabled={isBusy}
            type="submit"
          >
            {isSignIn ? "이메일로 로그인" : "이메일로 가입"}
            <ArrowRight size={19} strokeWidth={2.4} />
          </button>
        </form>

        {(message || error) && (
          <p
            className={`mt-4 rounded-[16px] px-4 py-3 text-center text-[13px] font-bold ${
              error ? "bg-ms-warn-bg text-ms-warn-fg" : "bg-ms-ok-bg text-ms-ok-fg"
            }`}
          >
            {error || message}
          </p>
        )}

        <p className="mt-5 text-center text-[13px] font-medium leading-[1.5] text-ms-muted">
          로그인하면 산책 판단, 기록, 공동 보호자 체크리스트를 이어서 볼 수 있어요.
        </p>

        <div className="mt-auto pt-10">
          <div className="rounded-[22px] bg-ms-sunken px-5 py-4">
            <p className="text-[14px] font-extrabold leading-none text-ms-ink">오늘의 시작</p>
            <p className="mt-2 text-[14px] font-medium leading-[1.45] text-ms-secondary">
              산책은 기록 경쟁이 아니라 강아지에게 맞는 리듬을 찾는 일이에요.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
