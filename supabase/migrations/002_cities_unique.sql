-- ניקוי כפילויות בערים ומניעתן
delete from cities a using cities b where a.name = b.name and a.id > b.id;
create unique index if not exists cities_name_uq on cities (name);
