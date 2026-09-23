export type AuditRetentionUnit = 'days';

export const MIN_AUDIT_RETENTION_DAYS = 7;
export const MAX_AUDIT_RETENTION_DAYS = 3650;
export const DEFAULT_AUDIT_RETENTION_DAYS = 365;

export function isValidRetentionDays(days: number): boolean {
  return (
    Number.isInteger(days) && days >= MIN_AUDIT_RETENTION_DAYS && days <= MAX_AUDIT_RETENTION_DAYS
  );
}

export function auditPurgeCutoff(retentionDays: number, now = new Date()): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff;
}

export function auditCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function auditListQueryFilter(input: {
  action?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorUserId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): string[] {
  const parts: string[] = [];
  if (input.action) parts.push(`action=${input.action}`);
  if (input.entityType) parts.push(`entityType=${input.entityType}`);
  if (input.entityId) parts.push(`entityId=${input.entityId}`);
  if (input.actorUserId) parts.push(`actorUserId=${input.actorUserId}`);
  if (input.from) parts.push(`from=${input.from}`);
  if (input.to) parts.push(`to=${input.to}`);
  return parts;
}
