import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 레거시 별칭. 기존 화면 코드가 이 이름들을 그대로 쓰므로 새 토큰에 매핑만 한다.
        border: "var(--border)",
        background: "var(--surface-page)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--brand)",
          foreground: "var(--text-on-brand)"
        },
        muted: {
          DEFAULT: "var(--surface-sunken)",
          foreground: "var(--text-muted)"
        },
        destructive: {
          DEFAULT: "var(--status-alert)",
          foreground: "var(--text-on-dark)"
        },
        // 확정 팔레트 (meoksa_FE 이식). 새 화면은 이쪽만 쓴다.
        // 주의: ms.*/NN 형태의 투명도 모디파이어는 var() 토큰과 잘 안 맞는다.
        // 옅은 배경이 필요하면 ms-ok-bg, ms-warn-bg 같은 사전 정의 톤을 쓴다.
        ms: {
          brand: "var(--brand)",
          "brand-pressed": "var(--brand-pressed)",
          page: "var(--surface-page)",
          card: "var(--surface-card)",
          sunken: "var(--surface-sunken)",
          line: "var(--border)",
          "line-strong": "var(--border-strong)",
          "sky-top": "var(--surface-sky-top)",
          "sky-bottom": "var(--surface-sky-bottom)",
          ink: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          emphasis: "var(--text-emphasis)",
          "emphasis-green": "var(--text-emphasis-green)",
          "emphasis-blue": "var(--text-emphasis-blue)",
          "badge-blue": "var(--surface-badge-blue)",
          "on-brand": "var(--text-on-brand)",
          "on-sky": "var(--text-on-sky)",
          "on-dark": "var(--text-on-dark)",
          weather: "var(--surface-weather)",
          weekly: "var(--surface-weekly)",
          "on-weekly": "var(--text-on-weekly)",
          "on-weekly-secondary": "var(--text-on-weekly-secondary)",
          "action-green": "var(--action-green)",
          "action-green-pressed": "var(--action-green-pressed)",
          "on-green": "var(--text-on-green)",
          "walk-minimum": "var(--walk-minimum)",
          "walk-optimal": "var(--walk-optimal)",
          "walk-free": "var(--walk-free)",
          band: "var(--band-fill-solid)",
          "band-line": "var(--band-line)",
          route: "var(--map-route)",
          "ok-bg": "var(--status-ok-bg)",
          "ok-fg": "var(--status-ok-fg)",
          "warn-bg": "var(--status-warn-bg)",
          "warn-fg": "var(--status-warn-fg)"
        }
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px"
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
