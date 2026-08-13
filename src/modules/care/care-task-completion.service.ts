import { getSupabaseAdminClient } from "../../lib/supabase";

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
  is_active: boolean;
};

type CompletionResult = {
  dateKey: string;
  completed: boolean;
  taskId: string | null;
};

function localDateKeyKst(iso: string) {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function daysBetween(a: string, b: string) {
  return Math.floor((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / 86_400_000);
}

function monthsBetween(a: string, b: string) {
  const start = dateFromKey(a);
  const end = dateFromKey(b);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
}

function routineAppliesOnDate(routine: CareRoutineRow, dateKey: string) {
  if (!routine.is_active || dateKey < routine.start_date || (routine.end_date && dateKey > routine.end_date)) {
    return false;
  }

  if (routine.frequency === "once") {
    return dateKey === routine.start_date;
  }

  if (routine.frequency === "daily") {
    return daysBetween(routine.start_date, dateKey) % routine.interval_count === 0;
  }

  if (routine.frequency === "weekly") {
    const day = dateFromKey(dateKey).getUTCDay();
    return routine.days_of_week.includes(day) && Math.floor(daysBetween(routine.start_date, dateKey) / 7) % routine.interval_count === 0;
  }

  const dayOfMonth = dateFromKey(dateKey).getUTCDate();
  return routine.days_of_month.includes(dayOfMonth) && monthsBetween(routine.start_date, dateKey) % routine.interval_count === 0;
}

function toScheduledAt(dateKey: string, timeValue: string) {
  const [hour = "00", minute = "00", second = "00"] = timeValue.split(":");
  return `${dateKey}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}+09:00`;
}

async function materializeWalkTasksForDate(
  routines: CareRoutineRow[],
  dateKey: string,
  userId: string,
) {
  const applicable = routines.filter((routine) => routineAppliesOnDate(routine, dateKey));

  if (applicable.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const routineIds = applicable.map((routine) => routine.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("care_tasks")
    .select("routine_id, scheduled_at")
    .in("routine_id", routineIds)
    .eq("scheduled_for", dateKey);

  if (existingError) {
    throw existingError;
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => `${row.routine_id}|${Date.parse(String(row.scheduled_at))}`),
  );
  const inserts = applicable.flatMap((routine) =>
    routine.times_of_day
      .map((timeValue) => ({
        key: `${routine.id}|${Date.parse(toScheduledAt(dateKey, timeValue))}`,
        row: {
          dog_id: routine.dog_id,
          routine_id: routine.id,
          task_type: "walk",
          title: routine.title,
          scheduled_for: dateKey,
          scheduled_at: toScheduledAt(dateKey, timeValue),
          status: "pending",
          created_by: userId,
          note: routine.instructions,
        },
      }))
      .filter((entry) => !existingKeys.has(entry.key))
      .map((entry) => entry.row),
  );

  if (inserts.length === 0) {
    return;
  }

  const { error } = await supabase.from("care_tasks").insert(inserts);

  if (error) {
    throw error;
  }
}

export async function completeNextWalkCareTask({
  dogId,
  occurredAt,
  userId,
}: {
  dogId: string;
  occurredAt: string;
  userId: string;
}): Promise<CompletionResult> {
  const supabase = getSupabaseAdminClient();
  const dateKey = localDateKeyKst(occurredAt);
  const { data: routines, error: routineError } = await supabase
    .from("care_routines")
    .select(
      "id, dog_id, created_by, task_type, title, instructions, frequency, interval_count, days_of_week, days_of_month, times_of_day, start_date, end_date, is_active",
    )
    .eq("dog_id", dogId)
    .eq("task_type", "walk")
    .eq("is_active", true)
    .lte("start_date", dateKey)
    .or(`end_date.is.null,end_date.gte.${dateKey}`);

  if (routineError) {
    throw routineError;
  }

  await materializeWalkTasksForDate((routines ?? []) as CareRoutineRow[], dateKey, userId);

  const { data: task, error: taskError } = await supabase
    .from("care_tasks")
    .select("id")
    .eq("dog_id", dogId)
    .eq("task_type", "walk")
    .eq("scheduled_for", dateKey)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }

  if (!task) {
    return { dateKey, completed: false, taskId: null };
  }

  const { error: updateError } = await supabase
    .from("care_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: userId,
      skipped_at: null,
    })
    .eq("id", task.id)
    .eq("status", "pending");

  if (updateError) {
    throw updateError;
  }

  return { dateKey, completed: true, taskId: String(task.id) };
}
