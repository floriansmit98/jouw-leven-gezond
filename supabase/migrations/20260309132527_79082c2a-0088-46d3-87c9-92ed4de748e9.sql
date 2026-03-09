
-- Add source_name and search_rank to existing foods table
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS search_rank integer DEFAULT 0;

-- Backfill source_name from name where not set
UPDATE public.foods SET source_name = name WHERE source_name IS NULL;

-- Create common_meals table (system-defined meals, not user meals)
CREATE TABLE public.common_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  simplified_name text,
  category text NOT NULL DEFAULT 'maaltijden',
  aliases text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.common_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read common meals" ON public.common_meals FOR SELECT TO public USING (true);

-- Create common_meal_items linking meals to component foods
CREATE TABLE public.common_meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES public.common_meals(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  amount_grams numeric DEFAULT 0,
  amount_ml numeric DEFAULT 0,
  portion_count numeric DEFAULT 1
);

ALTER TABLE public.common_meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read common meal items" ON public.common_meal_items FOR SELECT TO public USING (true);

-- Create branded_products table
CREATE TABLE public.branded_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  product_name text NOT NULL,
  display_name text NOT NULL,
  simplified_name text,
  generic_food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'overig',
  aliases text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branded_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read branded products" ON public.branded_products FOR SELECT TO public USING (true);

-- Create product_aliases table (polymorphic)
CREATE TABLE public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('food', 'meal', 'branded_product')),
  target_id uuid NOT NULL,
  alias text NOT NULL,
  normalized_alias text NOT NULL
);

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read aliases" ON public.product_aliases FOR SELECT TO public USING (true);

-- Create missing_searches table
CREATE TABLE public.missing_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term text NOT NULL,
  normalized_search_term text NOT NULL,
  result_type text NOT NULL DEFAULT 'not_found' CHECK (result_type IN ('not_found', 'weak_match')),
  suggested_match text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.missing_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert missing searches" ON public.missing_searches FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated users can read own missing searches" ON public.missing_searches FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Indexes for search performance
CREATE INDEX idx_common_meals_simplified ON public.common_meals(simplified_name);
CREATE INDEX idx_branded_products_simplified ON public.branded_products(simplified_name);
CREATE INDEX idx_branded_products_brand ON public.branded_products(brand);
CREATE INDEX idx_product_aliases_normalized ON public.product_aliases(normalized_alias);
CREATE INDEX idx_product_aliases_target ON public.product_aliases(target_type, target_id);
CREATE INDEX idx_missing_searches_term ON public.missing_searches(normalized_search_term);
CREATE INDEX idx_foods_search_rank ON public.foods(search_rank);
