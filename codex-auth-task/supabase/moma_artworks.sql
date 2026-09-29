-- MoMA collection sample table
-- Run in Supabase: SQL Editor -> New query -> paste -> Run

-- 1. Create the table
create table public.artworks (
  id                 bigint primary key generated always as identity,
  title              text not null,
  artist             text not null,
  artist_nationality text not null,
  date_display       text not null,   -- the date as MoMA labels it, e.g. '1914–26'
  year               integer not null, -- start year, used for sorting
  medium             text not null,
  created_at         timestamptz not null default now()
);

-- 2. Seed it with works from MoMA's collection
insert into public.artworks (title, artist, artist_nationality, date_display, year, medium) values
  ('The Starry Night',          'Vincent van Gogh', 'Dutch',    '1889',    1889, 'Oil on canvas'),
  ('The Sleeping Gypsy',        'Henri Rousseau',   'French',   '1897',    1897, 'Oil on canvas'),
  ('Les Demoiselles d''Avignon', 'Pablo Picasso',    'Spanish',  '1907',    1907, 'Oil on canvas'),
  ('Dance (I)',                 'Henri Matisse',    'French',   '1909',    1909, 'Oil on canvas'),
  ('Water Lilies',              'Claude Monet',     'French',   '1914–26', 1914, 'Oil on canvas, three panels'),
  ('The Persistence of Memory', 'Salvador Dalí',    'Spanish',  '1931',    1931, 'Oil on canvas'),
  ('Broadway Boogie Woogie',    'Piet Mondrian',    'Dutch',    '1942–43', 1942, 'Oil on canvas'),
  ('Christina''s World',        'Andrew Wyeth',     'American', '1948',    1948, 'Tempera on panel'),
  ('One: Number 31, 1950',      'Jackson Pollock',  'American', '1950',    1950, 'Oil and enamel paint on canvas'),
  ('Campbell''s Soup Cans',     'Andy Warhol',      'American', '1962',    1962, 'Synthetic polymer paint on thirty-two canvases');

-- 3. Let the public (anon) role read the table, and nothing else
grant select on public.artworks to anon;

alter table public.artworks enable row level security;

create policy "public can read artworks"
  on public.artworks
  for select to anon
  using (true);
