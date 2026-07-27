export type GeographicCoverageType =
  | 'local'
  | 'regional'
  | 'state'
  | 'national'
  | 'international';

export const geographicCoverageLabels: Record<GeographicCoverageType, string> = {
  local: 'Local',
  regional: 'Regional',
  state: 'Todo o estado',
  national: 'Todo o Brasil',
  international: 'Internacional',
};

export const geographicCoverageOptions: { value: GeographicCoverageType; label: string }[] = 
  (Object.keys(geographicCoverageLabels) as GeographicCoverageType[]).map(key => ({
    value: key,
    label: geographicCoverageLabels[key],
  }));
