
-- Create meals table
CREATE TABLE public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  meal_type text NOT NULL DEFAULT 'custom',
  logged_at timestamptz NOT NULL DEFAULT now(),
  is_favorite boolean NOT NULL DEFAULT false,
  favorite_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add meal_id to food_entries so entries can be grouped into meals
ALTER TABLE public.food_entries ADD COLUMN meal_id uuid REFERENCES public.meals(id) ON DELETE CASCADE;

-- Enable RLS on meals
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- RLS policies for meals
CREATE POLICY "Users can read own meals" ON public.meals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals" ON public.meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals" ON public.meals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals" ON public.meals FOR DELETE TO authenticated USING (auth.uid() = user_id);
