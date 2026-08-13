import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import { listGuardianDogsForUser } from "../onboarding/onboarding.controller";
import { createDogOnboardingSchema } from "../onboarding/onboarding.schemas";
import { findDogBreedById, listDogBreedOptions } from "./dog-breed.service";

export const dogIdParamsSchema = z.object({
  dogId: z.string().uuid()
});

export const updateDogProfileSchema = createDogOnboardingSchema;

function getAuthUserId(req: Parameters<RequestHandler>[0]) {
  if (!req.authUser?.id) {
    throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
  }

  return req.authUser.id;
}

export const listDogBreeds: RequestHandler = async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const breeds = await listDogBreedOptions(search);

    res.json({
      breeds,
      count: breeds.length
    });
  } catch (error) {
    next(error);
  }
};

export const listDogs: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const dogs = await listGuardianDogsForUser(userId);

    res.json({
      dogs,
      count: dogs.length
    });
  } catch (error) {
    next(error);
  }
};

export const updateDog: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { dogId } = req.params;
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
    const { data: guardian, error: guardianError } = await supabase
      .from("dog_guardians")
      .select("role")
      .eq("dog_id", dogId)
      .eq("user_id", userId)
      .maybeSingle();

    if (guardianError) {
      throw new AppError(guardianError.message, 500, "DOG_GUARDIAN_LOOKUP_FAILED");
    }

    if (!guardian) {
      throw new AppError("Dog profile was not found.", 404, "DOG_NOT_FOUND");
    }

    const { data, error } = await supabase
      .from("dogs")
      .update({
        name,
        breed: dogBreed.id,
        birth_date: birthDate,
        weight_kg: weightKg,
        social_preference: socialPreference,
        personality_tags: personalityTags
      })
      .eq("id", dogId)
      .select(
        "id, name, breed, birth_date, weight_kg, social_preference, personality_tags, invite_code, updated_at"
      )
      .single();

    if (error) {
      throw new AppError(error.message, 500, "DOG_PROFILE_UPDATE_FAILED");
    }

    res.json({
      dog: {
        ...data,
        breedInfo: dogBreed,
        role: guardian.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createDog: RequestHandler = (_req, res) => {
  res.status(501).json({
    message: "Create dog profile API is not implemented yet."
  });
};

export const joinDogByInviteCode: RequestHandler = (_req, res) => {
  res.status(501).json({
    message: "Join dog profile by invite code API is not implemented yet."
  });
};
