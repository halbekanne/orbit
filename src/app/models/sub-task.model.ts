export interface SubTask {
  id: string;
  title: string;
  status: 'open' | 'done';
  completedAt: string | null;
}

export function createSubTask(title: string): SubTask {
  return {
    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    status: 'open',
    completedAt: null,
  };
}
