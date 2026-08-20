import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import type {
  careNudgeSchema,
  careRoutineListQuerySchema,
  careRoutineSchema,
  careScheduleQuerySchema,
  careTaskIdParamsSchema,
  updateCareTaskSchema
} from "./care.schemas";

type CareRoutineRow = {
  id: string;
  dog_id: string;
  created_by: string;
  task_type: string;
  title: string;
  instructions: string | null;
  frequency: "once" | "daily" | "weekly" | "monthly";
  interval_count: number;
  days_of_week: number[];
  days_of_month: number[];
  times_of_day: string[];
  start_date: string;
  end_date: string | null;
  timezone: string;
  reminder_minutes_before: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CareTaskRow = {
  id: string;
  dog_id: string;
  routine_id: string | null;
  task_type: string;
  title: string;
  scheduled_for: string;
  scheduled_at: string | null;
  status: "pending" | "completed" | "skipped";
  completed_at: string | null;
  skipped_at: string | null;
  completed_by: string | null;
  note: string | null;
  created_at: string;
};

const CARE_ROUTINE_SELECT =
  "id, dog_id, created_by, task_type, title, instructions, frequency, interval_count, days_of_week, days_of_month, times_of_day, start_date, end_date, timezone, reminder_minutes_before, is_active, created_at, updated_at";

const CARE_TASK_SELECT =
  "id, dog_id, routine_id, task_type, title, scheduled_for, scheduled_at, status, completed_at, skipped_at, completed_by, note, created_at";

function getAuthUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.authUser?.id) {
    throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
  }

  return req.authUser.id;
}

function todayKeyKst() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function previousDateKey(dateKey: string) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const diff = dateFromKey(b).getTime() - dateFromKey(a).getTime();
  return Math.floor(diff / 86_400_000);
}

function monthsBetween(a: string, b: string) {
  const start = dateFromKey(a);
  const end = dateFromKey(b);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
}

function dayOfWeek(dateKey: string) {
  return dateFromKey(dateKey).getUTCDay();
}

function dayOfMonth(dateKey: string) {
  return dateFromKey(dateKey).getUTCDate();
}

function toScheduledAt(dateKey: string, timeValue: string) {
  const [hour = "00", minute = "00", second = "00"] = timeValue.split(":");
  return `${dateKey}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}+09:00`;
}

function routineAppliesOnDate(routine: CareRoutineRow, dateKey: string) {
  if (!routine.is_active) {
    return false;
  }

  if (dateKey < routine.start_date) {
    return false;
  }

  if (routine.end_date && dateKey > routine.end_date) {
    return false;
  }

  if (routine.frequency === "once") {
    return dateKey === routine.start_date;
  }

  if (routine.frequency === "daily") {
    return daysBetween(routine.start_date, dateKey) % routine.interval_count === 0;
  }

  if (routine.frequency === "weekly") {
    const allowedDays = routine.days_of_week.length > 0 ? routine.days_of_week : [dayOfWeek(routine.start_date)];
    const weekDistance = Math.floor(daysBetween(routine.start_date, dateKey) / 7);
    return allowedDays.includes(dayOfWeek(dateKey)) && weekDistance % routine.interval_count === 0;
  }

  const allowedMonthDays =
    routine.days_of_month.length > 0 ? routine.days_of_month : [dayOfMonth(routine.start_date)];
  return (
    allowedMonthDays.includes(dayOfMonth(dateKey)) &&
    monthsBetween(routine.start_date, dateKey) % routine.interval_count === 0
  );
}

