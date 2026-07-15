-- Reconfigure departments to the five BISU Calape units in scope.
--
-- Removes the original seed departments and upserts the target five. Equipment,
-- facilities, and records that pointed at a removed department are NOT deleted —
-- the existing foreign keys set their department_id to null (notifications
-- cascade). Account membership is rebuilt separately by the seeding scripts.

delete from public.departments
where name not in (
  'Bachelor of Science in Computer Science (BSCS)',
  'Bachelor of Science in Industrial Technology, major in Electricity',
  'Bachelor of Science in Fisheries, major in Inland Fisheries',
  'College of Teacher Education',
  'Midwifery'
);

insert into public.departments (name, short_name, programs)
values
  ('Bachelor of Science in Computer Science (BSCS)', 'BSCS', array['BS Computer Science']),
  ('Bachelor of Science in Industrial Technology, major in Electricity', 'BSIT - Electricity', array['BSIT major in Electricity']),
  ('Bachelor of Science in Fisheries, major in Inland Fisheries', 'BS Fisheries - Inland', array['BS Fisheries major in Inland Fisheries']),
  ('College of Teacher Education', 'CTE', array['BEEd', 'BSEd']),
  ('Midwifery', 'Midwifery', array['Diploma in Midwifery'])
on conflict (name) do update set short_name = excluded.short_name, programs = excluded.programs;
