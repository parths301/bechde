-- Per-category listing attributes.
--
-- The product page has always rendered a grid of CONDITION / DIAMETER / INCLUDES /
-- REASON boxes, but only seeded listings ever had anything real in them: the seed
-- hand-authored `facts` in data.ts, while the sell form wrote the same two invented
-- pairs onto every listing a human posted —
--
--     facts: [{ k: "Condition", v: "As described" },
--             { k: "Reason",    v: "Making space" }]   -- sell/page.tsx:174
--
-- so a buyer read "Condition: As described" as though the seller had typed it. §4.5
-- forbids exactly this. The fix isn't a wider form, it's a *template*: a category
-- declares which attributes it asks for, the sell form renders them, and the product
-- page labels them. Adding a field to Furniture becomes an admin action, not a commit.
--
-- Shape note: attributes are a JSONB map on the listing rather than EAV rows. EAV
-- indexes better and would win at catalogue scale, but every read here already loads
-- the whole listing, and the map keeps `attrs` in the same round trip as the row.

-- ---------------------------------------------------------------------------
-- The templates.
--
-- A null `category` means "every category" — condition and reason-for-selling are
-- questions worth asking about a guitar and a sofa alike, and duplicating them per
-- category is how the two lists in data.ts drifted in the first place.
-- ---------------------------------------------------------------------------
create table if not exists public.category_attributes (
  id       uuid primary key default gen_random_uuid(),
  category text references public.categories(name) on update cascade on delete cascade,
  key      text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label    text not null,
  type     text not null default 'text' check (type in ('text', 'number', 'select', 'boolean')),
  -- Allowed values for `select`. Ignored otherwise.
  options  jsonb not null default '[]'::jsonb,
  hint     text,
  required boolean not null default false,
  sort     integer not null default 100,
  active   boolean not null default true,
  created_at timestamptz not null default now(),
  constraint category_attributes_select_has_options
    check (type <> 'select' or jsonb_array_length(options) > 0)
);

-- A plain unique(category, key) wouldn't constrain the universal rows, because in SQL
-- null is never equal to null and Postgres would happily take 'condition' twice.
create unique index if not exists category_attributes_key_idx
  on public.category_attributes (coalesce(category, '*'), key);

create index if not exists category_attributes_sort_idx
  on public.category_attributes (category, sort);

alter table public.category_attributes enable row level security;

drop policy if exists category_attributes_read on public.category_attributes;
create policy category_attributes_read on public.category_attributes for select using (true);

revoke insert, update, delete on public.category_attributes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The values, as a map on the listing: {"condition": "Good", "reason": "Redecorating"}.
--
-- `facts` is deliberately left in place for now. 0009 dropped four columns while the
-- seed was still writing them and the whole thing failed in silence for a phase (§5),
-- so the writer moves first: this migration only copies the data across. A later
-- migration drops `facts` once nothing writes it.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists attrs jsonb not null default '{}'::jsonb;

update public.listings l
   set attrs = coalesce((
         select jsonb_object_agg(lower(regexp_replace(f->>'k', '[^a-zA-Z0-9]+', '_', 'g')), f->>'v')
           from jsonb_array_elements(l.facts) f
          where f->>'k' is not null and f->>'v' is not null
       ), '{}'::jsonb)
 where jsonb_typeof(l.facts) = 'array'
   and jsonb_array_length(l.facts) > 0
   and l.attrs = '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- The starting templates.
