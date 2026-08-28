-- Initial Supabase storage for CV Soccer volunteer signups.
-- Run in the Supabase SQL Editor after creating the project.

create table if not exists public.app_state (
  id smallint primary key default 1 check (id = 1),
  events jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, events)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table public.app_state enable row level security;
revoke all on public.app_state from anon, authenticated;

-- Public visitors receive only the name displayed on the page. Email addresses,
-- phone numbers and notes remain private.
create or replace function public.get_public_events()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'events',
    coalesce((
      select jsonb_agg(
        jsonb_set(event_item, '{slots}', coalesce((
          select jsonb_agg(
            jsonb_set(slot_item, '{claimedBy}', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', signup_item->'id',
                'publicName', signup_item->'publicName'
              ))
              from jsonb_array_elements(coalesce(slot_item->'claimedBy', '[]'::jsonb)) signup_item
            ), '[]'::jsonb))
          )
          from jsonb_array_elements(coalesce(event_item->'slots', '[]'::jsonb)) slot_item
        ), '[]'::jsonb))
      )
      from public.app_state state,
        jsonb_array_elements(state.events) event_item
      where state.id = 1
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_events() from public;
grant execute on function public.get_public_events() to anon, authenticated;

-- Lock the single state record while claiming a position so two parents cannot
-- take the final opening simultaneously.
create or replace function public.claim_coach_slot(
  p_event_id text,
  p_slot_id text,
  p_signup jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_events jsonb;
  event_index integer;
  slot_index integer;
  selected_slot jsonb;
  claimed jsonb;
begin
  select events into current_events
  from public.app_state
  where id = 1
  for update;

  select ordinality - 1 into event_index
  from jsonb_array_elements(current_events) with ordinality item(value, ordinality)
  where value->>'id' = p_event_id
  limit 1;

  if event_index is null then
    raise exception 'Coaching group no longer exists';
  end if;

  select ordinality - 1, value into slot_index, selected_slot
  from jsonb_array_elements(current_events->event_index->'slots')
    with ordinality item(value, ordinality)
  where value->>'id' = p_slot_id
  limit 1;

  if slot_index is null then
    raise exception 'Coaching position no longer exists';
  end if;

  claimed := coalesce(selected_slot->'claimedBy', '[]'::jsonb);
  if jsonb_array_length(claimed) >= coalesce((selected_slot->>'count')::integer, 0) then
    raise exception 'This coaching position has just been filled';
  end if;

  current_events := jsonb_set(
    current_events,
    array[event_index::text, 'slots', slot_index::text, 'claimedBy'],
    claimed || jsonb_build_array(p_signup)
  );

  update public.app_state
  set events = current_events, updated_at = now()
  where id = 1;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.claim_coach_slot(text, text, jsonb) from public;
grant execute on function public.claim_coach_slot(text, text, jsonb) to anon, authenticated;

-- Creator functions require a signed-in Supabase user. We will connect the
-- creator page to Supabase Auth before switching away from Google.
create or replace function public.get_admin_events()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('events', events)
  from public.app_state
  where id = 1
    and auth.role() = 'authenticated'
    and lower(auth.jwt()->>'email') = 'scott@cvsoccer.club';
$$;

create or replace function public.save_admin_events(p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated'
     or lower(auth.jwt()->>'email') <> 'scott@cvsoccer.club' then
    raise exception 'Administrator sign-in required';
  end if;

  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'Invalid event data';
  end if;

  update public.app_state
  set events = p_events, updated_at = now()
  where id = 1;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_admin_events() from public;
revoke all on function public.save_admin_events(jsonb) from public;
grant execute on function public.get_admin_events() to authenticated;
grant execute on function public.save_admin_events(jsonb) to authenticated;
