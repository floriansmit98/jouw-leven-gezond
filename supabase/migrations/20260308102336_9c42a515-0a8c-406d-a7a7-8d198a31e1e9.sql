
-- Add keywords column
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}'::text[];

-- Create improved ranked search function with correct column order
CREATE OR REPLACE FUNCTION public.search_foods_ranked(
  search_query text,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH query_words AS (
    SELECT unnest(string_to_array(lower(trim(search_query)), ' ')) AS word
    WHERE trim(search_query) != ''
  ),
  scored AS (
    SELECT f.*,
      CASE
        WHEN lower(f.name) = lower(trim(search_query)) THEN 100
        WHEN lower(f.name) LIKE lower(trim(search_query)) || '%' THEN 80
        WHEN lower(f.name) LIKE '%' || lower(trim(search_query)) || '%' THEN 60
        WHEN NOT EXISTS (
          SELECT 1 FROM query_words qw
          WHERE NOT (lower(f.name) LIKE '%' || qw.word || '%')
        ) THEN 50
        WHEN EXISTS (
          SELECT 1 FROM unnest(f.aliases) AS alias
          WHERE lower(alias) LIKE '%' || lower(trim(search_query)) || '%'
        ) THEN 40
        WHEN NOT EXISTS (
          SELECT 1 FROM query_words qw
          WHERE NOT (
            lower(f.name) LIKE '%' || qw.word || '%'
            OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
          )
        ) THEN 35
        WHEN EXISTS (
          SELECT 1 FROM unnest(f.keywords) AS kw
          WHERE lower(kw) LIKE '%' || lower(trim(search_query)) || '%'
        ) THEN 30
        WHEN NOT EXISTS (
          SELECT 1 FROM query_words qw
          WHERE NOT (
            lower(f.name) LIKE '%' || qw.word || '%'
            OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
            OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE lower(kw) LIKE '%' || qw.word || '%')
          )
        ) THEN 25
        ELSE 0
      END AS rank_score
    FROM public.foods f
    WHERE trim(search_query) = '' OR (
      NOT EXISTS (
        SELECT 1 FROM query_words qw
        WHERE NOT (
          lower(f.name) LIKE '%' || qw.word || '%'
          OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
          OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE lower(kw) LIKE '%' || qw.word || '%')
        )
      )
    )
  )
  SELECT id, name, category, portion_description, portion_grams, potassium_mg, phosphate_mg,
         sodium_mg, protein_g, fluid_ml, dialysis_risk_label, created_at, aliases, keywords
  FROM scored
  WHERE rank_score > 0 OR trim(search_query) = ''
  ORDER BY rank_score DESC, name ASC
  LIMIT page_size
  OFFSET page_offset;
$$;

-- Create function to get recent foods for a user
CREATE OR REPLACE FUNCTION public.get_recent_foods(
  p_user_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (f.id) f.*
  FROM public.food_entries fe
  JOIN public.foods f ON f.id = fe.food_id
  WHERE fe.user_id = p_user_id
    AND fe.food_id IS NOT NULL
  ORDER BY f.id, fe.logged_at DESC
  LIMIT p_limit;
$$;

-- Create function to get most used foods for a user
CREATE OR REPLACE FUNCTION public.get_most_used_foods(
  p_user_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.*
  FROM public.foods f
  JOIN (
    SELECT food_id, COUNT(*) AS use_count
    FROM public.food_entries
    WHERE user_id = p_user_id AND food_id IS NOT NULL
    GROUP BY food_id
    ORDER BY use_count DESC
    LIMIT p_limit
  ) top ON top.food_id = f.id
  ORDER BY top.use_count DESC;
$$;
