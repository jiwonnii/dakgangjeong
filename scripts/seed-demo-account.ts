import { createHash } from "node:crypto";
import { getSupabaseAdminClient, getSupabaseClient } from "../src/lib/supabase";

const OWNER_EMAIL = "DGJ@ms.kr";
const CAREGIVER_EMAIL = "DGJ-care@ms.kr";
const DOG_INVITE_CODE = "DGJDEMO1";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEMO_NAMESPACE = "sanchaekhagae-demo-account";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type RouteTemplate = {
  name: string;
  direction: string;
  coordinates: Array<[number, number]>;
};

const routeTemplates: RouteTemplate[] = [
  {
    name: "덕수궁 돌담길",
    direction: "북서쪽",
    coordinates: [
      [126.9779, 37.5663],
      [126.9756, 37.5669],
      [126.9739, 37.5658],
      [126.9748, 37.5638],
      [126.9772, 37.5635],
      [126.9786, 37.5651],
      [126.9779, 37.5663]
    ]
  },
  {
    name: "청계천 산책길",
    direction: "동쪽",
    coordinates: [
      [126.9779, 37.5663],
      [126.9814, 37.5684],
      [126.9852, 37.5691],
      [126.989, 37.5695],
      [126.9861, 37.5678],
      [126.9819, 37.5674],
      [126.9779, 37.5663]
    ]
  },
  {
    name: "남산 초록길",
    direction: "남쪽",
    coordinates: [
      [126.9779, 37.5663],
      [126.979, 37.5631],
      [126.9802, 37.5598],
      [126.9816, 37.5571],
      [126.9786, 37.5584],
      [126.9768, 37.5621],
      [126.9779, 37.5663]
    ]
  }
];

function requirePassword(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  if (value.length < 8 || value.length > 72) {
    throw new Error(`${name} must be between 8 and 72 characters to match the app login policy.`);
  }

  return value;
}

