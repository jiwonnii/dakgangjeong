import "dotenv/config";
import { z } from "zod";
const emptyStringToUndefined = (value) => {
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
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyStringToUndefined, z.string().optional())
});
export const env = envSchema.parse(process.env);
