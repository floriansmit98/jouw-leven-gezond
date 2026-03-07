
-- Foods catalog (public, read-only for users)
CREATE TABLE public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'overig',
  portion_description text NOT NULL,
  portion_grams numeric NOT NULL DEFAULT 100,
  potassium_mg numeric NOT NULL DEFAULT 0,
  phosphate_mg numeric NOT NULL DEFAULT 0,
  sodium_mg numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  fluid_ml numeric NOT NULL DEFAULT 0,
  dialysis_risk_label text DEFAULT 'laag',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read foods" ON public.foods
  FOR SELECT USING (true);

-- Index for search
CREATE INDEX foods_name_idx ON public.foods USING gin (to_tsvector('dutch', name));
CREATE INDEX foods_category_idx ON public.foods (category);

-- User food entries
CREATE TABLE public.food_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_id uuid REFERENCES public.foods(id),
  name text NOT NULL,
  potassium_mg numeric NOT NULL DEFAULT 0,
  phosphate_mg numeric NOT NULL DEFAULT 0,
  sodium_mg numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  fluid_ml numeric NOT NULL DEFAULT 0,
  portions numeric NOT NULL DEFAULT 1,
  logged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries" ON public.food_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON public.food_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries" ON public.food_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Gebruiker'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
