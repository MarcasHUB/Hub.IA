BEGIN;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS geographic_coverage_type VARCHAR(30);

ALTER TABLE public.organizations
DROP CONSTRAINT IF EXISTS chk_geographic_coverage_type;

ALTER TABLE public.organizations
ADD CONSTRAINT chk_geographic_coverage_type
CHECK (
  geographic_coverage_type IS NULL
  OR geographic_coverage_type IN (
    'local',
    'regional',
    'state',
    'national',
    'international'
  )
);

UPDATE public.organizations
SET geographic_coverage_type = 'regional'
WHERE raio_atendimento_km IS NOT NULL
  AND geographic_coverage_type IS NULL;

COMMENT ON COLUMN public.organizations.geographic_coverage_type IS
'Tipo de cobertura geográfica: local, regional, state, national ou international.';

NOTIFY pgrst, 'reload schema';

COMMIT;
