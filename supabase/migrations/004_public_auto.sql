-- דירוג איכות, קישורים אישיים, הצעות אוטומטיות ומניעת ספאם בדפים ציבוריים
alter table professionals add column if not exists rating numeric default 3, add column if not exists public_token text;
alter table requests add column if not exists public_token text;
alter table offers add column if not exists score numeric, add column if not exists auto boolean default false;
create unique index if not exists professionals_token_uq on professionals(public_token);
create unique index if not exists requests_token_uq on requests(public_token);
create table if not exists public_hits (id uuid primary key default gen_random_uuid(), ip text, kind text, created_at timestamptz default now());
create index if not exists public_hits_ip on public_hits(ip, created_at);
alter table public_hits enable row level security;
