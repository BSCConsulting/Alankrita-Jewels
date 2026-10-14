-- =============================================================================
-- Alankrita Jewels — auto-cancel unpaid orders after 48 hours
-- Paste into Supabase → SQL Editor and run once. Safe to re-run.
-- Runs every hour; cancelling an order returns its stock (orders_restock_on_cancel).
-- Keep the 48 hours in sync with PAYMENT_RULES.unpaidHoldHours in src/config/site.ts.
-- =============================================================================

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'cancel-stale-orders';

select cron.schedule(
  'cancel-stale-orders',
  '0 * * * *',
  $$select public.cancel_stale_pending_orders(interval '48 hours')$$
);

-- Check it is scheduled:   select jobname, schedule, command from cron.job;
-- Recent runs:             select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
