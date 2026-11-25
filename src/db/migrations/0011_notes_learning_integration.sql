-- 0011_notes_learning_integration.sql
-- Deep integration between Notes, Learning, Study Mode, Spaced Repetition, and Quizzes

-- 1. Extend lessons with difficulty, objectives, prerequisites, resources
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Extend learning_resource_links with path_id, module_id, purpose, is_required, sort_order
ALTER TABLE public.learning_resource_links
  ADD COLUMN IF NOT EXISTS path_id UUID REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'supplementary',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS learning_links_module_idx ON public.learning_resource_links (module_id);
CREATE INDEX IF NOT EXISTS learning_links_note_idx ON public.learning_resource_links (note_id);

-- 3. Multi-type lesson contents
CREATE TABLE IF NOT EXISTS public.lesson_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'text',
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  deck_id UUID REFERENCES public.flashcard_decks(id) ON DELETE SET NULL,
  quiz_id UUID,
  metadata JSONB,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lesson_contents_lesson_idx ON public.lesson_contents (lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS lesson_contents_note_idx ON public.lesson_contents (note_id);

-- 4. Study Mode sessions
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  lessons_completed INT NOT NULL DEFAULT 0,
  flashcards_reviewed INT NOT NULL DEFAULT 0,
  quiz_score_percent INT,
  difficulty_rating TEXT,
  flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  notes_text TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS study_sessions_user_idx ON public.study_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS study_sessions_course_idx ON public.study_sessions (course_id);

-- 5. Spaced Repetition reviews for notes, lessons, and concepts
CREATE TABLE IF NOT EXISTS public.learning_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  interval_days INT NOT NULL DEFAULT 1,
  repetitions INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  last_rating TEXT,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learning_reviews_user_due_idx ON public.learning_reviews (user_id, due_at);
CREATE INDEX IF NOT EXISTS learning_reviews_entity_idx ON public.learning_reviews (entity_type, entity_id);

-- 6. Quizzes, Questions, and Attempts
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  passing_score INT NOT NULL DEFAULT 70,
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  max_attempts INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quizzes_user_idx ON public.quizzes (user_id);
CREATE INDEX IF NOT EXISTS quizzes_course_idx ON public.quizzes (course_id);
CREATE INDEX IF NOT EXISTS quizzes_lesson_idx ON public.quizzes (lesson_id);
CREATE INDEX IF NOT EXISTS quizzes_note_idx ON public.quizzes (note_id);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_answer TEXT,
  explanation TEXT,
  points INT NOT NULL DEFAULT 1,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_idx ON public.quiz_questions (quiz_id, sort_order);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score_percent INT NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_idx ON public.quiz_attempts (quiz_id, completed_at DESC);

-- 7. Enable RLS and user isolation policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lesson_contents',
    'study_sessions',
    'learning_reviews',
    'quizzes',
    'quiz_questions',
    'quiz_attempts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner_all ON public.%I USING (user_id = current_setting(''app.current_user_id'', true)::uuid) WITH CHECK (user_id = current_setting(''app.current_user_id'', true)::uuid)',
      t, t
    );
  END LOOP;
END $$;
