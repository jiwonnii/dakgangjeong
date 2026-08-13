import type { RequestHandler } from "express";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import {
  findDogBreedById,
  listDogBreedOptions
} from "../dogs/dog-breed.service";
import { getOnboardingOptionsBase } from "./onboarding.schemas";

function getAuthUserId(req: Parameters<RequestHandler>[0]) {
  if (!req.authUser?.id) {
    throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
  }

  return req.authUser.id;
}

function consentTimestamp(agreed: boolean) {
  return agreed ? new Date().toISOString() : null;
}

async function ensureGuardianProfile(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("guardian_profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, "GUARDIAN_PROFILE_LOOKUP_FAILED");
  }

  if (!data) {
    throw new AppError(
      "Guardian profile is required before this step.",
      409,
      "GUARDIAN_PROFILE_REQUIRED"
    );
  }

  return data;
}

export async function listGuardianDogsForUser(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: guardianRows, error: guardianRowsError } = await supabase
    .from("dog_guardians")
    .select("dog_id, role")
    .eq("user_id", userId);

  if (guardianRowsError) {
    throw new AppError(
      guardianRowsError.message,
      500,
      "DOG_GUARDIAN_LOOKUP_FAILED"
    );
  }

  const dogIds = (guardianRows ?? []).map((row) => row.dog_id);
  const { data: dogs, error: dogsError } = dogIds.length
    ? await supabase
        .from("dogs")
        .select(
          "id, name, breed, birth_date, weight_kg, social_preference, personality_tags, invite_code"
        )
        .in("id", dogIds)
    : { data: [], error: null };

  if (dogsError) {
    throw new AppError(dogsError.message, 500, "DOG_LOOKUP_FAILED");
  }

  const breedOptions = await listDogBreedOptions();
  const breedById = new Map(breedOptions.map((breed) => [breed.id, breed]));

  return (dogs ?? []).map((dog) => ({
    ...dog,
    role: guardianRows?.find((row) => row.dog_id === dog.id)?.role,
    breedInfo: breedById.get(dog.breed) ?? null
  }));
}

export const getOnboardingOptions: RequestHandler = async (_req, res, next) => {
  try {
    const breeds = await listDogBreedOptions();

    res.json({
      ...getOnboardingOptionsBase(),
      breeds
    });
  } catch (error) {
    next(error);
  }
};

export const getOnboardingStatus: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const supabase = getSupabaseAdminClient();

    const { data: guardianProfile, error: guardianProfileError } = await supabase
      .from("guardian_profiles")
      .select(
        "id, display_name, location_permission_agreed, notification_permission_agreed, marketing_agreed"
      )
      .eq("id", userId)
      .maybeSingle();

    if (guardianProfileError) {
      throw new AppError(
        guardianProfileError.message,
        500,
        "GUARDIAN_PROFILE_LOOKUP_FAILED"
      );
    }

    const dogsWithRole = await listGuardianDogsForUser(userId);

    res.json({
      emailVerified: Boolean(req.authUser?.email_confirmed_at ?? req.authUser?.confirmed_at),
      guardianProfile,
      dogs: dogsWithRole,
      nextStep: !guardianProfile
        ? "guardian-profile"
        : dogsWithRole.length === 0
          ? "dog-or-invite"
          : "complete"
    });
  } catch (error) {
    next(error);
  }
};

export const getOnboardingDebugDb: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const supabase = getSupabaseAdminClient();

    const { data: guardianProfile, error: guardianProfileError } = await supabase
      .from("guardian_profiles")
      .select(
        "id, display_name, location_permission_agreed, notification_permission_agreed, marketing_agreed, location_permission_agreed_at, notification_permission_agreed_at, marketing_agreed_at, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (guardianProfileError) {
      throw new AppError(
        guardianProfileError.message,
        500,
        "GUARDIAN_PROFILE_LOOKUP_FAILED"
      );
    }

    const { data: guardianRows, error: guardianRowsError } = await supabase
      .from("dog_guardians")
      .select("dog_id, user_id, role, joined_at")
      .eq("user_id", userId);

    if (guardianRowsError) {
      throw new AppError(
        guardianRowsError.message,
        500,
        "DOG_GUARDIAN_LOOKUP_FAILED"
      );
    }

    const dogIds = (guardianRows ?? []).map((row) => row.dog_id);
    const { data: dogs, error: dogsError } = dogIds.length
      ? await supabase
          .from("dogs")
          .select(
            "id, owner_id, name, breed, birth_date, weight_kg, social_preference, personality_tags, health_notes, invite_code, created_at, updated_at"
          )
          .in("id", dogIds)
      : { data: [], error: null };

    if (dogsError) {
      throw new AppError(dogsError.message, 500, "DOG_LOOKUP_FAILED");
    }

    const breedIds = Array.from(new Set((dogs ?? []).map((dog) => dog.breed)));
    const breedInfos = await Promise.all(
      breedIds.map(async (breedId) => findDogBreedById(breedId))
    );

    res.json({
      authUser: {
        id: req.authUser?.id,
        email: req.authUser?.email,
        emailVerified: Boolean(req.authUser?.email_confirmed_at ?? req.authUser?.confirmed_at)
      },
      tables: {
        guardian_profiles: guardianProfile ? [guardianProfile] : [],
        dog_guardians: guardianRows ?? [],
        dogs: dogs ?? [],
        dog_breeds: breedInfos
          .filter((breed) => breed !== null)
          .map((breed) => ({
            id: breed.id,
            name_ko: breed.nameKo,
            name_en: breed.nameEn,
            group_name: breed.groupName,
            aliases: breed.aliases,
            is_popular: breed.isPopular,
            source: breed.source,
            sort_order: breed.sortOrder
          }))
      },
      notes: [
        "auth.users is managed by Supabase Auth, so the app stores guardian details in guardian_profiles.",
        "dogs.breed stores the dog_breeds.id value, for example poodle or maltese.",
        "dog_guardians connects users and dogs. role is owner or caregiver."
      ]
    });
  } catch (error) {
    next(error);
  }
};

