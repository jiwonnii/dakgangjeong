import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { getSupabaseAdminClient, getSupabaseClient } from "../../lib/supabase.js";
function isEmailVerified(user) {
    return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}
function getBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        throw new AppError("Bearer token is required.", 401, "AUTH_REQUIRED");
    }
    return authHeader.slice("Bearer ".length);
}
async function deletePublicAccountData(userId) {
    const supabase = getSupabaseAdminClient();
    const { data: ownedDogs, error: ownedDogsError } = await supabase
        .from("dogs")
        .select("id")
        .eq("owner_id", userId);
    if (ownedDogsError) {
        throw new AppError(ownedDogsError.message, 500, "ACCOUNT_DATA_LOOKUP_FAILED");
    }
    const ownedDogIds = (ownedDogs ?? []).map((dog) => dog.id);
    if (ownedDogIds.length > 0) {
        const ownedDogCleanupResults = await Promise.all([
            supabase.from("care_notes").delete().in("dog_id", ownedDogIds),
            supabase.from("care_tasks").delete().in("dog_id", ownedDogIds),
            supabase.from("walk_records").delete().in("dog_id", ownedDogIds),
            supabase.from("dog_guardians").delete().in("dog_id", ownedDogIds)
        ]);
        const ownedDogCleanupError = ownedDogCleanupResults.find((result) => result.error)?.error;
        if (ownedDogCleanupError) {
            throw new AppError(ownedDogCleanupError.message, 500, "OWNED_DOG_DATA_DELETE_FAILED");
        }
        const { error: ownedDogsDeleteError } = await supabase
            .from("dogs")
            .delete()
            .in("id", ownedDogIds);
        if (ownedDogsDeleteError) {
            throw new AppError(ownedDogsDeleteError.message, 500, "OWNED_DOG_DELETE_FAILED");
        }
    }
    const userCleanupResults = await Promise.all([
        supabase.from("care_notes").delete().eq("user_id", userId),
        supabase.from("walk_records").delete().eq("user_id", userId),
        supabase.from("care_tasks").update({ completed_by: null }).eq("completed_by", userId),
        supabase.from("dog_guardians").delete().eq("user_id", userId),
        supabase.from("guardian_profiles").delete().eq("id", userId)
    ]);
    const userCleanupError = userCleanupResults.find((result) => result.error)?.error;
    if (userCleanupError) {
        throw new AppError(userCleanupError.message, 500, "ACCOUNT_DATA_DELETE_FAILED");
    }
}
export const signUpWithEmail = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: env.AUTH_EMAIL_REDIRECT_TO
            }
        });
        if (error) {
            throw new AppError(error.message, 400, "SIGNUP_FAILED");
        }
        res.status(201).json({
            message: "Verification email has been sent.",
            verificationMethod: "email-link",
            emailVerificationRequired: !data.session,
            user: data.user
                ? {
                    id: data.user.id,
                    email: data.user.email
                }
                : null
        });
    }
    catch (error) {
        next(error);
    }
};
export const verifyEmailOtp = async (req, res, next) => {
    try {
        const { email, token } = req.body;
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: "email"
        });
        if (error) {
            throw new AppError(error.message, 400, "EMAIL_VERIFICATION_FAILED");
        }
        res.json({
            message: "Email has been verified.",
            user: data.user
                ? {
                    id: data.user.id,
                    email: data.user.email,
                    emailVerified: isEmailVerified(data.user)
                }
                : null,
            session: data.session
        });
    }
    catch (error) {
        next(error);
    }
};
export const signInWithEmail = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            throw new AppError(error.message, 401, "LOGIN_FAILED");
        }
        res.json({
            user: data.user
                ? {
                    id: data.user.id,
                    email: data.user.email,
                    emailVerified: isEmailVerified(data.user)
                }
                : null,
            session: data.session
        });
    }
    catch (error) {
        next(error);
    }
};
export const resendVerificationEmail = async (req, res, next) => {
    try {
        const { email } = req.body;
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
                emailRedirectTo: env.AUTH_EMAIL_REDIRECT_TO
            }
        });
        if (error) {
            throw new AppError(error.message, 400, "RESEND_VERIFICATION_FAILED");
        }
        res.json({
            message: "Verification email has been resent.",
            verificationMethod: "email-link"
        });
    }
    catch (error) {
        next(error);
    }
};
export const getMe = (req, res) => {
    res.json({
        user: {
            id: req.authUser?.id,
            email: req.authUser?.email,
            emailVerified: req.authUser ? isEmailVerified(req.authUser) : false
        }
    });
};
export const signOut = async (req, res, next) => {
    try {
        const token = getBearerToken(req);
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.auth.admin.signOut(token, "global");
        if (error) {
            throw new AppError(error.message, 400, "LOGOUT_FAILED");
        }
        res.json({
            message: "Signed out."
        });
    }
    catch (error) {
        next(error);
    }
};
export const deleteAccount = async (req, res, next) => {
    try {
        if (!req.authUser?.id) {
            throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
        }
        const supabase = getSupabaseAdminClient();
        await deletePublicAccountData(req.authUser.id);
        const { error } = await supabase.auth.admin.deleteUser(req.authUser.id);
        if (error) {
            throw new AppError(error.message, 500, "ACCOUNT_DELETE_FAILED");
        }
        res.json({
            message: "Account has been deleted."
        });
    }
    catch (error) {
        next(error);
    }
};
