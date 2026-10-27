-- אזור שירות וערים נוספות לבעל מקצוע
alter table professionals add column if not exists extra_cities jsonb default '[]', add column if not exists region text;
