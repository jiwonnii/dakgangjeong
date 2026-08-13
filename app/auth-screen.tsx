"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "./auth-context";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "./ui";

const authSchema = z.object({
  email: z.string().trim().email("이메일 형식이 올바르지 않아요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요."),
  confirmPassword: z.string().optional()
});

export function AuthScreen() {
  const { api, signIn } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const authForm = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" }
  });

  async function submitAuth(values: z.infer<typeof authSchema>) {
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      if (authMode === "signup") {
        if (values.password !== values.confirmPassword) {
          throw new Error("비밀번호 확인이 일치하지 않아요.");
        }

        await api("/api/auth/signup", { method: "POST", body: JSON.stringify(values) });
        setMessage("가입 메일을 보냈어요. 메일 확인 후 로그인해 주세요.");
        return;
      }

      const payload = await api<{ session: { access_token: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: values.email, password: values.password })
      });
      await signIn(payload.session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했어요.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md content-start gap-4 p-4">
      <div className="rounded-lg bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-black uppercase tracking-normal opacity-75">Meoksa</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">강아지 산책 추천</h1>
        <p className="mt-3 text-sm font-semibold opacity-80">
          날씨와 미세먼지를 보고 오늘 산책해도 좋은지 알려드려요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn size={20} /> 로그인 / 회원가입
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={authMode === "login" ? "default" : "outline"}
              onClick={() => setAuthMode("login")}
            >
              로그인
            </Button>
            <Button
              type="button"
              variant={authMode === "signup" ? "default" : "outline"}
              onClick={() => setAuthMode("signup")}
            >
              회원가입
            </Button>
          </div>
          <form className="grid gap-3" onSubmit={authForm.handleSubmit(submitAuth)}>
            <Input placeholder="email@example.com" {...authForm.register("email")} />
            <Input placeholder="비밀번호" type="password" {...authForm.register("password")} />
            {authMode === "signup" && (
              <Input placeholder="비밀번호 확인" type="password" {...authForm.register("confirmPassword")} />
            )}
            <Button disabled={isBusy} type="submit">
              {isBusy ? <RefreshCw className="animate-spin" size={17} /> : <LogIn size={17} />}
              {authMode === "login" ? "로그인" : "가입 메일 받기"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(message || error) && (
        <div
          className={`rounded-lg border p-3 text-sm font-bold ${
            error ? "border-destructive/30 bg-red-50 text-destructive" : "border-primary/20 bg-green-50 text-primary"
          }`}
        >
          {error || message}
        </div>
      )}
    </main>
  );
}
