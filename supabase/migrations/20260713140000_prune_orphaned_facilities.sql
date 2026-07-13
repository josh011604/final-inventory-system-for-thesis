-- Remove facilities left without a department by the 20260713130000
-- department reconfiguration. Every facility seeded for an in-scope department
-- has a department_id, so a null department_id marks an orphan from a removed
-- department. On a fresh database this runs before any facilities exist and is
-- a harmless no-op.

delete from public.facilities
where department_id is null;
