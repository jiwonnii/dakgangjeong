import { z } from "zod";
const birthDateMin = "1990-01-01";
function getTodayDateString(date = new Date()) {
    const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}
function isDateOnly(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function isAllowedBirthDate(value) {
    if (!isDateOnly(value)) {
        return false;
    }
    return value >= birthDateMin && value <= getTodayDateString();
}
const weightKgSchema = z.preprocess((value) => {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? value : Number(trimmed);
    }
    return value;
}, z.number().positive().max(100));
export const dogSocialPreferenceValues = [
    "likes_dogs",
    "avoids_dogs",
    "neutral"
];
export const dogPersonalityTagValues = [
    "afraid_of_people",
    "afraid_of_cars",
    "likes_parks",
    "likes_people",
    "likes_new_routes"
];
const booleanFromFormSchema = z.preprocess((value) => {
    if (typeof value === "string") {
        return value === "true";
    }
    return value;
}, z.boolean());
export const guardianProfileSchema = z.object({
    displayName: z.string().trim().min(1).max(40),
    locationPermissionAgreed: booleanFromFormSchema.default(false),
    notificationPermissionAgreed: booleanFromFormSchema.default(false),
    marketingAgreed: booleanFromFormSchema.default(false)
});
export const createDogOnboardingSchema = z.object({
    name: z.string().trim().min(1).max(40),
    breed: z.string().trim().min(1).max(80),
    birthDate: z.string().refine(isAllowedBirthDate, {
        message: `Birth date must be between ${birthDateMin} and today.`
    }),
    weightKg: weightKgSchema.refine((value) => Number.isInteger(value * 10), {
        message: "Weight must have at most one decimal place."
    }),
    socialPreference: z.enum(dogSocialPreferenceValues).default("neutral"),
    personalityTags: z
        .array(z.enum(dogPersonalityTagValues))
        .max(3, "Personality tags can include up to 3 items.")
        .default([])
        .refine((values) => new Set(values).size === values.length, {
        message: "Personality tags must be unique."
    })
});
export const joinDogByInviteCodeSchema = z.object({
    inviteCode: z
        .string()
        .trim()
        .min(4)
        .max(20)
        .transform((value) => value.toUpperCase())
});
export function getOnboardingOptionsBase() {
    return {
        birthDateMin,
        birthDateMax: getTodayDateString(),
        weight: {
            unit: "kg",
            maxDecimalPlaces: 1
        },
        socialPreferences: [
            {
                value: "likes_dogs",
                label: "\uadf8\ub807\ub2e4"
            },
            {
                value: "avoids_dogs",
                label: "\uc544\ub2c8\ub2e4"
            },
            {
                value: "neutral",
                label: "\uc0c1\uad00\uc5c6\ub2e4"
            }
        ],
        personalityTags: [
            {
                value: "afraid_of_people",
                label: "\ub2e4\ub978 \uc0ac\ub78c\uc744 \ubb34\uc11c\uc6cc\ud568"
            },
            {
                value: "afraid_of_cars",
                label: "\uc790\ub3d9\ucc28\ub97c \ubb34\uc11c\uc6cc\ud568"
            },
            {
                value: "likes_parks",
                label: "\uacf5\uc6d0\uc744 \uc88b\uc544\ud568"
            },
            {
                value: "likes_people",
                label: "\ub2e4\ub978 \uc0ac\ub78c\uc744 \uc88b\uc544\ud568"
            },
            {
                value: "likes_new_routes",
                label: "\uc0c8\ub85c\uc6b4 \uae38\uc744 \uac00\ub294 \uac83\uc744 \uc88b\uc544\ud568"
            }
        ],
        consents: {
            locationPermission: {
                label: "\uc704\uce58 \uad8c\ud55c \ub3d9\uc758",
                required: false
            },
            notificationPermission: {
                label: "\uc54c\ub9bc \uad8c\ud55c \ub3d9\uc758",
                required: false
            },
            marketing: {
                label: "\ub9c8\ucf00\ud305 \uc218\uc2e0 \ub3d9\uc758",
                required: false
            }
        }
    };
}
