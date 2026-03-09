-- Add aliases and keywords for katjang pedis / pittige pinda's
UPDATE public.foods
SET aliases = array_cat(COALESCE(aliases, '{}'), ARRAY[
  'katjang pedis', 'katjang pedas', 'pittige pinda''s', 'spicy peanuts',
  'pinda''s met pittig jasje', 'pinda''s pikant', 'katjang', 'hot peanuts',
  'borrelpinda''s pittig', 'sambal pinda''s'
]),
keywords = array_cat(COALESCE(keywords, '{}'), ARRAY[
  'katjang', 'pedis', 'pedas', 'pittig', 'spicy', 'pikant', 'pinda', 'snack', 'borrel'
])
WHERE id = 'b4e4ac2b-1fe6-4af6-ba2f-81ce05dc8ee3';

-- Ongezouten pinda's
UPDATE public.foods
SET aliases = array_cat(COALESCE(aliases, '{}'), ARRAY[
  'ongezouten pinda''s', 'naturel pinda''s', 'blanke pinda''s'
]),
keywords = array_cat(COALESCE(keywords, '{}'), ARRAY['pinda', 'noten', 'snack', 'borrel'])
WHERE id = 'acd6d17a-a61a-4cb8-ba63-71d81facb6b5';

-- Japanse mix met pinda's
UPDATE public.foods
SET aliases = array_cat(COALESCE(aliases, '{}'), ARRAY[
  'japanse mix', 'rijstcrackers met pinda''s', 'oriental mix'
]),
keywords = array_cat(COALESCE(keywords, '{}'), ARRAY['japans', 'mix', 'snack', 'borrel', 'rijst'])
WHERE id = '83a48da3-fe87-444a-8236-a27e4c13909d';

-- Pindakaas
UPDATE public.foods
SET aliases = array_cat(COALESCE(aliases, '{}'), ARRAY[
  'peanut butter', 'pindapasta'
]),
keywords = array_cat(COALESCE(keywords, '{}'), ARRAY['pinda', 'pasta', 'broodbeleg', 'spread'])
WHERE id = '094bb797-a792-4239-8c4d-19256c50379c';

-- Suikerpinda's
UPDATE public.foods
SET aliases = array_cat(COALESCE(aliases, '{}'), ARRAY[
  'gesuikerde pinda''s', 'candy coated peanuts', 'zoete pinda''s'
]),
keywords = array_cat(COALESCE(keywords, '{}'), ARRAY['suiker', 'zoet', 'snack', 'pinda'])
WHERE id = '9e9737ad-7f67-49f4-b642-65c15405181b';