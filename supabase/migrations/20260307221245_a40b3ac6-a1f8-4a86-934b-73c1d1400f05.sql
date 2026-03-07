
CREATE TABLE public.symptom_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symptom_name TEXT NOT NULL,
  severity_score INTEGER NOT NULL DEFAULT 3,
  notes TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.symptom_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own symptoms" ON public.symptom_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own symptoms" ON public.symptom_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own symptoms" ON public.symptom_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
