-- Márgenes de la hoja por tablilla, en centímetros. Por defecto 2.54 cm (1 in), como antes.
alter table public.tablets
  add column margins jsonb not null
    default '{"top": 2.54, "right": 2.54, "bottom": 2.54, "left": 2.54}'::jsonb
    check (jsonb_typeof(margins) = 'object');
