import React from 'react';
import { GeographicCoverageType } from '../../domain/types/GeographicCoverageType';
import { geographicCoverageLabels } from '../../domain/types/GeographicCoverageType';
import { Badge } from '../../../../shared/components/ui/Badge';

export interface GeographicCoverageTypeBadgeProps {
  value: GeographicCoverageType | null;
}

export function GeographicCoverageTypeBadge({ value }: GeographicCoverageTypeBadgeProps) {
  if (!value) {
    return <Badge variant="secondary" className="bg-slate-100 text-slate-600">Não informado</Badge>;
  }

  const label = geographicCoverageLabels[value] || value;

  // Choose a color based on the coverage type
  let colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (value === 'local') colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
  if (value === 'regional') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'state') colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
  if (value === 'national') colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
  if (value === 'international') colorClass = 'bg-pink-50 text-pink-700 border-pink-200';

  return (
    <Badge variant="default" className={colorClass}>
      {label}
    </Badge>
  );
}
