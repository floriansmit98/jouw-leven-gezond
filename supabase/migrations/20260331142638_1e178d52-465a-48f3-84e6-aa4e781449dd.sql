
-- Drop dependent function first, then recreate with new return type
DROP FUNCTION IF EXISTS public.search_all_foods(text, integer, integer);
DROP FUNCTION IF EXISTS public.unified_food_search(text, integer, integer);

-- Recreate estimate_nutrients (new function, no drop needed)
CREATE OR REPLACE FUNCTION public.estimate_nutrients(
  p_category text,
  p_display_name text
)
RETURNS TABLE(
  est_potassium_mg numeric,
  est_phosphate_mg numeric,
  est_sodium_mg numeric,
  est_protein_g numeric,
  est_fluid_ml numeric,
  nutrition_source text,
  comparable_count integer
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_subtype_words text[];
  v_base_word text;
BEGIN
  v_subtype_words := string_to_array(lower(trim(p_display_name)), ' ');
  IF array_length(v_subtype_words, 1) > 0 THEN
    v_base_word := v_subtype_words[1];
  ELSE
    v_base_word := '';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.foods f
  WHERE f.category = p_category
    AND lower(COALESCE(f.display_name, f.name)) LIKE '%' || v_base_word || '%'
    AND (f.potassium_mg > 0 OR f.phosphate_mg > 0 OR f.sodium_mg > 0 OR f.protein_g > 0)
    AND COALESCE(f.display_name, f.name) != p_display_name;

  IF v_count >= 3 THEN
    RETURN QUERY
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.potassium_mg)::numeric,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.phosphate_mg)::numeric,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.sodium_mg)::numeric,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.protein_g)::numeric,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY f.fluid_ml)::numeric,
      'estimated'::text,
      v_count
    FROM public.foods f
    WHERE f.category = p_category
      AND lower(COALESCE(f.display_name, f.name)) LIKE '%' || v_base_word || '%'
      AND (f.potassium_mg > 0 OR f.phosphate_mg > 0 OR f.sodium_mg > 0 OR f.protein_g > 0)
      AND COALESCE(f.display_name, f.name) != p_display_name;
  ELSE
    RETURN QUERY SELECT
      NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric,
      'unknown'::text, v_count;
  END IF;
END;
$$;

