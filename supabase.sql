-- Run this in the Supabase SQL Editor.
-- The anon key can live in the static site because these policies only allow
-- reading the leaderboard and inserting a score. Updates and deletes are not granted.

create table public.daily_scores (
  id bigint generated always as identity primary key,
  username text not null,
  score integer not null,
  date date not null,
  created_at timestamptz not null default now(),
  constraint daily_scores_username_check check (
    username = btrim(username)
    and char_length(username) between 1 and 32
  ),
  constraint daily_scores_score_check check (score between 0 and 300),
  constraint daily_scores_date_username_key unique (date, username)
);

create index daily_scores_date_score_idx
  on public.daily_scores (date, score desc, created_at);

alter table public.daily_scores enable row level security;

grant select, insert on table public.daily_scores to anon, authenticated;
revoke update, delete on table public.daily_scores from anon, authenticated;

create policy "Anyone can read the leaderboard"
  on public.daily_scores
  for select
  to anon, authenticated
  using (true);

create policy "Anyone can insert a score"
  on public.daily_scores
  for insert
  to anon, authenticated
  with check (true);
