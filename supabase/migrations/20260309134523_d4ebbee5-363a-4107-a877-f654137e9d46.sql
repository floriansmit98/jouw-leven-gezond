CREATE TABLE public.meal_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  normalized_pattern text NOT NULL,
  food_components text[] NOT NULL DEFAULT '{}',
  default_portions numeric[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read meal patterns"
  ON public.meal_patterns
  FOR SELECT
  TO public
  USING (true);