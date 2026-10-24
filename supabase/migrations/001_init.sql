-- מערכת תיווך: סכמת מסד נתונים
create table if not exists settings (key text primary key, value text not null);

create table if not exists cities (
  id serial primary key,
  name text not null,
  normalized text not null
);
create index if not exists cities_norm on cities (normalized);

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  role text not null check (role in ('organist','organist_singer','singer')),
  name text, age int,
  city_id int, city_name text,
  neighborhood_audio text,
  style text check (style in ('hasidic','mizrahi','both')),
  days jsonb default '[]', hours jsonb default '[]',
  bio_audio text,
  has_pa boolean default false,
  min_price int default 0,
  contact_phones jsonb default '[]',
  email_recording text,
  tzintuk_ok boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  tzintuk_ok boolean default false,
  created_at timestamptz default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  client_phone text not null,
  client_name text,
  need text not null check (need in ('organist','organist_singer')),
  city_id int, city_name text,
  neighborhood_audio text, street_audio text, building text,
  hall_name text,
  style text,
  event_date date, start_time text, end_time text,
  has_pa boolean default false,
  max_organist int, max_singer int,
  allow_over boolean default false,
  contact_phones jsonb default '[]',
  tzintuk_ok boolean default false,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) on delete cascade,
  pro_id uuid references professionals(id) on delete cascade,
  amount int not null,
  message_audio text,
  status text default 'sent',   -- sent | accepted
  fee_client int default 0, fee_pro int default 0,
  created_at timestamptz default now()
);

create table if not exists intro_seen (phone text, kind text, primary key (phone, kind));

create table if not exists admin_messages (
  id uuid primary key default gen_random_uuid(),
  phone text, audio text, handled boolean default false,
  created_at timestamptz default now()
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  phone text, code text unique not null,
  bank text, branch text, account text,
  note text, active boolean default true,
  created_at timestamptz default now()
);

create table if not exists sessions (
  call_id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table settings enable row level security;
alter table cities enable row level security;
alter table professionals enable row level security;
alter table clients enable row level security;
alter table requests enable row level security;
alter table offers enable row level security;
alter table intro_seen enable row level security;
alter table admin_messages enable row level security;
alter table partners enable row level security;
alter table sessions enable row level security;
-- בלי מדיניות: רק השרת (מפתח service) ניגש לנתונים.

-- ערים עיקריות כגיבוי עד לסנכרון המלא ממאגר הערים הממשלתי (מתוך אתר הניהול)
insert into cities (name, normalized) values
 ('ירושלים','ירושלים'),('בני ברק','בניברק'),('בית שמש','ביתשמש'),('אלעד','אלעד'),
 ('מודיעין עילית','מודיעיןעילית'),('ביתר עילית','ביתרעילית'),('אשדוד','אשדוד'),('פתח תקווה','פתחתקוה'),
 ('רחובות','רחובות'),('נתניה','נתניה'),('חיפה','חיפה'),('תל אביב יפו','תלאביביפו'),
 ('צפת','צפת'),('טבריה','טבריה'),('קריית גת','קריתגת'),('אופקים','אופקים'),
 ('נתיבות','נתיבות'),('טבריה','טבריה'),('רמת גן','רמתגן'),('בת ים','בתים'),
 ('חולון','חולון'),('ראשון לציון','ראשוןלציון'),('באר שבע','בארשבע'),('אשקלון','אשקלון'),
 ('לוד','לוד'),('רמלה','רמלה'),('כפר חב"ד','כפרחבד'),('קריית מלאכי','קריתמלאכי'),
 ('עמנואל','עמנואל'),('טלז סטון','טלזסטון'),('הר נוף','הרנוף'),('מודיעין מכבים רעות','מודיעיןמכביםרעות')
on conflict do nothing;