function stableUuid(key: string) {
  const hex = createHash("sha256").update(`${DEMO_NAMESPACE}:${key}`).digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function throwIfError(error: { message: string } | null, operation: string) {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

function kstDateKey(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function dateKeyDaysAgo(daysAgo: number) {
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() - daysAgo);
  return shifted.toISOString().slice(0, 10);
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function isoAtKst(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}+09:00`).toISOString();
}

function lineStringEwkt(coordinates: Array<[number, number]>) {
  return `SRID=4326;LINESTRING(${coordinates.map(([lon, lat]) => `${lon} ${lat}`).join(",")})`;
}

async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    throwIfError(error, `List auth users page ${page}`);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);

    if (user) {
      return user as AuthUser;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  throw new Error(`Could not finish searching for auth user ${email}.`);
}

async function ensureAuthUser(email: string, password: string, displayName: string) {
  const supabase = getSupabaseAdminClient();
  const existing = await findAuthUserByEmail(email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        display_name: displayName,
        demo_account: true
      }
    });
    throwIfError(error, `Update auth user ${email}`);
    return data.user as AuthUser;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      demo_account: true
    }
  });
  throwIfError(error, `Create auth user ${email}`);

  if (!data.user) {
    throw new Error(`Supabase returned no user for ${email}.`);
  }

  return data.user as AuthUser;
}

async function seedProfiles(owner: AuthUser, caregiver: AuthUser) {
  const supabase = getSupabaseAdminClient();
  const createdAt = isoAtKst(dateKeyDaysAgo(45), "09:00:00");
  const now = new Date().toISOString();
  const { error } = await supabase.from("guardian_profiles").upsert(
    [
      {
        id: owner.id,
        display_name: "동구 보호자",
        location_permission_agreed: true,
        notification_permission_agreed: true,
        marketing_agreed: false,
        location_permission_agreed_at: createdAt,
        notification_permission_agreed_at: createdAt,
        marketing_agreed_at: null,
        created_at: createdAt,
        updated_at: now
      },
      {
        id: caregiver.id,
        display_name: "공동 보호자 지민",
        location_permission_agreed: true,
        notification_permission_agreed: true,
        marketing_agreed: false,
        location_permission_agreed_at: createdAt,
        notification_permission_agreed_at: createdAt,
        marketing_agreed_at: null,
        created_at: createdAt,
        updated_at: now
      }
    ],
    { onConflict: "id" }
  );
  throwIfError(error, "Seed guardian profiles");
}

async function seedDog(owner: AuthUser, caregiver: AuthUser) {
  const supabase = getSupabaseAdminClient();
  const dogId = stableUuid("dog:dubu");
  const createdAt = isoAtKst(dateKeyDaysAgo(44), "10:30:00");
  const { error: dogError } = await supabase.from("dogs").upsert(
    {
      id: dogId,
      owner_id: owner.id,
      name: "두부",
      breed: "poodle",
      birth_date: "2022-05-14",
      weight_kg: 5.8,
      social_preference: "neutral",
      personality_tags: ["공원을 좋아함", "새로운 길을 좋아함", "자동차를 무서워함"],
      health_notes: "계단이 많은 길은 피하고 더운 날에는 짧게 산책해요.",
      invite_code: DOG_INVITE_CODE,
      created_at: createdAt,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  throwIfError(dogError, "Seed dog profile");

  const { error: guardianError } = await supabase.from("dog_guardians").upsert(
    [
      { dog_id: dogId, user_id: owner.id, role: "owner", joined_at: createdAt },
      {
        dog_id: dogId,
        user_id: caregiver.id,
        role: "caregiver",
        joined_at: isoAtKst(dateKeyDaysAgo(32), "20:10:00")
      }
    ],
    { onConflict: "dog_id,user_id" }
  );
  throwIfError(guardianError, "Seed dog guardians");
  return dogId;
}

function buildWalkRows(dogId: string, ownerId: string, caregiverId: string) {
  const daysAgoValues = [...Array.from({ length: 12 }, (_, index) => index), 16, 20, 25, 31, 37];
  const likedFactors = ["environment", "pedestrianSafety", "fit", "familiarity"];
  const dislikedFactors = [null, "vehicleExposure", null, "riskZones"];

  return daysAgoValues.map((daysAgo, index) => {
    const template = routeTemplates[index % routeTemplates.length];
    const dateKey = dateKeyDaysAgo(daysAgo);
    const durationSeconds = 1_620 + (index % 5) * 180;
    const distanceMeters = 1_760 + (index % 6) * 210;
    let endedAt: string;

    if (daysAgo === 0) {
      endedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const proposedStart = new Date(Date.parse(endedAt) - durationSeconds * 1000);
      if (kstDateKey(proposedStart) !== dateKey) {
        endedAt = isoAtKst(dateKey, "00:55:00");
      }
    } else {
      endedAt = isoAtKst(dateKey, `${18 + (index % 3)}:${index % 2 === 0 ? "42" : "18"}:00`);
    }

    const startedAt = new Date(Date.parse(endedAt) - durationSeconds * 1000).toISOString();
    const rating = index % 5 === 1 ? 4 : 5;
    const likedFactor = likedFactors[index % likedFactors.length];
    const dislikedFactor = dislikedFactors[index % dislikedFactors.length];
    const likedNotes = [
      "그늘이 많고 길이 조용해서 두부가 편안해했어요.",
      "횡단보도가 적고 보행로가 넓어서 좋았어요.",
      "예상 시간과 실제 산책 시간이 잘 맞았어요.",
      "익숙한 구간과 새로운 길이 적당히 섞여 있었어요."
    ][index % 4];
    const dislikedNotes = dislikedFactor
      ? index % 2 === 0
        ? "일부 구간은 차량 소리가 커서 다음에는 우회하고 싶어요."
        : "한 구간에 보행자가 몰려 조금 천천히 걸었어요."
      : null;
    const path = { type: "LineString" as const, coordinates: template.coordinates };

    return {
      id: stableUuid(`walk:${dateKey}:${index}`),
      dog_id: dogId,
      user_id: index % 4 === 3 ? caregiverId : ownerId,
      started_at: startedAt,
      ended_at: endedAt,
      distance_meters: distanceMeters,
      duration_seconds: durationSeconds,
      average_speed_mps: Math.round((distanceMeters / durationSeconds) * 100) / 100,
      route: lineStringEwkt(template.coordinates),
      route_geojson: path,
      recommended_course: {
        rank: 1,
        direction: template.direction,
        courseName: template.name,
        distanceMeters,
        durationMinutes: Math.round(durationSeconds / 60),
        score: 54 + (index % 4) * 1.2,
        aiExplanation: `${template.name}은(는) 두부가 좋아한 환경과 보행 안전 요소가 잘 맞는 코스예요.`,
        explanation: {
          summary: "과거 리뷰에서 만족도가 높았던 그늘과 넓은 보행로를 우선 반영했어요.",
          factors: [
            { key: "pedestrianSafety", label: "보행 안전", score: 82, weight: 0.4 },
            { key: "environment", label: "산책 환경", score: 86, weight: 0.3 },
            { key: "fit", label: "두부 맞춤", score: 79, weight: 0.3, preferenceAdjustment: 6.4 }
          ]
        },
        cautions: index % 3 === 1 ? ["퇴근 시간에는 일부 구간의 차량 통행이 늘 수 있어요."] : [],
        facts: { demo: true, reviewAdjusted: true },
        path
      },
      static_map_url: null,
      rating,
      liked_notes: likedNotes,
      disliked_notes: dislikedNotes,
      liked_factor: likedFactor,
      disliked_factor: dislikedFactor,
      ai_summary: `GPS 경로와 함께 기록된 산책이에요. ${Math.round(durationSeconds / 60)}분 동안 ${(distanceMeters / 1000).toFixed(1)}km를 걸었어요. 별점은 ${rating}점이에요. 좋았던 점: ${likedNotes}`,
      created_at: startedAt
    };
  });
}

async function seedWalks(dogId: string, ownerId: string, caregiverId: string) {
  const supabase = getSupabaseAdminClient();
  const rows = buildWalkRows(dogId, ownerId, caregiverId);
  const { error } = await supabase.from("walk_records").upsert(rows, { onConflict: "id" });
  throwIfError(error, "Seed walk records");
  return rows;
}

async function seedCareData(dogId: string, ownerId: string, caregiverId: string) {
  const supabase = getSupabaseAdminClient();
  const startDate = dateKeyDaysAgo(32);
  const routineRows = [
    {
      id: stableUuid("routine:feed"),
      dog_id: dogId,
      created_by: ownerId,
      task_type: "feed",
      title: "사료",
      instructions: "정량 55g을 급여하고 물그릇도 확인해 주세요.",
      frequency: "daily",
      interval_count: 1,
      days_of_week: [],
      days_of_month: [],
      times_of_day: ["08:00:00", "19:00:00"],
      start_date: startDate,
      end_date: null,
      timezone: "Asia/Seoul",
      reminder_minutes_before: [15],
      is_active: true,
      created_at: isoAtKst(startDate, "10:00:00"),
      updated_at: new Date().toISOString()
    },
    {
      id: stableUuid("routine:medicine"),
      dog_id: dogId,
      created_by: caregiverId,
      task_type: "medicine",
      title: "영양제",
      instructions: "아침 식사 뒤 관절 영양제 1정을 주세요.",
      frequency: "daily",
      interval_count: 1,
      days_of_week: [],
      days_of_month: [],
      times_of_day: ["08:30:00"],
      start_date: startDate,
      end_date: null,
      timezone: "Asia/Seoul",
      reminder_minutes_before: [10],
      is_active: true,
      created_at: isoAtKst(startDate, "10:05:00"),
      updated_at: new Date().toISOString()
    },
    {
      id: stableUuid("routine:walk"),
      dog_id: dogId,
      created_by: ownerId,
      task_type: "walk",
      title: "산책",
      instructions: "추천 코스를 확인하고 30분 정도 걸어요.",
      frequency: "daily",
      interval_count: 1,
      days_of_week: [],
      days_of_month: [],
      times_of_day: ["19:30:00"],
      start_date: startDate,
      end_date: null,
      timezone: "Asia/Seoul",
      reminder_minutes_before: [30],
      is_active: true,
      created_at: isoAtKst(startDate, "10:10:00"),
      updated_at: new Date().toISOString()
    }
  ];
  const { error: routineError } = await supabase
    .from("care_routines")
    .upsert(routineRows, { onConflict: "id" });
  throwIfError(routineError, "Seed care routines");

  const routineIds = routineRows.map((row) => row.id);
  const { error: cleanupError } = await supabase.from("care_tasks").delete().in("routine_id", routineIds);
  throwIfError(cleanupError, "Reset demo routine tasks");

  const taskRows = Array.from({ length: 8 }, (_, daysAgo) => dateKeyDaysAgo(daysAgo)).flatMap(
    (dateKey, dayIndex) =>
      routineRows.flatMap((routine, routineIndex) =>
        routine.times_of_day.map((time, timeIndex) => {
          const scheduledAt = isoAtKst(dateKey, time);
          const isToday = dayIndex === 0;
          const isWalk = routine.task_type === "walk";
          const shouldComplete = !isToday || isWalk || Date.parse(scheduledAt) < Date.now();
          const completedBy = (dayIndex + routineIndex + timeIndex) % 3 === 0 ? caregiverId : ownerId;
          const completedAt = shouldComplete
            ? new Date(Date.parse(scheduledAt) + (8 + ((dayIndex + timeIndex) % 4) * 3) * 60_000).toISOString()
            : null;

          return {
            id: stableUuid(`care-task:${routine.id}:${dateKey}:${time}`),
            dog_id: dogId,
            routine_id: routine.id,
            task_type: routine.task_type,
            title: routine.title,
            scheduled_for: dateKey,
            scheduled_at: scheduledAt,
            status: shouldComplete ? "completed" : "pending",
            completed_at: completedAt,
            completed_by: shouldComplete ? completedBy : null,
            skipped_at: null,
            created_by: routine.created_by,
            note: shouldComplete
              ? completedBy === caregiverId
                ? "공동 보호자가 완료했어요."
                : "정상적으로 완료했어요."
              : routine.instructions,
            created_at: new Date(Date.parse(scheduledAt) - 60 * 60 * 1000).toISOString()
          };
        })
      )
  );
  const { error: taskError } = await supabase.from("care_tasks").insert(taskRows);
  throwIfError(taskError, "Seed care tasks");

  const noteRows = [
    {
      id: stableUuid("care-note:1"),
      dog_id: dogId,
      user_id: caregiverId,
      note: "오늘 아침 사료와 영양제 모두 챙겼어요. 물도 새로 갈았습니다.",
      created_at: isoAtKst(dateKeyDaysAgo(2), "08:48:00")
    },
    {
      id: stableUuid("care-note:2"),
      dog_id: dogId,
      user_id: ownerId,
      note: "저녁 산책 때 차량 소리가 큰 구간은 피해서 걸었어요.",
      created_at: isoAtKst(dateKeyDaysAgo(1), "20:16:00")
    },
    {
      id: stableUuid("care-note:3"),
      dog_id: dogId,
      user_id: caregiverId,
      note: "두부 컨디션 좋아요. 발바닥도 이상 없습니다.",
      created_at: isoAtKst(dateKeyDaysAgo(0), "00:20:00")
    }
  ];
  const { error: noteError } = await supabase.from("care_notes").upsert(noteRows, { onConflict: "id" });
  throwIfError(noteError, "Seed care notes");
  return { routineRows, taskRows };
}

async function seedNotifications(dogId: string, ownerId: string, caregiverId: string) {
  const supabase = getSupabaseAdminClient();
  const rows = [
    {
      id: stableUuid("notification:nudge-owner"),
      dog_id: dogId,
      recipient_user_id: ownerId,
      actor_user_id: caregiverId,
      type: "care_nudge",
      title: "공동 보호자가 콕 찔렀어요",
      message: "지민님이 두부 저녁 산책을 확인해 달라고 요청했어요.",
      metadata: { demo: true, taskType: "walk" },
      dedupe_key: "demo-dgj-nudge-owner",
      read_at: isoAtKst(dateKeyDaysAgo(2), "18:35:00"),
      created_at: isoAtKst(dateKeyDaysAgo(2), "18:30:00")
    },
    {
      id: stableUuid("notification:nudge-caregiver"),
      dog_id: dogId,
      recipient_user_id: caregiverId,
      actor_user_id: ownerId,
      type: "care_nudge",
      title: "동구 보호자님이 콕 찔렀어요",
      message: "두부 아침 영양제를 확인해 주세요.",
      metadata: { demo: true, taskType: "medicine" },
      dedupe_key: "demo-dgj-nudge-caregiver",
      read_at: null,
      created_at: isoAtKst(dateKeyDaysAgo(1), "07:54:00")
    },
    {
      id: stableUuid("notification:walk-reminder"),
      dog_id: dogId,
      recipient_user_id: ownerId,
      actor_user_id: null,
      type: "walk_reminder",
      title: "두부와 산책할 시간이에요",
      message: "오늘 산책 기록이 아직 없어요. 추천 코스를 확인해 보세요.",
      metadata: { demo: true, reason: "scheduled-time" },
      dedupe_key: "demo-dgj-walk-reminder",
      read_at: isoAtKst(dateKeyDaysAgo(3), "19:08:00"),
      created_at: isoAtKst(dateKeyDaysAgo(3), "19:00:00")
    }
  ];
  const { error } = await supabase.from("notifications").upsert(rows, { onConflict: "dedupe_key" });
  throwIfError(error, "Seed notifications");
  return rows;
}

function calculateStreak(startedAtValues: string[]) {
  const walkedDays = new Set(startedAtValues.map((value) => kstDateKey(new Date(value))));
  const today = kstDateKey();
  let cursor = walkedDays.has(today) ? today : previousDateKey(today);
  let streakDays = 0;

  while (walkedDays.has(cursor)) {
    streakDays += 1;
    cursor = previousDateKey(cursor);
  }

  return streakDays;
}

async function verifySeed(owner: AuthUser, caregiver: AuthUser, dogId: string, password: string) {
  const supabase = getSupabaseAdminClient();
  const auth = getSupabaseClient();
  const { data: loginData, error: loginError } = await auth.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password
  });
  throwIfError(loginError, "Verify owner login");

  if (loginData.user?.id !== owner.id) {
    throw new Error("Owner login returned the wrong user.");
  }

  const [walkResult, guardianResult, routineResult, taskResult, notificationResult] = await Promise.all([
    supabase.from("walk_records").select("started_at").eq("dog_id", dogId).not("ended_at", "is", null),
    supabase.from("dog_guardians").select("user_id, role").eq("dog_id", dogId),
    supabase.from("care_routines").select("id").eq("dog_id", dogId).eq("is_active", true),
    supabase.from("care_tasks").select("id, status").eq("dog_id", dogId),
    supabase.from("notifications").select("id").eq("dog_id", dogId)
  ]);
  throwIfError(walkResult.error, "Verify walk records");
  throwIfError(guardianResult.error, "Verify dog guardians");
  throwIfError(routineResult.error, "Verify care routines");
  throwIfError(taskResult.error, "Verify care tasks");
  throwIfError(notificationResult.error, "Verify notifications");

  const guardians = guardianResult.data ?? [];
  const hasOwner = guardians.some((row) => row.user_id === owner.id && row.role === "owner");
  const hasCaregiver = guardians.some((row) => row.user_id === caregiver.id && row.role === "caregiver");

  if (!hasOwner || !hasCaregiver) {
    throw new Error("Owner/caregiver relationship verification failed.");
  }

  return {
    ownerEmail: OWNER_EMAIL,
    caregiverEmail: CAREGIVER_EMAIL,
    dogId,
    dogInviteCode: DOG_INVITE_CODE,
    streakDays: calculateStreak((walkResult.data ?? []).map((row) => row.started_at as string)),
    completedWalks: walkResult.data?.length ?? 0,
    guardians: guardians.length,
    activeCareRoutines: routineResult.data?.length ?? 0,
    completedCareTasks: (taskResult.data ?? []).filter((row) => row.status === "completed").length,
    notifications: notificationResult.data?.length ?? 0,
    loginVerified: true
  };
}

async function main() {
  const ownerPassword = requirePassword("DEMO_ACCOUNT_PASSWORD");
  const caregiverPassword = requirePassword("DEMO_CAREGIVER_PASSWORD", ownerPassword);
  const owner = await ensureAuthUser(OWNER_EMAIL, ownerPassword, "동구 보호자");
  const caregiver = await ensureAuthUser(CAREGIVER_EMAIL, caregiverPassword, "공동 보호자 지민");
  await seedProfiles(owner, caregiver);
  const dogId = await seedDog(owner, caregiver);
  await seedWalks(dogId, owner.id, caregiver.id);
  await seedCareData(dogId, owner.id, caregiver.id);
  await seedNotifications(dogId, owner.id, caregiver.id);
  const verification = await verifySeed(owner, caregiver, dogId, ownerPassword);
  console.log(JSON.stringify(verification, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
