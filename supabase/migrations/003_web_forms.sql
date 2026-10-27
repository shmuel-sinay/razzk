-- שדות טקסט למילוי דרך האתר (בנוסף להקלטות מהטלפון)
alter table professionals add column if not exists neighborhood text, add column if not exists bio text, add column if not exists notes text;
alter table requests add column if not exists neighborhood text, add column if not exists street text, add column if not exists notes text;
alter table offers add column if not exists note text, add column if not exists source text default 'phone';
