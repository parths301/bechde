-- P1-2: Saved-search notifications

alter table public.saved_searches
  add column if not exists last_notified_at timestamptz;

-- Note: In production, enable pg_cron and pg_net to schedule the Edge Function.
-- Example pg_cron setup for production (commented out to avoid local errors if extensions are disabled):
/*
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'notify-saved-searches-hourly',
  '0 * * * *', -- Every hour
  $$
    select net.http_post(
      url:='https://your-project.supabase.co/functions/v1/notify-saved-searches',
      headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    );
  $$
);
*/
