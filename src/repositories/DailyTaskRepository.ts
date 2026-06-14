import { supabase } from '../lib/supabase';
import type { DailyTask, TaskLog } from '../types';
import type { Database } from '../types/database';

type DailyTaskInsert = Database['public']['Tables']['daily_tasks']['Insert'];
type TaskLogInsert = Database['public']['Tables']['task_logs']['Insert'];

export const DailyTaskRepository = {
  async getForDate(userId: string, date: string, categories?: DailyTask['category'][]): Promise<DailyTask[]> {
    let query = supabase.from('daily_tasks').select('*').eq('user_id', userId).eq('task_date', date).order('order_index');
    if (categories) query = query.in('category', categories);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async hasTasksForDate(userId: string, date: string): Promise<boolean> {
    const { data, error } = await supabase.from('daily_tasks').select('id').eq('user_id', userId).eq('task_date', date).limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  async getDatesInRange(userId: string, startDate: string, endDate: string): Promise<Pick<DailyTask, 'id' | 'task_date'>[]> {
    const { data, error } = await supabase
      .from('daily_tasks')
      .select('task_date, id')
      .eq('user_id', userId)
      .gte('task_date', startDate)
      .lte('task_date', endDate);
    if (error) throw error;
    return data ?? [];
  },

  async seedTasks(tasks: DailyTaskInsert[]): Promise<void> {
    if (tasks.length === 0) return;
    const { error } = await supabase.from('daily_tasks').upsert(tasks, {
      onConflict: 'user_id,task_date,category,title',
      ignoreDuplicates: true,
    });
    if (error) throw error;
  },

  async getLogsForDate(userId: string, date: string): Promise<TaskLog[]> {
    const { data, error } = await supabase.from('task_logs').select('*').eq('user_id', userId).eq('log_date', date);
    if (error) throw error;
    return data ?? [];
  },

  async getAllLogs(userId: string): Promise<TaskLog[]> {
    const { data, error } = await supabase.from('task_logs').select('*').eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },

  async getTaskLogsWithCategoryInRange(
    userId: string,
    startDate: string,
    endDate: string,
    categories?: DailyTask['category'][]
  ): Promise<{ log_date: string; completed: boolean; category: DailyTask['category']; title: string }[]> {
    let taskQuery = supabase
      .from('daily_tasks')
      .select('id, category, title')
      .eq('user_id', userId)
      .gte('task_date', startDate)
      .lte('task_date', endDate);
    if (categories) taskQuery = taskQuery.in('category', categories);
    const { data: tasks, error: tasksError } = await taskQuery;
    if (tasksError) throw tasksError;
    if (!tasks || tasks.length === 0) return [];

    const taskById = new Map(tasks.map(t => [t.id, t]));
    const { data: logs, error: logsError } = await supabase
      .from('task_logs')
      .select('task_id, log_date, completed')
      .eq('user_id', userId)
      .in('task_id', tasks.map(t => t.id))
      .gte('log_date', startDate)
      .lte('log_date', endDate);
    if (logsError) throw logsError;

    const rows: { log_date: string; completed: boolean; category: DailyTask['category']; title: string }[] = [];
    for (const log of logs ?? []) {
      const task = taskById.get(log.task_id);
      if (!task) continue;
      rows.push({ log_date: log.log_date, completed: log.completed, category: task.category, title: task.title });
    }
    return rows;
  },

  async getLogsInRange(userId: string, startDate: string, endDate: string): Promise<Pick<TaskLog, 'log_date' | 'completed'>[]> {
    const { data, error } = await supabase
      .from('task_logs')
      .select('log_date, completed')
      .eq('user_id', userId)
      .gte('log_date', startDate)
      .lte('log_date', endDate);
    if (error) throw error;
    return data ?? [];
  },

  async upsertLog(entry: TaskLogInsert): Promise<void> {
    const { error } = await supabase.from('task_logs').upsert(entry, { onConflict: 'user_id,task_id,log_date' });
    if (error) throw error;
  },

  async upsertLogs(entries: TaskLogInsert[]): Promise<void> {
    const { error } = await supabase.from('task_logs').upsert(entries, { onConflict: 'user_id,task_id,log_date' });
    if (error) throw error;
  },
};
