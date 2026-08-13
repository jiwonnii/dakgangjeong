import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";
const clientOptions = {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
};
export const hasSupabaseConfig = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
export const supabase = hasSupabaseConfig
    ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, clientOptions)
    : null;
export const supabaseAdmin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions)
    : null;
export function getSupabaseClient() {
    if (!supabase) {
        throw new AppError("Supabase environment variables are missing.", 500, "SUPABASE_CONFIG_MISSING");
    }
    return supabase;
}
export function getSupabaseAdminClient() {
    if (!supabaseAdmin) {
        throw new AppError("Supabase service role environment variable is missing.", 500, "SUPABASE_ADMIN_CONFIG_MISSING");
    }
    return supabaseAdmin;
}
