-- Hindi for the admin-editable taxonomy.
--
-- The UI strings live in src/lib/i18n, but categories, cities, localities and the
-- sell-form questions are *rows* — an admin adds "Bicycles" at /admin/taxonomy and no
-- resource file knows about it. So Hindi mode rendered a fully translated sell form
-- whose category chips still read "Gadgets, Furniture, Music" and whose questions still
-- read "Condition", "Brand", "What is included?".
--
-- A `_hi` column per translatable field, with the English as fallback when it's empty.
-- Fallback rather than NOT NULL on purpose: an admin adding a category at 2am shouldn't
-- be blocked on knowing Hindi, and a new row showing English beats a new row showing
-- nothing. The admin console exposes both fields side by side.

alter table public.categories
  add column if not exists name_hi text;

alter table public.cities
  add column if not exists name_hi text;

alter table public.localities
  add column if not exists name_hi text;

alter table public.category_attributes
  add column if not exists label_hi   text,
  add column if not exists hint_hi    text,
  add column if not exists options_hi jsonb not null default '[]'::jsonb,
  -- Options must line up index-for-index with `options` when present, so a select's
  -- stored value stays the English one and only the display changes. Storing the Hindi
  -- string as the value would make `condition = 'Good'` unqueryable in Hindi mode.
  add constraint category_attributes_options_hi_len
    check (jsonb_array_length(options_hi) = 0 or jsonb_array_length(options_hi) = jsonb_array_length(options));

-- ---------------------------------------------------------------------------
-- Hindi for everything 0017 and 0018 shipped.
-- ---------------------------------------------------------------------------
update public.categories set name_hi = v.hi
  from (values
    ('Gadgets', 'गैजेट्स'), ('Furniture', 'फर्नीचर'), ('Music', 'म्यूज़िक'),
    ('Fashion', 'कपड़े'), ('Books', 'किताबें'), ('Everything', 'बाकी सब')
  ) as v(name, hi)
 where categories.name = v.name;

update public.cities set name_hi = v.hi
  from (values
    ('bengaluru', 'बेंगलुरु'), ('mumbai', 'मुंबई'), ('delhi', 'दिल्ली'), ('hyderabad', 'हैदराबाद')
  ) as v(id, hi)
 where cities.id = v.id;

update public.localities set name_hi = v.hi
  from (values
    ('Koramangala', 'कोरमंगला'), ('Bandra', 'बांद्रा'), ('Hitec City', 'हाइटेक सिटी')
  ) as v(name, hi)
 where localities.name = v.name;

update public.category_attributes set label_hi = v.label, hint_hi = v.hint, options_hi = v.opts
  from (values
    (null, 'condition', 'हालत',
      'सच बताइए — खरीदार सामने आकर सबसे पहले यही देखता है।',
      '["नया","नया जैसा","ठीक-ठाक","चलने लायक","मरम्मत चाहिए"]'::jsonb),
    (null, 'reason', 'क्यों बेच रहे हैं?',
      'अपग्रेड कर रहे हैं, शिफ्ट हो रहे हैं, फिट नहीं आया — वजह बताने से कीमत पर भरोसा बनता है।', '[]'::jsonb),
    (null, 'age', 'कितना पुराना है?', 'अंदाज़ा भी चलेगा — जैसे "करीब 2 साल"।', '[]'::jsonb),
    (null, 'includes', 'साथ में क्या मिलेगा?', 'तार, कवर, मैनुअल, अतिरिक्त पुर्ज़े।', '[]'::jsonb),

    ('Gadgets', 'brand', 'ब्रांड', null, '[]'::jsonb),
    ('Gadgets', 'model', 'मॉडल', null, '[]'::jsonb),
    ('Gadgets', 'warranty', 'वारंटी बची है?', null, '["वारंटी में है","खत्म हो गई","पता नहीं"]'::jsonb),
    ('Gadgets', 'bill', 'असली बिल/डिब्बा', null, '["दोनों","सिर्फ़ बिल","सिर्फ़ डिब्बा","कुछ नहीं"]'::jsonb),

    ('Furniture', 'material', 'किस चीज़ का है', 'सागवान, पार्टिकल बोर्ड, लोहा…', '[]'::jsonb),
    ('Furniture', 'dimensions', 'नाप', 'अंदाज़न, इंच या सेंटीमीटर में।', '[]'::jsonb),
    ('Furniture', 'assembly', 'ले जाने के लिए खोलना पड़ेगा?', null,
      '["नहीं","हाँ, मैं मदद कर दूँगा","हाँ, खरीदार खुद देखे"]'::jsonb),

    ('Music', 'brand', 'ब्रांड', null, '[]'::jsonb),
    ('Music', 'accessories', 'साथ में सामान', 'कवर, स्ट्रैप, स्टैंड, तार।', '[]'::jsonb),

    ('Fashion', 'size', 'साइज़', 'S/M/L, या लेबल पर लिखा नंबर।', '[]'::jsonb),
    ('Fashion', 'brand', 'ब्रांड', null, '[]'::jsonb),
    ('Fashion', 'worn', 'कितनी बार पहना', null, '["कभी नहीं","दो-चार बार","अक्सर"]'::jsonb),

    ('Books', 'author', 'लेखक', null, '[]'::jsonb),
    ('Books', 'language', 'भाषा', null, '[]'::jsonb),
    ('Books', 'marks', 'अंदर लिखा हुआ है?', null, '["साफ़ है","थोड़े नोट्स","बहुत कुछ लिखा है"]'::jsonb)
  ) as v(category, key, label, hint, opts)
 where category_attributes.key = v.key
   and category_attributes.category is not distinct from v.category;

