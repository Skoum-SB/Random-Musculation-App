export type WorkoutType = 'musculation';

export interface SetInput {
  reps: number;
  weight: number;
  restSeconds: number;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  type: WorkoutType;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplateWithMeta extends WorkoutTemplate {
  exercise_count: number;
  last_session_date: string | null;
}

export interface TemplateExercise {
  id: number;
  template_id: number;
  name: string;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  sort_order: number;
}

export interface WorkoutSession {
  id: number;
  template_id: number;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
}

export interface WorkoutSessionWithName extends WorkoutSession {
  template_name: string;
}

export interface SessionSet {
  id: number;
  session_id: number;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number;
  completed: number;
}

export interface ActiveExercise {
  name: string;
  sets: ActiveSet[];
}

export interface ActiveSet {
  setNumber: number;
  reps: number;
  weight: number;
  restSeconds: number;
  completed: boolean;
}
