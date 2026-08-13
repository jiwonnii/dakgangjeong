import type { Metadata, Viewport } from "next";
import { AppShell } from "./app-shell";
import { AuthProvider } from "./auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meoksa",
  description: "AI 반려견 산책 코스 추천",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Meoksa"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2d7051"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider kakaoMapAppKey={process.env.KAKAO_MAP_APP_KEY ?? ""}>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
