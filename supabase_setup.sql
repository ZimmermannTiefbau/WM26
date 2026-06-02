-- Zimmermann Tiefbau WM Tippspiel 2026
-- Supabase SQL Editor öffnen, alles einfügen, Run drücken.

drop table if exists actual_specials cascade;
drop table if exists champion_tips cascade;
drop table if exists group_winner_tips cascade;
drop table if exists match_tips cascade;
drop table if exists matches cascade;
drop table if exists teams cascade;
drop table if exists groups cascade;
drop table if exists players cascade;

create table players (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz default now()
);

create table groups (
  name text primary key
);

create table teams (
  name text primary key,
  group_name text references groups(name)
);

create table matches (
  id text primary key,
  sort_order int not null,
  group_name text not null references groups(name),
  match_date text,
  match_time text,
  home text not null,
  away text not null,
  result_home int,
  result_away int
);

create table match_tips (
  player_id uuid references players(id) on delete cascade,
  match_id text references matches(id) on delete cascade,
  tip_home int not null,
  tip_away int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (player_id, match_id)
);

create table champion_tips (
  player_id uuid primary key references players(id) on delete cascade,
  champion text not null references teams(name),
  created_at timestamptz default now()
);

create table group_winner_tips (
  player_id uuid references players(id) on delete cascade,
  group_name text references groups(name),
  team text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (player_id, group_name)
);

create table actual_specials (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table players enable row level security;
alter table groups enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table match_tips enable row level security;
alter table champion_tips enable row level security;
alter table group_winner_tips enable row level security;
alter table actual_specials enable row level security;

-- Für eine kleine private Runde: öffentlicher Lese-/Schreibzugriff über anon key.
-- Sicherheit läuft hier bewusst über nicht öffentliche URL + Teilnehmercodes.
create policy "allow all players" on players for all using (true) with check (true);
create policy "allow all groups" on groups for all using (true) with check (true);
create policy "allow all teams" on teams for all using (true) with check (true);
create policy "allow all matches" on matches for all using (true) with check (true);
create policy "allow all match_tips" on match_tips for all using (true) with check (true);
create policy "allow all champion_tips" on champion_tips for all using (true) with check (true);
create policy "allow all group_winner_tips" on group_winner_tips for all using (true) with check (true);
create policy "allow all actual_specials" on actual_specials for all using (true) with check (true);

insert into players (code, name) values
('TOBIAS', 'Tobias'),
('ROLAND', 'Roland'),
('BENNI', 'Benni');

insert into groups (name) values
('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H'), ('I'), ('J'), ('K'), ('L');

insert into teams (name, group_name) values
('Mexiko','A'), ('Südafrika','A'), ('Südkorea','A'), ('Playoff A','A'),
('Kanada','B'), ('Schweiz','B'), ('Katar','B'), ('Playoff B','B'),
('Brasilien','C'), ('Marokko','C'), ('Schottland','C'), ('Haiti','C'),
('USA','D'), ('Türkei','D'), ('Australien','D'), ('Playoff D','D'),
('Deutschland','E'), ('Elfenbeinküste','E'), ('Ecuador','E'), ('Curaçao','E'),
('Niederlande','F'), ('Japan','F'), ('Tunesien','F'), ('Playoff F','F'),
('Belgien','G'), ('Ägypten','G'), ('Iran','G'), ('Neuseeland','G'),
('Spanien','H'), ('Uruguay','H'), ('Saudi-Arabien','H'), ('Kap Verde','H'),
('Frankreich','I'), ('Norwegen','I'), ('Senegal','I'), ('Playoff I','I'),
('Argentinien','J'), ('Österreich','J'), ('Algerien','J'), ('Jordanien','J'),
('Portugal','K'), ('Kolumbien','K'), ('Usbekistan','K'), ('Playoff K','K'),
('England','L'), ('Kroatien','L'), ('Ghana','L'), ('Panama','L');

-- Beispiel-Spiele. Die komplette echte WM-Liste können wir später einfügen/ersetzen.
insert into matches (id, sort_order, group_name, match_date, match_time, home, away) values
('M01', 1, 'A', '11.06.2026', '21:00', 'Mexiko', 'Südafrika'),
('M02', 2, 'B', '12.06.2026', '21:00', 'Kanada', 'Playoff B'),
('M03', 3, 'D', '13.06.2026', '00:00', 'USA', 'Playoff D'),
('M04', 4, 'C', '13.06.2026', '18:00', 'Brasilien', 'Marokko'),
('M05', 5, 'E', '14.06.2026', '18:00', 'Deutschland', 'Curaçao'),
('M06', 6, 'H', '15.06.2026', '21:00', 'Spanien', 'Kap Verde'),
('M07', 7, 'I', '16.06.2026', '21:00', 'Frankreich', 'Senegal'),
('M08', 8, 'L', '17.06.2026', '21:00', 'England', 'Kroatien'),
('M09', 9, 'A', '18.06.2026', '21:00', 'Mexiko', 'Südkorea'),
('M10', 10, 'E', '20.06.2026', '21:00', 'Deutschland', 'Elfenbeinküste'),
('M11', 11, 'J', '22.06.2026', '21:00', 'Argentinien', 'Österreich'),
('M12', 12, 'H', '26.06.2026', '21:00', 'Spanien', 'Uruguay'),
('M13', 13, 'I', '26.06.2026', '21:00', 'Frankreich', 'Norwegen'),
('M14', 14, 'K', '27.06.2026', '21:00', 'Portugal', 'Kolumbien');

insert into actual_specials (key, value) values
('champion', '""'::jsonb),
('group_winners', '{}'::jsonb);
