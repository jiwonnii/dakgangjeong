import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import { completeNextWalkCareTask } from "../care/care-task-completion.service";
import type {
  finishWalkRecordSchema,
  inProgressWalkRecordQuerySchema,
  listWalkRecordsQuerySchema,
  manualWalkRecordSchema,
  progressWalkRecordSchema,
  startWalkRecordSchema,
  walkRecordIdParamsSchema,
  walkStreakQuerySchema
} from "./walk-record.schemas";
import { createWalkRecordSummary } from "./walk-record-summary.service";
import { classifyReviewFactors, type ReviewFactorKey } from "./review-preference-classifier.service";

type WalkRecordRow = {
  id: string;
  dog_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  average_speed_mps: number | null;
  route: unknown;
  route_geojson: GeoJsonLineString | null;
  recommended_course: unknown | null;
  static_map_url: string | null;
  rating: number | null;
  liked_notes: string | null;
  disliked_notes: string | null;
  liked_factor: string | null;
  disliked_factor: string | null;
  ai_summary: string | null;
  created_at: string;
};

type LatLon = {
  lat: number;
  lon: number;
};

type GeoJsonLineString = {
  type: "LineString";
  coordinates: [number, number][];
};

const WALK_RECORD_SELECT =
  "id, dog_id, user_id, started_at, ended_at, distance_meters, duration_seconds, average_speed_mps, route, route_geojson, recommended_course, static_map_url, rating, liked_notes, disliked_notes, liked_factor, disliked_factor, ai_summary, created_at";

function getAuthUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.authUser?.id) {
    throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
  }

  return req.authUser.id;
}

async function assertDogGuardian(dogId: string, userId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("dog_guardians")
    .select("role")
    .eq("dog_id", dogId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, "DOG_GUARDIAN_LOOKUP_FAILED");
  }

  if (!data) {
    throw new AppError("You are not a guardian of this dog.", 403, "DOG_GUARDIAN_REQUIRED");
  }
}

function toLineStringEwkt(points: readonly LatLon[]): string | null {
  if (points.length < 2) {
    return null;
  }

  const coordinates = points
    .map((point) => `${point.lon} ${point.lat}`)
    .join(",");

  return `SRID=4326;LINESTRING(${coordinates})`;
}

function toLineStringGeoJson(points: readonly LatLon[]): GeoJsonLineString | null {
  if (points.length < 2) {
    return null;
  }

  return {
    type: "LineString",
    coordinates: points.map((point) => [point.lon, point.lat])
  };
}

function toWalkRecord(row: WalkRecordRow, guardianName: string | null = null) {
  return {
    id: row.id,
    dogId: row.dog_id,
    userId: row.user_id,
    guardianName,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    averageSpeedMps: row.average_speed_mps,
    route: row.route,
    routeGeoJson: row.route_geojson,
    recommendedCourse: row.recommended_course,
    staticMapUrl: row.static_map_url,
    rating: row.rating,
    likedNotes: row.liked_notes,
    dislikedNotes: row.disliked_notes,
    likedFactor: row.liked_factor,
    dislikedFactor: row.disliked_factor,
    aiSummary: row.ai_summary,
    createdAt: row.created_at
  };
}

/**
 * user_id 로 남은 산책 기록 작성자를 실제 보호자 이름(guardian_profiles.display_name)으로
 * 바꿔줄 Map을 만든다. guardian_profiles 는 auth user id를 그대로 id 컬럼(PK)으로 쓴다
 * (onboarding.controller.ts의 ensureGuardianProfile, PUT /api/onboarding/guardian-profile 참고).
 * 이 추가 조회가 실패해도 전체 요청을 실패시키지 않고 이름 없이(null) 내려준다.
 */
async function lookupGuardianNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));

  if (uniqueIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("guardian_profiles")
      .select("id, display_name")
      .in("id", uniqueIds);

    if (error) {
      console.warn("Failed to look up guardian names for walk records.", error);
      return new Map();
    }

    return new Map(
      ((data ?? []) as Array<{ id: string; display_name: string | null }>)
        .filter((row) => row.display_name)
        .map((row) => [row.id, row.display_name as string])
    );
  } catch (error) {
    console.warn("Failed to look up guardian names for walk records.", error);
    return new Map();
  }
}