function toRoutine(row: CareRoutineRow) {
  return {
    id: row.id,
    dogId: row.dog_id,
    createdBy: row.created_by,
    taskType: row.task_type,
    title: row.title,
    instructions: row.instructions,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    daysOfWeek: row.days_of_week,
    daysOfMonth: row.days_of_month,
    timesOfDay: row.times_of_day,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    reminderMinutesBefore: row.reminder_minutes_before,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toTask(row: CareTaskRow, guardianName: string | null = null) {
  return {
    id: row.id,
    dogId: row.dog_id,
    routineId: row.routine_id,
    taskType: row.task_type,
    title: row.title,
    scheduledFor: row.scheduled_for,
    scheduledAt: row.scheduled_at,
    status: row.status,
    completedAt: row.completed_at,
    skippedAt: row.skipped_at,
    completedBy: row.completed_by,
    guardianName,
    note: row.note,
    createdAt: row.created_at
  };
}

/**
 * completed_by 로 남은 사용자 id들을 실제 보호자 이름(guardian_profiles.display_name)으로
 * 바꿔줄 Map을 만든다. guardian_profiles 는 auth user id를 그대로 id 컬럼(PK)으로 쓴다
 * (onboarding.controller.ts의 ensureGuardianProfile 참고). 이 조회가 실패해도 전체 요청을
 * 실패시키지 않고 이름 없이(null) 내려준다 — walk-record.controller.ts와 동일한 best-effort 패턴.
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
      console.warn("Failed to look up guardian names for care tasks.", error);
      return new Map();
    }

    return new Map(
      ((data ?? []) as Array<{ id: string; display_name: string | null }>)
        .filter((row) => row.display_name)
        .map((row) => [row.id, row.display_name as string])
    );
  } catch (error) {
    console.warn("Failed to look up guardian names for care tasks.", error);
    return new Map();
  }
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

async function listGuardianDogIds(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("dog_guardians")
    .select("dog_id")
    .eq("user_id", userId);

  if (error) {
    throw new AppError(error.message, 500, "DOG_GUARDIAN_LOOKUP_FAILED");
  }

  return (data ?? []).map((row) => row.dog_id as string);
}

async function endOverlappingCareRoutines(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dogId: string,
  taskType: string,
  startDate: string,
) {
  const replacementEndDate = previousDateKey(startDate);
  const { error: currentRoutineError } = await supabase
    .from("care_routines")
    .update({ end_date: replacementEndDate })
    .eq("dog_id", dogId)
    .eq("task_type", taskType)
    .eq("is_active", true)
    .lte("start_date", replacementEndDate)
    .or(`end_date.is.null,end_date.gte.${startDate}`);

  if (currentRoutineError) {
    throw new AppError("케어 루틴 변경 예약에 실패했습니다.", 500, "CARE_ROUTINE_REPLACE_FAILED");
  }

  const { error: futureRoutineError } = await supabase
    .from("care_routines")
    .update({ is_active: false })
    .eq("dog_id", dogId)
    .eq("task_type", taskType)
    .eq("is_active", true)
    .gte("start_date", startDate);

  if (futureRoutineError) {
    throw new AppError("케어 루틴 변경 예약에 실패했습니다.", 500, "CARE_ROUTINE_REPLACE_FAILED");
  }
}

async function materializeRoutineTasks(routines: CareRoutineRow[], dateKey: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const applicable = routines.filter((routine) => routineAppliesOnDate(routine, dateKey));

  if (applicable.length === 0) {
    return;
  }

  const routineIds = applicable.map((routine) => routine.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("care_tasks")
    .select("routine_id, scheduled_at")
    .in("routine_id", routineIds)
    .eq("scheduled_for", dateKey);

  if (existingError) {
    throw new AppError(existingError.message, 500, "CARE_TASK_LOOKUP_FAILED");
  }

  // 이미 만들어둔 태스크인지 볼 때 timestamptz 를 문자열로 비교하면 안 된다.
  // Postgres 는 UTC 로 돌려주고(2026-08-11T23:00:00.000Z) toScheduledAt 은
  // KST 로 만들어(2026-08-12T08:00:00+09:00) 같은 시각인데도 문자열이 달랐다.
  // 그래서 중복 검사가 항상 빗나가 매번 재삽입을 시도했고,
  // care_tasks_routine_scheduled_unique_idx 에 걸려 루틴이 하나라도 있으면
  // GET /api/care/today 가 영구히 500 이었다. 에포크 ms 로 맞춰서 비교한다.
  const existingKeys = new Set(
    (existingRows ?? []).map((row) => `${row.routine_id}|${Date.parse(String(row.scheduled_at))}`)
  );
  const inserts = applicable.flatMap((routine) =>
    routine.times_of_day
      .map((timeValue) => ({
        key: `${routine.id}|${Date.parse(toScheduledAt(dateKey, timeValue))}`,
        row: {
          dog_id: routine.dog_id,
          routine_id: routine.id,
          task_type: routine.task_type,
          title: routine.title,
          scheduled_for: dateKey,
          scheduled_at: toScheduledAt(dateKey, timeValue),
          status: "pending",
          created_by: userId,
          note: routine.instructions
        }
      }))
      .filter((entry) => !existingKeys.has(entry.key))
      .map((entry) => entry.row)
  );

  if (inserts.length === 0) {
    return;
  }

  const { error } = await supabase.from("care_tasks").insert(inserts);

  if (error) {
    throw new AppError(error.message, 500, "CARE_TASK_MATERIALIZE_FAILED");
  }
}

export const createCareRoutine: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = req.body as z.infer<typeof careRoutineSchema>;
    await assertDogGuardian(body.dogId, userId);

    const supabase = getSupabaseAdminClient();
    await endOverlappingCareRoutines(supabase, body.dogId, body.taskType, body.startDate);

    const { data, error } = await supabase
      .from("care_routines")
      .insert({
        dog_id: body.dogId,
        created_by: userId,
        task_type: body.taskType,
        title: body.title,
        instructions: body.instructions ?? null,
        frequency: body.frequency,
        interval_count: body.intervalCount,
        days_of_week: body.daysOfWeek,
        days_of_month: body.daysOfMonth,
        times_of_day: body.timesOfDay,
        start_date: body.startDate,
        end_date: body.endDate ?? null,
        timezone: body.timezone,
        reminder_minutes_before: body.reminderMinutesBefore,
        is_active: body.isActive
      })
      .select(CARE_ROUTINE_SELECT)
      .single();

    if (error) {
      throw new AppError(error.message, 500, "CARE_ROUTINE_CREATE_FAILED");
    }

    res.status(201).json({ routine: toRoutine(data as CareRoutineRow) });
  } catch (error) {
    next(error);
  }
};

export const listCareRoutines: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const query = req.query as unknown as z.infer<typeof careRoutineListQuerySchema>;
    const dogIds = query.dogId ? [query.dogId] : await listGuardianDogIds(userId);

    if (query.dogId) {
      await assertDogGuardian(query.dogId, userId);
    }

    if (dogIds.length === 0) {
      res.json({ routines: [] });
      return;
    }

    const supabase = getSupabaseAdminClient();
    let request = supabase
      .from("care_routines")
      .select(CARE_ROUTINE_SELECT)
      .in("dog_id", dogIds)
      .order("created_at", { ascending: false });

    if (!query.includeInactive) {
      request = request.eq("is_active", true);
    }

    const { data, error } = await request;

    if (error) {
      throw new AppError(error.message, 500, "CARE_ROUTINE_LIST_FAILED");
    }

    res.json({ routines: ((data ?? []) as CareRoutineRow[]).map(toRoutine) });
  } catch (error) {
    next(error);
  }
};

export const getTodayCareStatus: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const query = req.query as unknown as z.infer<typeof careScheduleQuerySchema>;
    const dateKey = query.date ?? todayKeyKst();
    const dogIds = query.dogId ? [query.dogId] : await listGuardianDogIds(userId);

    if (query.dogId) {
      await assertDogGuardian(query.dogId, userId);
    }

    if (dogIds.length === 0) {
      res.json({ date: dateKey, tasks: [], routines: [] });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: routines, error: routineError } = await supabase
      .from("care_routines")
      .select(CARE_ROUTINE_SELECT)
      .in("dog_id", dogIds)
      .eq("is_active", true)
      .lte("start_date", dateKey)
      .or(`end_date.is.null,end_date.gte.${dateKey}`);

    if (routineError) {
      throw new AppError(routineError.message, 500, "CARE_ROUTINE_LOOKUP_FAILED");
    }

    await materializeRoutineTasks((routines ?? []) as CareRoutineRow[], dateKey, userId);

    const { data: tasks, error: taskError } = await supabase
      .from("care_tasks")
      .select(CARE_TASK_SELECT)
      .in("dog_id", dogIds)
      .eq("scheduled_for", dateKey)
      .order("scheduled_at", { ascending: true });

    if (taskError) {
      throw new AppError(taskError.message, 500, "CARE_TASK_LIST_FAILED");
    }

    const taskRows = (tasks ?? []) as CareTaskRow[];
    const guardianNameById = await lookupGuardianNames(
      taskRows.map((row) => row.completed_by).filter((id): id is string => Boolean(id))
    );

    res.json({
      date: dateKey,
      routines: ((routines ?? []) as CareRoutineRow[]).map(toRoutine),
      tasks: taskRows.map((row) =>
        toTask(row, row.completed_by ? (guardianNameById.get(row.completed_by) ?? null) : null)
      )
    });
  } catch (error) {
    next(error);
  }
};

export const updateCareTask: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { taskId } = req.params as z.infer<typeof careTaskIdParamsSchema>;
    const body = req.body as z.infer<typeof updateCareTaskSchema>;
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: lookupError } = await supabase
      .from("care_tasks")
      .select("id, dog_id")
      .eq("id", taskId)
      .maybeSingle();

    if (lookupError) {
      throw new AppError(lookupError.message, 500, "CARE_TASK_LOOKUP_FAILED");
    }

    if (!existing) {
      throw new AppError("Care task not found.", 404, "CARE_TASK_NOT_FOUND");
    }

    await assertDogGuardian((existing as { dog_id: string }).dog_id, userId);

    const { data, error } = await supabase
      .from("care_tasks")
      .update({
        status: body.status,
        completed_at: body.status === "completed" ? new Date().toISOString() : null,
        completed_by: body.status === "completed" ? userId : null,
        skipped_at: body.status === "skipped" ? new Date().toISOString() : null,
        note: body.note ?? null
      })
      .eq("id", taskId)
      .select(CARE_TASK_SELECT)
      .single();

    if (error) {
      throw new AppError(error.message, 500, "CARE_TASK_UPDATE_FAILED");
    }

    res.json({ task: toTask(data as CareTaskRow) });
  } catch (error) {
    next(error);
  }
};

export const sendCareNudge: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = req.body as z.infer<typeof careNudgeSchema>;
    await assertDogGuardian(body.dogId, userId);

    const supabase = getSupabaseAdminClient();
    const [{ data: dog, error: dogError }, { data: actor, error: actorError }, { data: guardians, error: guardiansError }] =
      await Promise.all([
        supabase.from("dogs").select("id, name").eq("id", body.dogId).maybeSingle(),
        supabase.from("guardian_profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase
          .from("dog_guardians")
          .select("user_id")
          .eq("dog_id", body.dogId)
          .neq("user_id", userId)
      ]);

    if (dogError) {
      throw new AppError(dogError.message, 500, "DOG_LOOKUP_FAILED");
    }

    if (!dog) {
      throw new AppError("Dog not found.", 404, "DOG_NOT_FOUND");
    }

    if (actorError) {
      throw new AppError(actorError.message, 500, "GUARDIAN_PROFILE_LOOKUP_FAILED");
    }

    if (guardiansError) {
      throw new AppError(guardiansError.message, 500, "DOG_GUARDIAN_LOOKUP_FAILED");
    }

    let taskTitle: string | null = null;

    if (body.taskId) {
      const { data: task, error: taskError } = await supabase
        .from("care_tasks")
        .select("id, dog_id, title")
        .eq("id", body.taskId)
        .maybeSingle();

      if (taskError) {
        throw new AppError(taskError.message, 500, "CARE_TASK_LOOKUP_FAILED");
      }

      if (!task || (task as { dog_id: string }).dog_id !== body.dogId) {
        throw new AppError("Care task not found.", 404, "CARE_TASK_NOT_FOUND");
      }

      taskTitle = (task as { title: string }).title;
    }

    const recipients = ((guardians ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);

    if (recipients.length === 0) {
      res.status(202).json({ message: "함께 알림을 받을 공동 보호자가 아직 없어요.", recipientCount: 0 });
      return;
    }

    const dogName = (dog as { name: string }).name;
    const actorName = (actor as { display_name?: string | null } | null)?.display_name ?? "공동 보호자";
    const bucket = Math.floor(Date.now() / 600_000);
    const targetLabel = taskTitle ? `${taskTitle}을(를)` : `${dogName} 케어를`;
    const rows = recipients.map((recipientId) => ({
      dog_id: body.dogId,
      recipient_user_id: recipientId,
      actor_user_id: userId,
      type: "care_nudge",
      title: `${actorName}님이 콕 찔렀어요`,
      message: `${targetLabel} 확인해 달라는 알림이에요.`,
      metadata: { taskId: body.taskId ?? null },
      dedupe_key: `care-nudge:${recipientId}:${body.taskId ?? body.dogId}:${bucket}`
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });

    if (insertError) {
      throw new AppError(insertError.message, 500, "CARE_NUDGE_CREATE_FAILED");
    }

    res.status(202).json({
      message: "콕 찔렀어요.",
      recipientCount: recipients.length
    });
  } catch (error) {
    next(error);
  }
};
