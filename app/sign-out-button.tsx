"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "./auth-context";
import { Button } from "./ui";

/**
 * 리팩터링 전 "계정 연결됨" 카드에 있던 로그아웃을 옮긴 것.
 * 작업 12에서 마이페이지를 제대로 만들 때 그 화면 안으로 흡수된다.
 */
export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <Button type="button" variant="outline" onClick={signOut}>
      <LogOut size={17} /> 로그아웃
    </Button>
  );
}