function averageSpeedMps(distanceMeters: number, durationSeconds: number): number | null {
  if (durationSeconds <= 0) {
    return null;
  }

  return Math.round((distanceMeters / durationSeconds) * 100) / 100;
}

async function completeWalkCareTaskAfterRecordSave({
  dogId,
  occurredAt,
  userId,
}: {
  dogId: string;
  occurredAt: string;
  userId: string;
}) {
  try {
    await completeNextWalkCareTask({ dogId, occurredAt, userId });
  } catch (error) {
    console.warn("Failed to complete walk care task after saving a walk record.", error);
  }
}

/**
 * Fills in `likedFactor`/`dislikedFactor` from free-text notes via the
 * OpenAI-backed classifier when the client didn't explicitly pick one from
 * the review dropdown, so the recommendation pipeline's preference
 * learning (recommendation.service.ts's `loadReviewPreferenceSummary`)
 * picks up the signal even for users who only typed a note.
 *
 * An explicit factor the client DID send is always respected as-is and
 * never overridden. The classifier is only invoked when there is actually
 * a gap to fill (a note present with no matching factor chosen), and any
 * classification failure is treated as "no signal" rather than surfaced —
 * saving the walk record must succeed even if OpenAI is unavailable.
 */
async function resolveReviewFactors(body: {
  likedFactor?: ReviewFactorKey;
  dislikedFactor?: ReviewFactorKey;
  likedNotes?: string;
  dislikedNotes?: string;
}): Promise<{ likedFactor: ReviewFactorKey | null; dislikedFactor: ReviewFactorKey | null }> {
  const needsLikedClassification = body.likedFactor === undefined && Boolean(body.likedNotes);
  const needsDislikedClassification = body.dislikedFactor === undefined && Boolean(body.dislikedNotes);

  if (!needsLikedClassification && !needsDislikedClassification) {
    return {
      likedFactor: body.likedFactor ?? null,
      dislikedFactor: body.dislikedFactor ?? null
    };
  }

  const classified = await classifyReviewFactors({
    likedNotes: needsLikedClassification ? body.likedNotes : undefined,
    dislikedNotes: needsDislikedClassification ? body.dislikedNotes : undefined
  }).catch(() => ({ likedFactor: null, dislikedFactor: null }));

  return {
    likedFactor: body.likedFactor ?? classified.likedFactor,
    dislikedFactor: body.dislikedFactor ?? classified.dislikedFactor
  };
}

function localDateKeyKst(iso: string): string {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function todayKeyKst(now = new Date()): string {
  return localDateKeyKst(now.toISOString());
}

function previousDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export const listWalkRecords: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const query = req.query as unknown as z.infer<typeof listWalkRecordsQuerySchema>;
    const supabase = getSupabaseAdminClient();

    let request = supabase
      .from("walk_records")
      .select(WALK_RECORD_SELECT)
      .order("started_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (query.dogId) {
      await assertDogGuardian(query.dogId, userId);
      request = request.eq("dog_id", query.dogId);
    } else {
      request = request.eq("user_id", userId);
    }

    if (query.from) {
      request = request.gte("started_at", query.from);
    }

    if (query.to) {
      request = request.lte("started_at", query.to);
    }

    const { data, error } = await request;

    if (error) {
      throw new AppError(error.message, 500, "WALK_RECORD_LIST_FAILED");
    }

    const rows = (data ?? []) as WalkRecordRow[];
    const guardianNameById = await lookupGuardianNames(rows.map((row) => row.user_id));

    res.json({
      records: rows.map((row) => toWalkRecord(row, guardianNameById.get(row.user_id) ?? null)),
      limit: query.limit,
      offset: query.offset
    });
  } catch (error) {
    next(error);
  }
};