export const upsertGuardianProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const {
      displayName,
      locationPermissionAgreed,
      notificationPermissionAgreed,
      marketingAgreed
    } = req.body;
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("guardian_profiles")
      .upsert(
        {
          id: userId,
          display_name: displayName,
          location_permission_agreed: locationPermissionAgreed,
          notification_permission_agreed: notificationPermissionAgreed,
          marketing_agreed: marketingAgreed,
          location_permission_agreed_at: consentTimestamp(locationPermissionAgreed),
          notification_permission_agreed_at: consentTimestamp(notificationPermissionAgreed),
          marketing_agreed_at: consentTimestamp(marketingAgreed)
        },
        {
          onConflict: "id"
        }
      )
      .select(
        "id, display_name, location_permission_agreed, notification_permission_agreed, marketing_agreed, location_permission_agreed_at, notification_permission_agreed_at, marketing_agreed_at, created_at, updated_at"
      )
      .single();

    if (error) {
      throw new AppError(error.message, 500, "GUARDIAN_PROFILE_SAVE_FAILED");
    }

    res.json({
      guardianProfile: data
    });
  } catch (error) {
    next(error);
  }
};

export const createDogProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    await ensureGuardianProfile(userId);

    const {
      name,
      breed,
      birthDate,
      weightKg,
      socialPreference,
      personalityTags
    } = req.body;
    const dogBreed = await findDogBreedById(breed);

    if (!dogBreed) {
      throw new AppError("Unsupported dog breed.", 400, "DOG_BREED_NOT_FOUND");
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("dogs")
      .insert({
        owner_id: userId,
        name,
        breed: dogBreed.id,
        birth_date: birthDate,
        weight_kg: weightKg,
        social_preference: socialPreference,
        personality_tags: personalityTags
      })
      .select(
        "id, name, breed, birth_date, weight_kg, social_preference, personality_tags, invite_code, created_at"
      )
      .single();

    if (error) {
      throw new AppError(error.message, 500, "DOG_PROFILE_CREATE_FAILED");
    }

    res.status(201).json({
      dog: {
        ...data,
        breedInfo: dogBreed,
        role: "owner"
      }
    });
  } catch (error) {
    next(error);
  }
};

export const joinDogProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    await ensureGuardianProfile(userId);

    const { inviteCode } = req.body;
    const supabase = getSupabaseAdminClient();
    const { data: dog, error: dogError } = await supabase
      .from("dogs")
      .select(
        "id, name, breed, birth_date, weight_kg, social_preference, personality_tags, invite_code, owner_id"
      )
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (dogError) {
      throw new AppError(dogError.message, 500, "INVITE_CODE_LOOKUP_FAILED");
    }

    if (!dog) {
      throw new AppError("Invalid invite code.", 404, "INVITE_CODE_NOT_FOUND");
    }

    const { data: existingGuardian, error: existingGuardianError } = await supabase
      .from("dog_guardians")
      .select("role")
      .eq("dog_id", dog.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingGuardianError) {
      throw new AppError(
        existingGuardianError.message,
        500,
        "DOG_GUARDIAN_LOOKUP_FAILED"
      );
    }

    if (existingGuardian) {
      res.json({
        dog: {
          ...dog,
          breedInfo: await findDogBreedById(dog.breed),
          role: existingGuardian.role
        },
        alreadyJoined: true
      });
      return;
    }

    const { error: joinError } = await supabase.from("dog_guardians").insert({
      dog_id: dog.id,
      user_id: userId,
      role: "caregiver"
    });

    if (joinError) {
      throw new AppError(joinError.message, 500, "DOG_JOIN_FAILED");
    }

    res.status(201).json({
      dog: {
        ...dog,
        breedInfo: await findDogBreedById(dog.breed),
        role: "caregiver"
      },
      alreadyJoined: false
    });
  } catch (error) {
    next(error);
  }
};
