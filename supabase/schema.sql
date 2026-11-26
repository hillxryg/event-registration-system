-- 1. Events Table (Enables multi-event reuse)
create table public.events (
    id uuid primary key default gen_random_uuid (),
    slug text unique not null,
    title text not null,
    description text,
    event_date timestamptz not null,
    venue text not null,
    scanner_pin text not null default '1234',
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- 2. Attendees Table
create table public.attendees (
    id uuid primary key default gen_random_uuid (),
    event_id uuid not null references public.events (id) on delete cascade,
    ticket_code text unique not null,
    full_name text not null,
    email text not null,
    organization text not null,
    contact_number text not null,
    checked_in boolean not null default false,
    checked_in_at timestamptz,
    created_at timestamptz not null default now(),
    constraint unique_event_email unique (event_id, email)
);

-- Indexes for fast scanner lookups & admin filtering
create index idx_attendees_ticket_code on public.attendees (ticket_code);

create index idx_attendees_event_id on public.attendees (event_id);

-- 3. Enable RLS
alter table public.events enable row level security;

alter table public.attendees enable row level security;

-- Public can view active events
create policy "Public read active events" on public.events for
select using (is_active = true);

-- Admins (authenticated) have full access to events
create policy "Authenticated full access events" on public.events for all using (
    auth.role () = 'authenticated'
);

-- Public can register (insert) into active events
create policy "Public insert attendee" on public.attendees for
insert
with
    check (
        exists (
            select 1
            from public.events
            where
                id = event_id
                and is_active = true
        )
    );

-- Authenticated admins have full access to attendees
create policy "Authenticated full access attendees" on public.attendees for all using (
    auth.role () = 'authenticated'
);

-- 4. Secure RPC Function for Gate Staff Scanner (No admin login required, PIN-verified)
create or replace function public.verify_and_checkin(
  p_event_id uuid,
  p_ticket_code text,
  p_scanner_pin text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_valid_pin boolean;
  v_attendee record;
begin
  select exists(
    select 1 from public.events
    where id = p_event_id and scanner_pin = p_scanner_pin and is_active = true
  ) into v_valid_pin;

  if not v_valid_pin then
    return jsonb_build_object('status', 'unauthorized', 'message', 'Invalid Scanner PIN');
  end if;

  select * into v_attendee
  from public.attendees
  where event_id = p_event_id and ticket_code = p_ticket_code;

  if not found then
    return jsonb_build_object('status', 'invalid', 'message', 'Ticket not found for this event');
  end if;

  if v_attendee.checked_in then
    return jsonb_build_object(
      'status', 'already_checked_in',
      'checked_in_at', v_attendee.checked_in_at,
      'attendee', row_to_json(v_attendee)
    );
  end if;

  update public.attendees
  set checked_in = true, checked_in_at = now()
  where id = v_attendee.id
  returning * into v_attendee;

  return jsonb_build_object(
    'status', 'valid',
    'attendee', row_to_json(v_attendee)
  );
end;
$$;