export const getInProgressWalkRecord: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const query = req.query as unknown as z.infer<typeof inProgressWalkRecordQuerySchema>;
    const supabase = getSupabaseAdminClient();

    let request = supabase
      .from("walk_records")
      .select(WALK_RECORD_SELECT)
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);

    if (query.dogId) {
      await assertDogGuardian(query.dogId, userId);
      request = request.eq("dog_id", query.dogId);
    }

    const { data, error } = await request.maybeSingle();

    if (error) {
      throw new AppError(error.message, 500, "IN_PROGRESS_WALK_RECORD_LOOKUP_FAILED");
    }

    res.json({
      record: data ? toWalkRecord(data as WalkRecordRow) : null
    });
  } catch (error) {
    next(error);
  }
};

export const startWalkRecord: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = req.body as z.infer<typeof startWalkRecordSchema>;
    await assertDogGuardian(body.dogId, userId);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("walk_records")
      .insert({
        dog_id: body.dogId,
        user_id: userId,
        started_at: body.startedAt ?? new Date().toISOString(),
        recommended_course: body.recommendedCourse ?? null
      })
      .select(WALK_RECORD_SELECT)
      .single();

    if (error) {
      throw new AppError(error.message, 500, "WALK_RECORD_START_FAILED");
    }

    res.status(201).json({ record: toWalkRecord(data as WalkRecordRow) });
  } catch (error) {
    next(error);
  }
};

export const finishWalkRecord: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { walkRecordId } = req.params as z.infer<typeof walkRecordIdParamsSchema>;
    const body = req.body as z.infer<typeof finishWalkRecordSchema>;
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: lookupError } = await supabase
      .from("walk_records")
      .select("id, dog_id, user_id, ended_at")
      .eq("id", walkRecordId)
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) {
      throw new AppError(lookupError.message, 500, "WALK_RECORD_LOOKUP_FAILED");
    }

    if (!existing) {
      throw new AppError("Walk record not found.", 404, "WALK_RECORD_NOT_FOUND");
    }

    await assertDogGuardian((existing as { dog_id: string }).dog_id, userId);

    const endedAt = body.endedAt ?? new Date().toISOString();
    const route = toLineStringEwkt(body.path);
    const routeGeoJson = toLineStringGeoJson(body.path);
    const { likedFactor, dislikedFactor } = await resolveReviewFactors(body);
    const aiSummary = createWalkRecordSummary({
      distanceMeters: body.distanceMeters,
      durationSeconds: body.durationSeconds,
      rating: body.rating,
      likedNotes: body.likedNotes,
      dislikedNotes: body.dislikedNotes,
      likedFactor: likedFactor ?? undefined,
      dislikedFactor: dislikedFactor ?? undefined,
      pointCount: body.path.length,
      isManual: false
    });
    const { data, error } = await supabase
      .from("walk_records")
      .update({
        ended_at: endedAt,
        distance_meters: body.distanceMeters,
        duration_seconds: body.durationSeconds,
        average_speed_mps: averageSpeedMps(body.distanceMeters, body.durationSeconds),
        route,
        route_geojson: routeGeoJson,
        static_map_url: body.staticMapUrl ?? null,
        rating: body.rating ?? null,
        liked_notes: body.likedNotes ?? null,
        disliked_notes: body.dislikedNotes ?? null,
        liked_factor: likedFactor,
        disliked_factor: dislikedFactor,
        ai_summary: aiSummary
      })
      .eq("id", walkRecordId)
      .eq("user_id", userId)
      .select(WALK_RECORD_SELECT)
      .single();

    if (error) {
      throw new AppError(error.message, 500, "WALK_RECORD_FINISH_FAILED");
    }

    if (!(existing as { ended_at: string | null }).ended_at) {
      await completeWalkCareTaskAfterRecordSave({
        dogId: (existing as { dog_id: string }).dog_id,
        occurredAt: endedAt,
        userId,
      });
    }

    res.json({ record: toWalkRecord(data as WalkRecordRow) });
  } catch (error) {
    next(error);
  }
};

