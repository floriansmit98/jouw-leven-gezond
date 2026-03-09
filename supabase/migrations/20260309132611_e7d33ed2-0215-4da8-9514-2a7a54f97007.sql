
-- Unified search function that searches across foods, common_meals, branded_products and aliases
CREATE OR REPLACE FUNCTION public.unified_food_search(
  search_query text,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS TABLE (
  result_id uuid,
  result_type text,
  display_name text,
  category text,
  brand text,
  food_id uuid,
  potassium_mg numeric,
  phosphate_mg numeric,
  sodium_mg numeric,
  protein_g numeric,
  fluid_ml numeric,
  portion_description text,
  portion_grams numeric,
  rank_score integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH query_words AS (
    SELECT unnest(string_to_array(lower(trim(search_query)), ' ')) AS word
    WHERE trim(search_query) != ''
  ),
  word_count AS (
    SELECT count(*)::int AS total_words FROM query_words
  ),

  -- Search foods
  food_results AS (
    SELECT
      f.id AS result_id,
      'food'::text AS result_type,
      COALESCE(f.display_name, f.name) AS display_name,
      f.category,
      f.brand,
      f.id AS food_id,
      f.potassium_mg, f.phosphate_mg, f.sodium_mg, f.protein_g, f.fluid_ml,
      f.portion_description, f.portion_grams,
      (
        CASE
          WHEN lower(COALESCE(f.display_name, f.name)) = lower(trim(search_query)) THEN 200
          WHEN lower(f.name) = lower(trim(search_query)) THEN 200
          WHEN lower(COALESCE(f.simplified_name, '')) = lower(trim(search_query)) THEN 195
          WHEN EXISTS (SELECT 1 FROM unnest(f.aliases) a WHERE lower(a) = lower(trim(search_query))) THEN 190
          WHEN lower(COALESCE(f.display_name, f.name)) LIKE lower(trim(search_query)) || '%' THEN 150
          WHEN lower(COALESCE(f.display_name, f.name)) LIKE '%' || lower(trim(search_query)) || '%' THEN 120
          ELSE 0
        END
        + (SELECT COALESCE(count(*),0)::int * 30 FROM query_words qw
           WHERE lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
             OR lower(f.name) LIKE '%' || qw.word || '%'
             OR lower(COALESCE(f.simplified_name,'')) LIKE '%' || qw.word || '%'
             OR lower(COALESCE(f.brand,'')) LIKE '%' || qw.word || '%'
             OR EXISTS (SELECT 1 FROM unnest(f.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
             OR EXISTS (SELECT 1 FROM unnest(f.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%')
          )
        + CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
            SELECT 1 FROM query_words qw WHERE NOT (
              lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
              OR lower(f.name) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(f.simplified_name,'')) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(f.brand,'')) LIKE '%' || qw.word || '%'
              OR EXISTS (SELECT 1 FROM unnest(f.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
              OR EXISTS (SELECT 1 FROM unnest(f.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%')
            )
          ) THEN 80 ELSE 0 END
        + COALESCE(f.search_rank, 0)
      )::int AS rank_score
    FROM public.foods f
  ),

  -- Search common meals
  meal_results AS (
    SELECT
      cm.id AS result_id,
      'meal'::text AS result_type,
      cm.display_name,
      cm.category,
      NULL::text AS brand,
      NULL::uuid AS food_id,
      0::numeric AS potassium_mg, 0::numeric AS phosphate_mg, 0::numeric AS sodium_mg,
      0::numeric AS protein_g, 0::numeric AS fluid_ml,
      ''::text AS portion_description, 0::numeric AS portion_grams,
      (
        CASE
          WHEN lower(cm.display_name) = lower(trim(search_query)) THEN 210
          WHEN lower(COALESCE(cm.simplified_name, '')) = lower(trim(search_query)) THEN 205
          WHEN EXISTS (SELECT 1 FROM unnest(cm.aliases) a WHERE lower(a) = lower(trim(search_query))) THEN 200
          WHEN lower(cm.display_name) LIKE lower(trim(search_query)) || '%' THEN 160
          WHEN lower(cm.display_name) LIKE '%' || lower(trim(search_query)) || '%' THEN 130
          ELSE 0
        END
        + (SELECT COALESCE(count(*),0)::int * 30 FROM query_words qw
           WHERE lower(cm.display_name) LIKE '%' || qw.word || '%'
             OR lower(COALESCE(cm.simplified_name,'')) LIKE '%' || qw.word || '%'
             OR EXISTS (SELECT 1 FROM unnest(cm.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
             OR EXISTS (SELECT 1 FROM unnest(cm.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%')
          )
        + CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
            SELECT 1 FROM query_words qw WHERE NOT (
              lower(cm.display_name) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(cm.simplified_name,'')) LIKE '%' || qw.word || '%'
              OR EXISTS (SELECT 1 FROM unnest(cm.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
              OR EXISTS (SELECT 1 FROM unnest(cm.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%')
            )
          ) THEN 80 ELSE 0 END
      )::int AS rank_score
    FROM public.common_meals cm
  ),

  -- Search branded products
  brand_results AS (
    SELECT
      bp.id AS result_id,
      'branded_product'::text AS result_type,
      bp.display_name,
      bp.category,
      bp.brand,
      bp.generic_food_id AS food_id,
      COALESCE(gf.potassium_mg, 0) AS potassium_mg,
      COALESCE(gf.phosphate_mg, 0) AS phosphate_mg,
      COALESCE(gf.sodium_mg, 0) AS sodium_mg,
      COALESCE(gf.protein_g, 0) AS protein_g,
      COALESCE(gf.fluid_ml, 0) AS fluid_ml,
      COALESCE(gf.portion_description, '') AS portion_description,
      COALESCE(gf.portion_grams, 100) AS portion_grams,
      (
        CASE
          WHEN lower(bp.display_name) = lower(trim(search_query)) THEN 210
          WHEN lower(bp.product_name) = lower(trim(search_query)) THEN 205
          WHEN lower(COALESCE(bp.simplified_name, '')) = lower(trim(search_query)) THEN 200
          WHEN lower(bp.brand) = lower(trim(search_query)) THEN 100
          WHEN EXISTS (SELECT 1 FROM unnest(bp.aliases) a WHERE lower(a) = lower(trim(search_query))) THEN 195
          WHEN lower(bp.display_name) LIKE lower(trim(search_query)) || '%' THEN 160
          WHEN lower(bp.display_name) LIKE '%' || lower(trim(search_query)) || '%' THEN 130
          ELSE 0
        END
        + (SELECT COALESCE(count(*),0)::int * 30 FROM query_words qw
           WHERE lower(bp.display_name) LIKE '%' || qw.word || '%'
             OR lower(bp.product_name) LIKE '%' || qw.word || '%'
             OR lower(COALESCE(bp.simplified_name,'')) LIKE '%' || qw.word || '%'
             OR lower(bp.brand) LIKE '%' || qw.word || '%'
             OR EXISTS (SELECT 1 FROM unnest(bp.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
             OR EXISTS (SELECT 1 FROM unnest(bp.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%')
          )
        + CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
            SELECT 1 FROM query_words qw WHERE NOT (
              lower(bp.display_name) LIKE '%' || qw.word || '%'
              OR lower(bp.product_name) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(bp.simplified_name,'')) LIKE '%' || qw.word || '%'
              OR lower(bp.brand) LIKE '%' || qw.word || '%'
              OR EXISTS (SELECT 1 FROM unnest(bp.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
              OR EXISTS (SELECT 1 FROM unnest(bp.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%')
            )
          ) THEN 80 ELSE 0 END
      )::int AS rank_score
    FROM public.branded_products bp
    LEFT JOIN public.foods gf ON gf.id = bp.generic_food_id
  ),

  -- Search product_aliases
  alias_results AS (
    SELECT
      pa.target_id AS result_id,
      pa.target_type AS result_type,
      pa.alias AS display_name,
      ''::text AS category,
      NULL::text AS brand,
      NULL::uuid AS food_id,
      0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
      ''::text, 0::numeric,
      (
        CASE
          WHEN lower(pa.normalized_alias) = lower(trim(search_query)) THEN 195
          WHEN lower(pa.normalized_alias) LIKE lower(trim(search_query)) || '%' THEN 140
          WHEN lower(pa.normalized_alias) LIKE '%' || lower(trim(search_query)) || '%' THEN 110
          ELSE 0
        END
        + (SELECT COALESCE(count(*),0)::int * 25 FROM query_words qw
           WHERE lower(pa.normalized_alias) LIKE '%' || qw.word || '%')
      )::int AS rank_score
    FROM public.product_aliases pa
  ),

  -- Union all results
  all_results AS (
    SELECT * FROM food_results WHERE rank_score > 0
    UNION ALL
    SELECT * FROM meal_results WHERE rank_score > 0
    UNION ALL
    SELECT * FROM brand_results WHERE rank_score > 0
    UNION ALL
    SELECT * FROM alias_results WHERE rank_score > 0
  )

  SELECT DISTINCT ON (r.result_id, r.result_type)
    r.result_id, r.result_type, r.display_name, r.category, r.brand,
    r.food_id, r.potassium_mg, r.phosphate_mg, r.sodium_mg, r.protein_g,
    r.fluid_ml, r.portion_description, r.portion_grams, r.rank_score
  FROM all_results r
  ORDER BY r.result_id, r.result_type, r.rank_score DESC
$$;

-- Wrapper to get final sorted results  
CREATE OR REPLACE FUNCTION public.search_all_foods(
  search_query text,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS TABLE (
  result_id uuid,
  result_type text,
  display_name text,
  category text,
  brand text,
  food_id uuid,
  potassium_mg numeric,
  phosphate_mg numeric,
  sodium_mg numeric,
  protein_g numeric,
  fluid_ml numeric,
  portion_description text,
  portion_grams numeric,
  rank_score integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT * FROM public.unified_food_search(search_query)
  ORDER BY rank_score DESC, display_name ASC
  LIMIT page_size
  OFFSET page_offset;
$$;
