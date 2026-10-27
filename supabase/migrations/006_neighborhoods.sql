-- מאגר שכונות לפי עיר (השלמה אוטומטית בטפסים)
create table if not exists neighborhoods (
  id serial primary key,
  city text not null,
  name text not null,
  approved boolean default true,
  created_at timestamptz default now(),
  unique (city, name)
);
alter table neighborhoods enable row level security;
