
-- Improved search function with better multi-word ranking
CREATE OR REPLACE FUNCTION public.search_foods_ranked(search_query text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH query_words AS (
    SELECT unnest(string_to_array(lower(trim(search_query)), ' ')) AS word
    WHERE trim(search_query) != ''
  ),
  word_count AS (
    SELECT count(*) AS total_words FROM query_words
  ),
  scored AS (
    SELECT f.*,
      CASE
        WHEN lower(COALESCE(f.display_name, f.name)) = lower(trim(search_query)) THEN 200
        WHEN lower(f.name) = lower(trim(search_query)) THEN 200
        WHEN lower(COALESCE(f.simplified_name, '')) = lower(trim(search_query)) THEN 195
        WHEN EXISTS (
          SELECT 1 FROM unnest(f.aliases) AS alias
          WHERE lower(alias) = lower(trim(search_query))
        ) THEN 190
        WHEN lower(COALESCE(f.display_name, f.name)) LIKE lower(trim(search_query)) || '%' THEN 150
        WHEN lower(f.name) LIKE lower(trim(search_query)) || '%' THEN 150
        WHEN lower(COALESCE(f.display_name, f.name)) LIKE '%' || lower(trim(search_query)) || '%' THEN 120
        WHEN lower(f.name) LIKE '%' || lower(trim(search_query)) || '%' THEN 120
        WHEN lower(COALESCE(f.brand, '')) = lower(trim(search_query)) THEN 110
        ELSE 0
      END
      +
      (
        SELECT COALESCE(count(*), 0) * 30
        FROM query_words qw
        WHERE lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
          OR lower(f.name) LIKE '%' || qw.word || '%'
          OR lower(COALESCE(f.simplified_name, '')) LIKE '%' || qw.word || '%'
          OR lower(COALESCE(f.brand, '')) LIKE '%' || qw.word || '%'
          OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
          OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE lower(kw) LIKE '%' || qw.word || '%')
      )
      +
      CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
        SELECT 1 FROM query_words qw
        WHERE NOT (
          lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
          OR lower(f.name) LIKE '%' || qw.word || '%'
          OR lower(COALESCE(f.simplified_name, '')) LIKE '%' || qw.word || '%'
          OR lower(COALESCE(f.brand, '')) LIKE '%' || qw.word || '%'
          OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
          OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE lower(kw) LIKE '%' || qw.word || '%')
        )
      ) THEN 80 ELSE 0 END
      AS rank_score
    FROM public.foods f
  )
  SELECT id, name, category, portion_description, portion_grams, potassium_mg, phosphate_mg,
         sodium_mg, protein_g, fluid_ml, dialysis_risk_label, created_at, aliases, keywords, display_name, brand, simplified_name
  FROM scored
  WHERE rank_score > 0
  ORDER BY rank_score DESC, COALESCE(display_name, name) ASC
  LIMIT page_size
  OFFSET page_offset;
$$;

-- Update search_foods_by_type
CREATE OR REPLACE FUNCTION public.search_foods_by_type(search_query text, is_drink boolean DEFAULT false, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT f.*
  FROM public.foods f
  WHERE (
    CASE WHEN is_drink THEN
      f.category IN ('dranken', 'alcohol', 'soepen')
    ELSE
      f.category NOT IN ('dranken', 'alcohol', 'soepen')
    END
  )
  AND (
    search_query = '' OR
    NOT EXISTS (
      SELECT 1 FROM unnest(string_to_array(trim(search_query), ' ')) AS word
      WHERE word != ''
        AND NOT (
          COALESCE(f.display_name, f.name) ILIKE '%' || word || '%'
          OR f.name ILIKE '%' || word || '%'
          OR COALESCE(f.simplified_name, '') ILIKE '%' || word || '%'
          OR COALESCE(f.brand, '') ILIKE '%' || word || '%'
          OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE alias ILIKE '%' || word || '%')
          OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE kw ILIKE '%' || word || '%')
        )
    )
  )
  ORDER BY f.name
  LIMIT page_size
  OFFSET page_offset;
$$;

-- Update search_foods
CREATE OR REPLACE FUNCTION public.search_foods(search_query text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT f.*
  FROM public.foods f
  WHERE (
    search_query = '' OR
    NOT EXISTS (
      SELECT 1 FROM unnest(string_to_array(trim(search_query), ' ')) AS word
      WHERE word != ''
        AND NOT (
          COALESCE(f.display_name, f.name) ILIKE '%' || word || '%'
          OR f.name ILIKE '%' || word || '%'
          OR COALESCE(f.simplified_name, '') ILIKE '%' || word || '%'
          OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE alias ILIKE '%' || word || '%')
        )
    )
  )
  ORDER BY f.name
  LIMIT page_size
  OFFSET page_offset;
$$;
