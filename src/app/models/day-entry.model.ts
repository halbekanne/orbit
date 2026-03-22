export interface CompletedItem {
  type: 'todo' | 'ticket' | 'pr';
  id: string;
  title: string;
  completedAt: string;
}

export interface DayEntry {
  date: string;
  morningQuestion: string | null;
  morningFocus: string | null;
  morningAnsweredAt: string | null;
  eveningQuestion: string | null;
  eveningReflection: string | null;
  eveningAnsweredAt: string | null;
  completedItems: CompletedItem[];
}
