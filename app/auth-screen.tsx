"use client";

import { Eye, EyeOff, PawPrint } from "lucide-react";
import { useState, type FormEvent } from "react";
import { WelcomeHero } from "./_components/WelcomeHero";
import { useAuth } from "./auth-context";

export function AuthScreen() {
  const { api, signIn } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
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
    <main className="flex min-h-screen w-full justify-center overflow-x-hidden bg-ms-page text-ms-ink">
      <section className="flex min-h-screen w-[min(100vw,375px)] max-w-[375px] flex-col pb-8">
        <WelcomeHero />

        <h1 className="mt-8 text-center text-[26px] font-extrabold leading-none text-ms-emphasis-blue">
          {isSignIn ? "산책하게" : "가입하기"}
        </h1>

        <form className="mt-10 flex flex-col gap-5 px-6" onSubmit={handleSubmit}>
          <div className="overflow-hidden rounded-[24px] bg-ms-card shadow-lg">
            <input
              className="h-[56px] w-full bg-transparent px-5 text-[16px] font-semibold text-ms-ink outline-none placeholder:text-ms-muted"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="이메일"
              required
              type="email"
              value={email}
            />
            <div className="h-px bg-ms-line" />
            <div className="flex h-[56px] items-center">
              <div className="relative h-full min-w-0 flex-1">
                <input
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  className={`h-full w-full bg-transparent px-5 text-[16px] font-semibold outline-none placeholder:text-ms-muted ${
                    isPasswordVisible ? "text-ms-ink caret-ms-ink" : "text-transparent caret-transparent"
                  }`}
                  minLength={8}
                  onBlur={() => setIsPasswordFocused(false)}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  placeholder="비밀번호 (8자 이상)"
                  required
                  type="text"
                  value={password}
                />
                {!isPasswordVisible && (password.length > 0 || isPasswordFocused) ? (
                  <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center gap-[3px]">
                    {Array.from({ length: password.length }, (_, index) => (
                      <PawPrint className="text-ms-ink" fill="currentColor" key={index} size={12} strokeWidth={0} />
                    ))}
                    {isPasswordFocused ? <span className="h-[18px] w-[1.5px] animate-pulse bg-ms-ink" /> : null}
                  </div>
                ) : null}
              </div>
              <button
                aria-label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="mr-4 shrink-0 text-ms-muted"
                onClick={() => setIsPasswordVisible((value) => !value)}
                type="button"
              >
                {isPasswordVisible ? <EyeOff size={19} strokeWidth={2} /> : <Eye size={19} strokeWidth={2} />}
              </button>
            </div>
          </div>

          {(message || error) && (
            <p
              className={`rounded-[16px] px-4 py-3 text-center text-[13px] font-bold ${
                error ? "bg-ms-warn-bg text-ms-warn-fg" : "bg-ms-ok-bg text-ms-ok-fg"
              }`}
            >
              {error || message}
            </p>
          )}

          <div className="flex flex-col items-center gap-4">
            <button
              className="flex h-14 w-full items-center justify-center rounded-full bg-ms-emphasis-blue text-[17px] font-extrabold text-white shadow-lg transition active:scale-[0.99] active:opacity-90 disabled:opacity-60"
              disabled={isBusy}
              type="submit"
            >
              {isSignIn ? "로그인" : "가입하기"}
            </button>
            <button
              className="text-[14px] font-bold text-ms-emphasis-blue"
              onClick={() => setMode(isSignIn ? "signUp" : "signIn")}
              type="button"
            >
              {isSignIn ? "계정이 없으신가요? 가입하기" : "이미 계정이 있으신가요? 로그인"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