-- ---------------------------------------------------------------------------
-- The admin RPCs gain the Hindi arguments. Same audited contract as 0016 — the
-- change and its log row stay in one transaction.
--
-- The old signatures are DROPPED first, and that is not tidiness. `create or replace
-- function` only replaces when the argument list matches exactly; adding
-- `p_name_hi text default null` produces an *overload*, so both versions exist and
-- PostgREST refuses every call with PGRST203 — "could not choose the best candidate
-- function". The RLS suite caught it immediately, which is the whole point of it.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_upsert_category(text, text, integer, boolean, text);
drop function if exists public.admin_upsert_attribute(uuid, text, text, text, text, jsonb, text, boolean, integer, boolean, text);
create or replace function public.admin_upsert_category(
  p_name    text,
  p_icon    text,
  p_sort    integer,
  p_active  boolean,
  p_reason  text,
  p_name_hi text default null
) returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.categories;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'a category needs a name' using errcode = '22023';
  end if;

  select to_jsonb(c) into v_before from public.categories c where c.name = p_name;

  insert into public.categories (name, icon, sort, active, name_hi)
  values (btrim(p_name), p_icon, coalesce(p_sort, 100), coalesce(p_active, true), nullif(btrim(coalesce(p_name_hi, '')), ''))
  on conflict (name) do update
    set icon = excluded.icon, sort = excluded.sort, active = excluded.active,
        name_hi = coalesce(excluded.name_hi, categories.name_hi)
  returning * into v_row;

  perform public.log_admin_action(
    case when v_before is null then 'category.create' else 'category.update' end,
    'categories', v_row.name, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_category(text, text, integer, boolean, text, text) to authenticated;

create or replace function public.admin_upsert_attribute(
  p_id        uuid,
  p_category  text,
  p_key       text,
  p_label     text,
  p_type      text,
  p_options   jsonb,
  p_hint      text,
  p_required  boolean,
  p_sort      integer,
  p_active    boolean,
  p_reason    text,
  p_label_hi  text  default null,
  p_hint_hi   text  default null,
  p_options_hi jsonb default '[]'::jsonb
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
    insert into public.category_attributes
      (category, key, label, type, options, hint, required, sort, active, label_hi, hint_hi, options_hi)
    values (nullif(p_category, ''), p_key, p_label, coalesce(p_type, 'text'),
            coalesce(p_options, '[]'::jsonb), p_hint, coalesce(p_required, false),
            coalesce(p_sort, 100), coalesce(p_active, true),
            nullif(btrim(coalesce(p_label_hi, '')), ''), nullif(btrim(coalesce(p_hint_hi, '')), ''),
            coalesce(p_options_hi, '[]'::jsonb))
    returning * into v_row;
  else
    update public.category_attributes set
      category = nullif(p_category, ''), key = p_key, label = p_label,
      type = coalesce(p_type, 'text'), options = coalesce(p_options, '[]'::jsonb),
      hint = p_hint, required = coalesce(p_required, false),
      sort = coalesce(p_sort, 100), active = coalesce(p_active, true),
      label_hi = nullif(btrim(coalesce(p_label_hi, '')), ''),
      hint_hi = nullif(btrim(coalesce(p_hint_hi, '')), ''),
      options_hi = coalesce(p_options_hi, '[]'::jsonb)
    where id = p_id
    returning * into v_row;
  end if;

  perform public.log_admin_action(
    case when v_before is null then 'attribute.create' else 'attribute.update' end,
    'category_attributes', v_row.id::text, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_attribute(uuid, text, text, text, text, jsonb, text, boolean, integer, boolean, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The cities the hardcoded list had and the table didn't.
--
-- 0017 moved cities into a table but only carried four of them across, and the sheet
-- kept rendering its own array of nine — so the table looked complete while the product
-- still ignored it. Wiring the sheet to the table exposed that as five cities quietly
-- disappearing from the picker. These are the rest, with the locality each of the
-- original strings actually meant.
-- ---------------------------------------------------------------------------
insert into public.cities (id, name, name_hi, state, lat, lng, sort) values
  ('pune',      'Pune',      'पुणे',      'Maharashtra',   18.5204, 73.8567, 50),
  ('chennai',   'Chennai',   'चेन्नई',    'Tamil Nadu',    13.0827, 80.2707, 60),
  ('kolkata',   'Kolkata',   'कोलकाता',   'West Bengal',   22.5726, 88.3639, 70),
  ('ahmedabad', 'Ahmedabad', 'अहमदाबाद',  'Gujarat',       23.0225, 72.5714, 80),
  ('jaipur',    'Jaipur',    'जयपुर',     'Rajasthan',     26.9124, 75.7873, 90)
on conflict (id) do nothing;

insert into public.localities (city_id, name, name_hi, lat, lng, sort) values
  ('delhi',     'Connaught Place', 'कनॉट प्लेस',   28.6315, 77.2167, 10),
  ('pune',      'Koregaon Park',   'कोरेगांव पार्क', 18.5362, 73.8940, 10),
  ('chennai',   'T. Nagar',        'टी. नगर',      13.0418, 80.2341, 10),
  ('kolkata',   'Park Street',     'पार्क स्ट्रीट',  22.5532, 88.3524, 10),
  ('ahmedabad', 'Navrangpura',     'नवरंगपुरा',    23.0366, 72.5608, 10),
  ('jaipur',    'C-Scheme',        'सी-स्कीम',     26.9099, 75.8016, 10)
on conflict (city_id, name) do nothing;
