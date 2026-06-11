/*
  # Fix duplicate daily_tasks rows

  1. Problem
     - `seedTasksFromPlan()` (Dashboard) used a check-then-insert pattern to seed
       today's tasks from the active plan. Under a race (e.g. the fetch effect
       firing more than once before the first insert commits), both calls saw
       "no tasks yet" and each inserted a full set, producing duplicate
       daily_tasks rows for the same user/date/category/title. This shows up as
       duplicated tasks on the Today (Dashboard) screen and duplicated activity
       counts on the Progress screen.

  2. Changes
     - De-duplicate existing daily_tasks rows, keeping the earliest row per
       (user_id, task_date, category, title).
     - Re-point or merge task_logs referencing the removed duplicate rows so no
       completion data is lost, without violating the existing
       UNIQUE(user_id, task_id, log_date) constraint on task_logs.
     - Add a unique index on (user_id, task_date, category, title) so future
       seeding can use an idempotent upsert instead of relying on a
       check-then-insert race.
*/

-- Step 1: drop task_logs on duplicate rows that would collide with a log
-- already present on the row we're keeping for that (task, log_date).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, task_date, category, title
      ORDER BY created_at, id
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY user_id, task_date, category, title
      ORDER BY created_at, id
    ) AS keep_id
  FROM daily_tasks
)
DELETE FROM task_logs tl
USING ranked r
WHERE tl.task_id = r.id
  AND r.rn > 1
  AND EXISTS (
    SELECT 1 FROM task_logs tl2
    WHERE tl2.task_id = r.keep_id AND tl2.log_date = tl.log_date
  );

-- Step 2: re-point remaining task_logs from duplicate rows to the kept row.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, task_date, category, title
      ORDER BY created_at, id
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY user_id, task_date, category, title
      ORDER BY created_at, id
    ) AS keep_id
  FROM daily_tasks
)
UPDATE task_logs tl
SET task_id = r.keep_id
FROM ranked r
WHERE tl.task_id = r.id AND r.rn > 1;

-- Step 3: remove the duplicate daily_tasks rows.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, task_date, category, title
      ORDER BY created_at, id
    ) AS rn
  FROM daily_tasks
)
DELETE FROM daily_tasks
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 4: prevent future duplicates and enable idempotent upsert-based seeding.
CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_unique_per_day
  ON daily_tasks(user_id, task_date, category, title);
