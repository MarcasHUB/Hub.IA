export function canMaintainGlobalMaster(
  isPlatformAdmin: boolean | undefined,
  masterMaintenanceMode: boolean,
): boolean {
  return masterMaintenanceMode && isPlatformAdmin === true;
}

export function requiresLinkedMasterForSave(status: string): boolean {
  return status !== 'Draft';
}
