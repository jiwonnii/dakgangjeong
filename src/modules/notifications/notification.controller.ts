import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import type {
  markNotificationsReadSchema,
  notificationListQuerySchema
} from "./notification.schemas";

type NotificationRow = {
  id: string;
  dog_id: string | null;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: "care_nudge" | "walk_reminder";
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type DogRow = {
  id: string;
  name: string;
};

type WalkTaskRow = {
  id: string;
  dog_id: string;
  title: string;
  scheduled_at: string | null;
};

const NOTIFICATION_SELECT =
  "id, dog_id, recipient_user_id, actor_user_id, type, title, message, metadata, read_at, created_at";

function getAuthUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.authUser?.id) {
    throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
  }

  return req.authUser.id;
}

function kstDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function kstHour(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dayBoundsKst(dateKey: string) {
  return {
    startIso: new Date(`${dateKey}T00:00:00+09:00`).toISOString(),
    endIso: new Date(`${nextDateKey(dateKey)}T00:00:00+09:00`).toISOString()
  };
}

function toNotification(row: NotificationRow) {
  return {
    id: row.id,
    dogId: row.dog_id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata,
    readAt: row.read_at,
    createdAt: row.created_at
  };
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

async function assertDogGuardian(dogId: string, userId: string): Promise<void> {
  const dogIds = await listGuardianDogIds(userId);

  if (!dogIds.includes(dogId)) {
    throw new AppError("You are not a guardian of this dog.", 403, "DOG_GUARDIAN_REQUIRED");
  }
}

async function insertDedupedNotifications(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (error) {
    throw new AppError(error.message, 500, "NOTIFICATION_CREATE_FAILED");
  }
}

async function ensureWalkRemindersForUser(userId: string, dogId?: string) {
  const dogIds = dogId ? [dogId] : await listGuardianDogIds(userId);

  if (dogId) {
    await assertDogGuardian(dogId, userId);
  }

  if (dogIds.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const today = kstDateKey();
  const nowIso = new Date().toISOString();
  const { startIso, endIso } = dayBoundsKst(today);

  const [{ data: dogs, error: dogError }, { data: records, error: recordError }, { data: tasks, error: taskError }] =
    await Promise.all([
      supabase.from("dogs").select("id, name").in("id", dogIds),
      supabase
        .from("walk_records")
        .select("dog_id")
        .in("dog_id", dogIds)
        .not("ended_at", "is", null)
        .gte("started_at", startIso)
        .lt("started_at", endIso),
      supabase
        .from("care_tasks")
        .select("id, dog_id, title, scheduled_at")
        .in("dog_id", dogIds)
        .eq("task_type", "walk")
        .eq("scheduled_for", today)
        .eq("status", "pending")
    ]);

  if (dogError) {
    throw new AppError(dogError.message, 500, "DOG_LOOKUP_FAILED");
  }

  if (recordError) {
    throw new AppError(recordError.message, 500, "WALK_RECORD_LOOKUP_FAILED");
  }

  if (taskError) {
    throw new AppError(taskError.message, 500, "CARE_TASK_LOOKUP_FAILED");
  }

  const dogNameById = new Map(((dogs ?? []) as DogRow[]).map((dog) => [dog.id, dog.name]));
  const walkedDogIds = new Set(((records ?? []) as Array<{ dog_id: string }>).map((row) => row.dog_id));
  const dueTasks = ((tasks ?? []) as WalkTaskRow[]).filter(
    (task) => task.scheduled_at && new Date(task.scheduled_at).getTime() <= Date.parse(nowIso)
  );
  const rows: Array<Record<string, unknown>> = [];

  for (const task of dueTasks) {
    if (walkedDogIds.has(task.dog_id)) {
      continue;
    }

    const dogName = dogNameById.get(task.dog_id) ?? "반려견";
    rows.push({
      dog_id: task.dog_id,
      recipient_user_id: userId,
      type: "walk_reminder",
      title: `${dogName} 산책 시간이 지났어요`,
      message: `${task.title} 일정이 아직 완료되지 않았어요. 가능하면 지금 산책을 챙겨주세요.`,
      metadata: { taskId: task.id, reminderKind: "scheduled" },
      dedupe_key: `walk-reminder:${userId}:${task.id}:${today}`
    });
  }

  if (kstHour() >= 22) {
    for (const id of dogIds) {
      if (walkedDogIds.has(id)) {
        continue;
      }

      const dogName = dogNameById.get(id) ?? "반려견";
      rows.push({
        dog_id: id,
        recipient_user_id: userId,
        type: "walk_reminder",
        title: `${dogName} 산책 기록이 아직 없어요`,
        message: "하루가 2시간 정도 남았어요. 오늘 산책을 아직 못 했다면 짧게라도 다녀와 주세요.",
        metadata: { reminderKind: "late_day" },
        dedupe_key: `walk-reminder-late:${userId}:${id}:${today}`
      });
    }
  }

  await insertDedupedNotifications(rows);
}

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const query = req.query as unknown as z.infer<typeof notificationListQuerySchema>;
    await ensureWalkRemindersForUser(userId, query.dogId);

    const supabase = getSupabaseAdminClient();
    let request = supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(query.limit);

    if (query.dogId) {
      request = request.eq("dog_id", query.dogId);
    }

    const { data, error } = await request;

    if (error) {
      throw new AppError(error.message, 500, "NOTIFICATION_LIST_FAILED");
    }

    const rows = (data ?? []) as NotificationRow[];
    res.json({
      notifications: rows.map(toNotification),
      unreadCount: rows.filter((row) => !row.read_at).length
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationsRead: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = req.body as z.infer<typeof markNotificationsReadSchema>;

    if (body.dogId) {
      await assertDogGuardian(body.dogId, userId);
    }

    const supabase = getSupabaseAdminClient();
    let request = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", userId)
      .is("read_at", null);

    if (body.dogId) {
      request = request.eq("dog_id", body.dogId);
    }

    const { error } = await request;

    if (error) {
      throw new AppError(error.message, 500, "NOTIFICATION_READ_FAILED");
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
