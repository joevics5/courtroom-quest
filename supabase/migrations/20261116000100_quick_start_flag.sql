-- Quick Start: short, easy starter cases shown from the home screen's PLAY popup.
alter table public.cases add column if not exists quick_start boolean not null default false;
comment on column public.cases.quick_start is 'Shown in the home-screen Quick Start list: short, easy starter cases for new players.';

update public.cases set quick_start = true where id in (
  'e0000000-0000-4000-8000-000000000039', -- The Parking Spot
  'e0000000-0000-4000-8000-000000000031', -- Broke Best Friend
  'e0000000-0000-4000-8000-000000000037', -- The Playlist Plagiarist
  'e0000000-0000-4000-8000-000000000033', -- Cancel Contract
  'e0000000-0000-4000-8000-000000000028', -- The Group Chat Leak
  'e0000000-0000-4000-8000-000000000036', -- The Office Lunch Thief
  'f0000000-0000-4000-8000-0000000000a8', -- The Wedding Cancellation
  'e0000000-0000-4000-8000-000000000001'  -- The Stolen E-Bike
);