-- Recreate unified_food_search WITH nutrition_source column
CREATE OR REPLACE FUNCTION public.unified_food_search(search_query text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(result_id uuid, result_type text, display_name text, category text, brand text, food_id uuid, potassium_mg numeric, phosphate_mg numeric, sodium_mg numeric, protein_g numeric, fluid_ml numeric, portion_description text, portion_grams numeric, rank_score integer, nutrition_source text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH query_words AS (
    SELECT unnest(string_to_array(lower(trim(search_query)), ' ')) AS word
    WHERE trim(search_query) != ''
  ),
  word_count AS (
    SELECT count(*)::int AS total_words FROM query_words
  ),
  food_results AS (
    SELECT
      f.id AS result_id, 'food'::text AS result_type,
      COALESCE(f.display_name, f.name) AS display_name, f.category, f.brand,
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
             OR EXISTS (SELECT 1 FROM unnest(f.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%'))
        + CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
            SELECT 1 FROM query_words qw WHERE NOT (
              lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
              OR lower(f.name) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(f.simplified_name,'')) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(f.brand,'')) LIKE '%' || qw.word || '%'
              OR EXISTS (SELECT 1 FROM unnest(f.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
              OR EXISTS (SELECT 1 FROM unnest(f.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%'))
          ) THEN 80 ELSE 0 END
        + COALESCE(f.search_rank, 0)
      )::int AS rank_score,
      CASE
        WHEN f.potassium_mg > 0 OR f.phosphate_mg > 0 OR f.sodium_mg > 0 OR f.protein_g > 0 THEN 'exact'
        ELSE 'needs_estimation'
      END::text AS nutrition_source
    FROM public.foods f
  ),
  meal_results AS (
    SELECT
      cm.id AS result_id, 'meal'::text AS result_type, cm.display_name, cm.category,
      NULL::text AS brand, NULL::uuid AS food_id,
      0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
      ''::text, 0::numeric,
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
             OR EXISTS (SELECT 1 FROM unnest(cm.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%'))
        + CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
            SELECT 1 FROM query_words qw WHERE NOT (
              lower(cm.display_name) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(cm.simplified_name,'')) LIKE '%' || qw.word || '%'
              OR EXISTS (SELECT 1 FROM unnest(cm.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
              OR EXISTS (SELECT 1 FROM unnest(cm.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%'))
          ) THEN 80 ELSE 0 END
      )::int AS rank_score,
      'exact'::text AS nutrition_source
    FROM public.common_meals cm
  ),
  brand_results AS (
    SELECT
      bp.id AS result_id, 'branded_product'::text AS result_type, bp.display_name, bp.category, bp.brand,
      bp.generic_food_id AS food_id,
      COALESCE(gf.potassium_mg, 0), COALESCE(gf.phosphate_mg, 0), COALESCE(gf.sodium_mg, 0),
      COALESCE(gf.protein_g, 0), COALESCE(gf.fluid_ml, 0),
      COALESCE(gf.portion_description, ''), COALESCE(gf.portion_grams, 100),
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
             OR EXISTS (SELECT 1 FROM unnest(bp.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%'))
        + CASE WHEN (SELECT total_words FROM word_count) > 1 AND NOT EXISTS (
            SELECT 1 FROM query_words qw WHERE NOT (
              lower(bp.display_name) LIKE '%' || qw.word || '%'
              OR lower(bp.product_name) LIKE '%' || qw.word || '%'
              OR lower(COALESCE(bp.simplified_name,'')) LIKE '%' || qw.word || '%'
              OR lower(bp.brand) LIKE '%' || qw.word || '%'
              OR EXISTS (SELECT 1 FROM unnest(bp.aliases) a WHERE lower(a) LIKE '%' || qw.word || '%')
              OR EXISTS (SELECT 1 FROM unnest(bp.keywords) k WHERE lower(k) LIKE '%' || qw.word || '%'))
          ) THEN 80 ELSE 0 END
      )::int AS rank_score,
      CASE
        WHEN gf.id IS NOT NULL AND (gf.potassium_mg > 0 OR gf.phosphate_mg > 0 OR gf.sodium_mg > 0 OR gf.protein_g > 0) THEN 'exact'
        ELSE 'needs_estimation'
      END::text AS nutrition_source
    FROM public.branded_products bp
    LEFT JOIN public.foods gf ON gf.id = bp.generic_food_id
  ),
  alias_results AS (
    SELECT
      pa.target_id AS result_id, pa.target_type AS result_type, pa.alias AS display_name,
      ''::text AS category, NULL::text AS brand, NULL::uuid AS food_id,
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
      )::int AS rank_score,
      'unknown'::text AS nutrition_source
    FROM public.product_aliases pa
  ),
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
    r.fluid_ml, r.portion_description, r.portion_grams, r.rank_score,
    r.nutrition_source
  FROM all_results r
  ORDER BY r.result_id, r.result_type, r.rank_score DESC
$function$;

-- Recreate search_all_foods with nutrition_source
CREATE OR REPLACE FUNCTION public.search_all_foods(search_query text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(result_id uuid, result_type text, display_name text, category text, brand text, food_id uuid, potassium_mg numeric, phosphate_mg numeric, sodium_mg numeric, protein_g numeric, fluid_ml numeric, portion_description text, portion_grams numeric, rank_score integer, nutrition_source text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.unified_food_search(search_query)
  ORDER BY rank_score DESC, display_name ASC
  LIMIT page_size
  OFFSET page_offset;
$function$;