--
-- Condition is a controlled list, not free text — it's the field buyers filter and
-- argue over, and "As described" is not an answer. The five-point scale is the one
-- Facebook Marketplace uses; OLX's three-point new/used/refurbished loses the middle
-- that most second-hand listings actually sit in.
-- ---------------------------------------------------------------------------
insert into public.category_attributes (category, key, label, type, options, hint, required, sort) values
  (null, 'condition', 'Condition', 'select',
   '["New","Like new","Good","Fair","Needs repair"]'::jsonb,
   'Be honest — it is the first thing a buyer checks in person.', true, 10),
  (null, 'reason', 'Why are you selling it?', 'text', '[]'::jsonb,
   'Upgrading, moving, it does not fit — a reason makes people trust the price.', false, 20),
  (null, 'age', 'How old is it?', 'text', '[]'::jsonb, 'Roughly is fine — "about 2 years".', false, 30),
  (null, 'includes', 'What is included?', 'text', '[]'::jsonb, 'Cables, case, manual, spare parts.', false, 40),

  ('Gadgets',   'brand',    'Brand',            'text',   '[]'::jsonb, null, false, 100),
  ('Gadgets',   'model',    'Model',            'text',   '[]'::jsonb, null, false, 110),
  ('Gadgets',   'warranty', 'Warranty left',    'select', '["In warranty","Expired","Not sure"]'::jsonb, null, false, 120),
  ('Gadgets',   'bill',     'Original bill/box','select', '["Both","Bill only","Box only","Neither"]'::jsonb, null, false, 130),

  ('Furniture', 'material',   'Material',   'text', '[]'::jsonb, 'Teak, particle board, metal…', false, 100),
  ('Furniture', 'dimensions', 'Dimensions', 'text', '[]'::jsonb, 'Roughly, in inches or cm.', false, 110),
  ('Furniture', 'assembly',   'Needs dismantling to move?', 'select',
   '["No","Yes, and I will help","Yes, buyer arranges"]'::jsonb, null, false, 120),

  ('Music',     'brand',      'Brand',      'text', '[]'::jsonb, null, false, 100),
  ('Music',     'accessories','Accessories included', 'text', '[]'::jsonb, 'Case, strap, stand, cables.', false, 110),

  ('Fashion',   'size',       'Size',       'text', '[]'::jsonb, 'S/M/L, or the number on the label.', false, 100),
  ('Fashion',   'brand',      'Brand',      'text', '[]'::jsonb, null, false, 110),
  ('Fashion',   'worn',       'How often worn', 'select',
   '["Never","A few times","Regularly"]'::jsonb, null, false, 120),

  ('Books',     'author',     'Author',     'text', '[]'::jsonb, null, false, 100),
  ('Books',     'language',   'Language',   'text', '[]'::jsonb, null, false, 110),
  ('Books',     'marks',      'Markings inside', 'select',
   '["Clean","Some notes","Heavily annotated"]'::jsonb, null, false, 120)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Audited admin writes, same contract as 0016.
-- ---------------------------------------------------------------------------
create or replace function public.admin_upsert_attribute(
  p_id       uuid,
  p_category text,
  p_key      text,
  p_label    text,
  p_type     text,
  p_options  jsonb,
  p_hint     text,
  p_required boolean,
  p_sort     integer,
  p_active   boolean,
  p_reason   text
) returns public.category_attributes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.category_attributes;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select to_jsonb(a) into v_before from public.category_attributes a where a.id = p_id;

  if v_before is null then
    insert into public.category_attributes (category, key, label, type, options, hint, required, sort, active)
    values (nullif(p_category, ''), p_key, p_label, coalesce(p_type, 'text'),
            coalesce(p_options, '[]'::jsonb), p_hint, coalesce(p_required, false),
            coalesce(p_sort, 100), coalesce(p_active, true))
    returning * into v_row;
  else
    update public.category_attributes set
      category = nullif(p_category, ''), key = p_key, label = p_label,
      type = coalesce(p_type, 'text'), options = coalesce(p_options, '[]'::jsonb),
      hint = p_hint, required = coalesce(p_required, false),
      sort = coalesce(p_sort, 100), active = coalesce(p_active, true)
    where id = p_id
    returning * into v_row;
  end if;

  perform public.log_admin_action(
    case when v_before is null then 'attribute.create' else 'attribute.update' end,
    'category_attributes', v_row.id::text, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_attribute(uuid, text, text, text, text, jsonb, text, boolean, integer, boolean, text) to authenticated;

create or replace function public.admin_delete_attribute(
  p_id     uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select to_jsonb(a) into v_before from public.category_attributes a where a.id = p_id;
  if v_before is null then
    raise exception 'no such attribute: %', p_id using errcode = 'P0002';
  end if;

  -- The template goes; values already written onto listings.attrs stay. An attribute
  -- you stop asking about isn't a reason to rewrite what sellers already told buyers.
  delete from public.category_attributes where id = p_id;
  perform public.log_admin_action('attribute.remove', 'category_attributes', p_id::text, v_before, null, p_reason);
end;
$$;

grant execute on function public.admin_delete_attribute(uuid, text) to authenticated;
