import "dotenv/config";
import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("*"),
  AUTH_EMAIL_REDIRECT_TO: z
    .preprocess(emptyStringToUndefined, z.string().url().optional())
    .default("http://localhost:5173/auth/callback"),
  SUPABASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyStringToUndefined,
    z.string().optional()
  ),
  /** 공공데이터포털 서비스키. 기상청 단기예보, 에어코리아 대기오염정보,
   * 그리고 11회차의 표준데이터 적재 배치가 모두 이 하나의 키를 공유한다
   * (spec 4.1 note 1: "3번부터 16번까지 공공데이터포털 계정 하나로 신청
   * 가능"). */
  PUBLIC_DATA_API_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
  /** GraphHopper 셀프호스팅 인스턴스의 base URL (6회차). */
  GRAPHHOPPER_URL: z
    .preprocess(emptyStringToUndefined, z.string().url().optional())
    .default("http://localhost:8989"),
  /** TMAP(SK Open API) 앱 키. 공공데이터포털 키와는 별개 발급 (12회차,
   * 횡단보도/계단 비동기 검증). */
  TMAP_APP_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
  /** VWorld(vworld.kr) 인증키. 공공데이터포털 키와는 별개 발급 — dog_density
   * 적재 시 읍면동 행정경계 조회에 사용 (ingest-dog-density.ts). */
  VWORLD_API_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
  OPENAI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
  KAKAO_MAP_APP_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
  KAKAO_REST_API_KEY: z.preprocess(emptyStringToUndefined, z.string().optional())
});

export const env = envSchema.parse(process.env);