export const updateWalkRecordProgress: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { walkRecordId } = req.params as z.infer<typeof walkRecordIdParamsSchema>;
    const body = req.body as z.infer<typeof progressWalkRecordSchema>;
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: lookupError } = await supabase
      .from("walk_records")
      .select("id, dog_id, user_id, ended_at")
      .eq("id", walkRecordId)
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) {
      throw new AppError(lookupError.message, 500, "WALK_RECORD_LOOKUP_FAILED");
    }

    if (!existing) {
      throw new AppError("Walk record not found.", 404, "WALK_RECORD_NOT_FOUND");
    }

    if ((existing as { ended_at: string | null }).ended_at) {
      throw new AppError("Finished walk records cannot be updated.", 409, "WALK_RECORD_ALREADY_FINISHED");
    }

    await assertDogGuardian((existing as { dog_id: string }).dog_id, userId);

    const { data, error } = await supabase
      .from("walk_records")
      .update({
        distance_meters: body.distanceMeters,
        route: toLineStringEwkt(body.path),
        route_geojson: toLineStringGeoJson(body.path)
      })
      .eq("id", walkRecordId)
      .eq("user_id", userId)
      .is("ended_at", null)
      .select(WALK_RECORD_SELECT)
      .single();

    if (error) {
      throw new AppError(error.message, 500, "WALK_RECORD_PROGRESS_FAILED");
    }

    res.json({ record: toWalkRecord(data as WalkRecordRow) });
  } catch (error) {
    next(error);
  }
};

export const createManualWalkRecord: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = req.body as z.infer<typeof manualWalkRecordSchema>;
    await assertDogGuardian(body.dogId, userId);

    const endedAt = body.walkedAt ? new Date(body.walkedAt) : new Date();
    const startedAt = new Date(endedAt.getTime() - body.durationSeconds * 1000);
    const supabase = getSupabaseAdminClient();
    const { likedFactor, dislikedFactor } = await resolveReviewFactors(body);
    const aiSummary = createWalkRecordSummary({
      distanceMeters: body.distanceMeters,
      durationSeconds: body.durationSeconds,
      rating: body.rating,
      likedNotes: body.likedNotes,
      dislikedNotes: body.dislikedNotes,
      likedFactor: likedFactor ?? undefined,
      dislikedFactor: dislikedFactor ?? undefined,
      isManual: true
    });

    const { data, error } = await supabase
      .from("walk_records")
      .insert({
        dog_id: body.dogId,
        user_id: userId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        distance_meters: body.distanceMeters,
        duration_seconds: body.durationSeconds,
        average_speed_mps: averageSpeedMps(body.distanceMeters, body.durationSeconds),
        rating: body.rating ?? null,
        liked_notes: body.likedNotes ?? null,
        disliked_notes: body.dislikedNotes ?? null,
        liked_factor: likedFactor,
        disliked_factor: dislikedFactor,
        ai_summary: aiSummary
      })
      .select(WALK_RECORD_SELECT)
      .single();

    if (error) {
      throw new AppError(error.message, 500, "MANUAL_WALK_RECORD_CREATE_FAILED");
    }

    await completeWalkCareTaskAfterRecordSave({
      dogId: body.dogId,
      occurredAt: endedAt.toISOString(),
      userId,
    });

    res.status(201).json({ record: toWalkRecord(data as WalkRecordRow) });
  } catch (error) {
    next(error);
  }
};

export const getWalkStreak: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const query = req.query as unknown as z.infer<typeof walkStreakQuerySchema>;
    const supabase = getSupabaseAdminClient();

    let request = supabase
      .from("walk_records")
      .select("started_at")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(370);

    if (query.dogId) {
      await assertDogGuardian(query.dogId, userId);
      request = request.eq("dog_id", query.dogId);
    } else {
      request = request.eq("user_id", userId);
    }

    const { data, error } = await request;

    if (error) {
      throw new AppError(error.message, 500, "WALK_STREAK_LOOKUP_FAILED");
    }

    const walkedDays = new Set(
      ((data ?? []) as Array<{ started_at: string }>).map((row) => localDateKeyKst(row.started_at))
    );

    let cursor = todayKeyKst();
    let streakDays = 0;

    while (walkedDays.has(cursor)) {
      streakDays += 1;
      cursor = previousDateKey(cursor);
    }

    res.json({
      streakDays,
      throughDate: todayKeyKst(),
      dogId: query.dogId ?? null
    });
  } catch (error) {
    next(error);
  }
};
