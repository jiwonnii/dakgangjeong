"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingOptions, OnboardingStatus } from "./lib/types";

const TOKEN_STORAGE_KEY = "meoksa-access-token";

type AuthContextValue = {
  /** 로그인 토큰. 빈 문자열이면 로그아웃 상태다. */
  token: string;
  /** localStorage 복원이 끝났는지. 끝나기 전에 로그인 화면을 그리면 깜빡인다. */
  isRestored: boolean;
  status: OnboardingStatus | null;
  options: OnboardingOptions | null;
  primaryDog: OnboardingStatus["dogs"][number] | null;
  kakaoMapAppKey: string;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  refreshStatus: (nextToken?: string) => Promise<void>;
  signIn: (nextToken: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth 는 AuthProvider 안에서만 쓸 수 있어요.");
  }

  return value;
}

export function AuthProvider({
  kakaoMapAppKey,
  children
}: {
  kakaoMapAppKey: string;
  children: React.ReactNode;
}) {
  const [token, setToken] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [options, setOptions] = useState<OnboardingOptions | null>(null);

  // api() 가 매 렌더마다 새 함수가 되면 이걸 의존성으로 쓰는 effect 들이
  // 무한히 다시 돈다. 토큰은 ref 로 읽어서 api() 자체는 고정해 둔다.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const currentToken = tokenRef.current;
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...(init?.headers ?? {})
      }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const apiMessage = payload?.error?.message ?? payload?.message;
      throw new Error(apiMessage ?? `API 요청에 실패했어요. (${response.status})`);
    }

    return payload as T;
  }, []);

  const refreshStatus = useCallback(
    async (nextToken?: string) => {
      const activeToken = nextToken ?? tokenRef.current;

      if (!activeToken) {
        return;
      }

      const response = await fetch("/api/onboarding/status", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "온보딩 상태를 불러오지 못했어요.");
      }

      setStatus(payload);
    },
    []
  );

  const signIn = useCallback(
    async (nextToken: string) => {
      setToken(nextToken);
      tokenRef.current = nextToken;
      window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      await refreshStatus(nextToken);
    },
    [refreshStatus]
  );

  const signOut = useCallback(() => {
    setToken("");
    tokenRef.current = "";
    setStatus(null);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    setToken(savedToken);
    tokenRef.current = savedToken;

    api<OnboardingOptions>("/api/onboarding/options")
      .then(setOptions)
      .catch(() => setOptions(null));

    if (!savedToken) {
      setIsRestored(true);
      return;
    }

    refreshStatus(savedToken)
      .catch(() => {
        // 토큰이 만료됐을 수 있다. 로그인 화면으로 되돌린다.
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
        tokenRef.current = "";
      })
      .finally(() => setIsRestored(true));
  }, [api, refreshStatus]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isRestored,
      status,
      options,
      primaryDog: status?.dogs[0] ?? null,
      kakaoMapAppKey,
      api,
      refreshStatus,
      signIn,
      signOut
    }),
    [token, isRestored, status, options, kakaoMapAppKey, api, refreshStatus, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
