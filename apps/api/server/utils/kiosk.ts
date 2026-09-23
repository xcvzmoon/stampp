import type { AuthorizedContext } from '@stampp/access';
import type { AttendanceRecord, KioskDevice, KioskMemberCredential } from '@stampp/database';
import type {
  CreateKioskDeviceInput,
  KioskCredentialDto,
  KioskCredentialListResult,
  KioskDeviceCreated,
  KioskDeviceDto,
  KioskDeviceListResult,
  KioskListQuery,
  KioskPunchInput,
  KioskPunchResult,
  SetKioskPinInput,
  UpdateKioskDeviceInput,
} from '@stampp/shared';
import { attendanceRecords, kioskDevices, kioskMemberCredentials, members } from '@stampp/database';
import {
  assertValidAttendanceInterval,
  attendanceDurationMinutes,
  canClockIn,
  canClockOut,
  hasPermission,
  resolveKioskPunchAction,
} from '@stampp/domain';
import { DEFAULT_LIST_LIMIT, ERROR_CODES, kioskListQuerySchema } from '@stampp/shared';
import { and, asc, eq, gt, isNull, type SQL } from 'drizzle-orm';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { isUniqueViolation } from '~/server/utils/catalog.ts';
import { calendarDateInTimezone } from '~/server/utils/week.ts';

type ListKioskOptions = KioskListQuery & { limit: number };

function notFound(requestId: string, entity: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, `${entity} not found`, requestId);
}

function authFailed(requestId: string) {
  return toApiError(ERROR_CODES.KIOSK_AUTH_FAILED, 'Invalid kiosk credentials', requestId);
}

function deviceRevoked(requestId: string) {
  return toApiError(ERROR_CODES.KIOSK_DEVICE_REVOKED, 'Kiosk device is revoked', requestId);
}

/** High-entropy device keys: unsalted SHA-256 is fine for lookup. */
function deviceKeyDigest(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

function scryptHash(secret: string, salt: string): string {
  return scryptSync(secret, salt, 32).toString('hex');
}

type GeneratedDeviceKey = {
  plain: string;
  digest: string;
  prefix: string;
};

function generateDeviceKey(): GeneratedDeviceKey {
  const plain = randomBytes(32).toString('base64url');
  return {
    plain,
    digest: deviceKeyDigest(plain),
    prefix: plain.slice(0, 8),
  };
}

function verifyScrypt(secret: string, salt: string, expectedHex: string): boolean {
  const actual = Buffer.from(scryptHash(secret, salt), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function toKioskDeviceDto(row: KioskDevice): KioskDeviceDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    status: row.status,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toKioskCredentialDto(row: KioskMemberCredential): KioskCredentialDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    hasPin: row.pinHash !== null && row.pinSalt !== null,
    hasQrToken: row.qrTokenHash !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertWorkspaceMember(
  client: AuthorizedContext['db']['client'],
  workspaceId: string,
  userId: string,
  requestId: string,
): Promise<void> {
  const rows = await client
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.organizationId, workspaceId), eq(members.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Target user is not a workspace member', requestId);
  }
}

export async function listKioskDevices(
  ctx: AuthorizedContext,
  options: { limit: number; cursor?: string },
): Promise<KioskDeviceListResult> {
  const conditions: SQL[] = [eq(kioskDevices.workspaceId, ctx.workspaceId)];
  if (options.cursor) conditions.push(gt(kioskDevices.id, options.cursor));
  const rows = await ctx.db.client
    .select()
    .from(kioskDevices)
    .where(and(...conditions))
    .orderBy(asc(kioskDevices.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toKioskDeviceDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function createKioskDevice(
  ctx: AuthorizedContext,
  input: CreateKioskDeviceInput,
  requestId: string,
): Promise<KioskDeviceCreated> {
  const key = generateDeviceKey();
  try {
    const rows = await ctx.db.client
      .insert(kioskDevices)
      .values({
        workspaceId: ctx.workspaceId,
        name: input.name,
        keyPrefix: key.prefix,
        deviceKeyHash: key.digest,
        status: 'active',
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create kiosk device', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'kiosk_device.created',
      entityType: 'kiosk_device',
      entityId: row.id,
      after: { id: row.id, name: row.name, keyPrefix: row.keyPrefix, status: row.status },
    });
    return { device: toKioskDeviceDto(row), deviceKey: key.plain };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(
        ERROR_CODES.CONFLICT,
        'A kiosk device with that name already exists',
        requestId,
      );
    }
    throw error;
  }
}

async function getDeviceRow(
  ctx: AuthorizedContext,
  deviceId: string,
  requestId: string,
): Promise<KioskDevice> {
  const rows = await ctx.db.client
    .select()
    .from(kioskDevices)
    .where(and(eq(kioskDevices.id, deviceId), eq(kioskDevices.workspaceId, ctx.workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Kiosk device');
  return row;
}

export async function updateKioskDevice(
  ctx: AuthorizedContext,
  deviceId: string,
  input: UpdateKioskDeviceInput,
  requestId: string,
): Promise<KioskDeviceDto> {
  const before = await getDeviceRow(ctx, deviceId, requestId);
  const rows = await ctx.db.client
    .update(kioskDevices)
    .set({
      name: input.name ?? before.name,
      status: input.status ?? before.status,
      updatedAt: new Date(),
    })
    .where(and(eq(kioskDevices.id, before.id), eq(kioskDevices.workspaceId, ctx.workspaceId)))
    .returning();
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Kiosk device');
  await recordAudit(ctx, requestId, {
    action: 'kiosk_device.updated',
    entityType: 'kiosk_device',
    entityId: row.id,
    before: { id: before.id, name: before.name, status: before.status },
    after: { id: row.id, name: row.name, status: row.status },
  });
  return toKioskDeviceDto(row);
}

export async function revokeKioskDevice(
  ctx: AuthorizedContext,
  deviceId: string,
  requestId: string,
): Promise<void> {
  const before = await getDeviceRow(ctx, deviceId, requestId);
  await ctx.db.client
    .update(kioskDevices)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(kioskDevices.id, before.id));
  await recordAudit(ctx, requestId, {
    action: 'kiosk_device.revoked',
    entityType: 'kiosk_device',
    entityId: before.id,
    before: { id: before.id, status: before.status },
  });
}

export async function rotateKioskDeviceKey(
  ctx: AuthorizedContext,
  deviceId: string,
  requestId: string,
): Promise<KioskDeviceCreated> {
  const before = await getDeviceRow(ctx, deviceId, requestId);
  const key = generateDeviceKey();
  const rows = await ctx.db.client
    .update(kioskDevices)
    .set({
      deviceKeyHash: key.digest,
      keyPrefix: key.prefix,
      updatedAt: new Date(),
    })
    .where(eq(kioskDevices.id, before.id))
    .returning();
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Kiosk device');
  await recordAudit(ctx, requestId, {
    action: 'kiosk_device.key_rotated',
    entityType: 'kiosk_device',
    entityId: row.id,
    before: { id: before.id, keyPrefix: before.keyPrefix },
    after: { id: row.id, keyPrefix: row.keyPrefix },
  });
  return { device: toKioskDeviceDto(row), deviceKey: key.plain };
}

export async function listKioskCredentials(
  ctx: AuthorizedContext,
  options: ListKioskOptions,
): Promise<KioskCredentialListResult> {
  const conditions: SQL[] = [eq(kioskMemberCredentials.workspaceId, ctx.workspaceId)];
  if (options.userId) conditions.push(eq(kioskMemberCredentials.userId, options.userId));
  if (options.cursor) conditions.push(gt(kioskMemberCredentials.id, options.cursor));
  const rows = await ctx.db.client
    .select()
    .from(kioskMemberCredentials)
    .where(and(...conditions))
    .orderBy(asc(kioskMemberCredentials.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toKioskCredentialDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

async function getCredentialRow(
  ctx: AuthorizedContext,
  userId: string,
): Promise<KioskMemberCredential | null> {
  const rows = await ctx.db.client
    .select()
    .from(kioskMemberCredentials)
    .where(
      and(
        eq(kioskMemberCredentials.workspaceId, ctx.workspaceId),
        eq(kioskMemberCredentials.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function setKioskPin(
  ctx: AuthorizedContext,
  input: SetKioskPinInput,
  requestId: string,
): Promise<KioskCredentialDto> {
  const targetUserId = input.userId ?? ctx.userId;
  if (targetUserId !== ctx.userId && !hasPermission(ctx.role, 'kiosk:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Kiosk manage permission is required', requestId);
  }
  await assertWorkspaceMember(ctx.db.client, ctx.workspaceId, targetUserId, requestId);

  const salt = randomBytes(16).toString('hex');
  const pinHash = scryptHash(input.pin, salt);
  const existing = await getCredentialRow(ctx, targetUserId);
  try {
    if (existing) {
      const rows = await ctx.db.client
        .update(kioskMemberCredentials)
        .set({ pinHash, pinSalt: salt, updatedAt: new Date() })
        .where(eq(kioskMemberCredentials.id, existing.id))
        .returning();
      const row = rows[0];
      if (!row) throw notFound(requestId, 'Kiosk credential');
      await recordAudit(ctx, requestId, {
        action: 'kiosk_pin.set',
        entityType: 'kiosk_credential',
        entityId: row.id,
        after: toKioskCredentialDto(row),
      });
      return toKioskCredentialDto(row);
    }
    const rows = await ctx.db.client
      .insert(kioskMemberCredentials)
      .values({
        workspaceId: ctx.workspaceId,
        userId: targetUserId,
        pinHash,
        pinSalt: salt,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to save kiosk PIN', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'kiosk_pin.set',
      entityType: 'kiosk_credential',
      entityId: row.id,
      after: toKioskCredentialDto(row),
    });
    return toKioskCredentialDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Credential already exists for member', requestId);
    }
    throw error;
  }
}

export async function clearKioskPin(
  ctx: AuthorizedContext,
  userId: string | undefined,
  requestId: string,
): Promise<void> {
  const targetUserId = userId ?? ctx.userId;
  if (targetUserId !== ctx.userId && !hasPermission(ctx.role, 'kiosk:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Kiosk manage permission is required', requestId);
  }
  const existing = await getCredentialRow(ctx, targetUserId);
  if (!existing) throw notFound(requestId, 'Kiosk credential');
  if (!existing.pinHash) throw notFound(requestId, 'Kiosk PIN');

  if (existing.qrTokenHash !== null) {
    await ctx.db.client
      .update(kioskMemberCredentials)
      .set({ pinHash: null, pinSalt: null, updatedAt: new Date() })
      .where(eq(kioskMemberCredentials.id, existing.id));
  } else {
    await ctx.db.client
      .delete(kioskMemberCredentials)
      .where(eq(kioskMemberCredentials.id, existing.id));
  }
  await recordAudit(ctx, requestId, {
    action: 'kiosk_pin.cleared',
    entityType: 'kiosk_credential',
    entityId: existing.id,
    before: toKioskCredentialDto(existing),
  });
}

export async function rotateKioskQrToken(
  ctx: AuthorizedContext,
  userId: string | undefined,
  requestId: string,
): Promise<{ credential: KioskCredentialDto; qrToken: string }> {
  const targetUserId = userId ?? ctx.userId;
  if (targetUserId !== ctx.userId && !hasPermission(ctx.role, 'kiosk:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Kiosk manage permission is required', requestId);
  }
  await assertWorkspaceMember(ctx.db.client, ctx.workspaceId, targetUserId, requestId);

  const qrToken = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const qrTokenHash = `${salt}:${scryptHash(qrToken, salt)}`;
  const existing = await getCredentialRow(ctx, targetUserId);
  try {
    let row: KioskMemberCredential;
    if (existing) {
      const rows = await ctx.db.client
        .update(kioskMemberCredentials)
        .set({ qrTokenHash, updatedAt: new Date() })
        .where(eq(kioskMemberCredentials.id, existing.id))
        .returning();
      const updated = rows[0];
      if (!updated) throw notFound(requestId, 'Kiosk credential');
      row = updated;
    } else {
      const rows = await ctx.db.client
        .insert(kioskMemberCredentials)
        .values({
          workspaceId: ctx.workspaceId,
          userId: targetUserId,
          qrTokenHash,
        })
        .returning();
      const created = rows[0];
      if (!created) {
        throw toApiError(ERROR_CODES.INTERNAL, 'Failed to save kiosk QR token', requestId);
      }
      row = created;
    }
    await recordAudit(ctx, requestId, {
      action: 'kiosk_qr.rotated',
      entityType: 'kiosk_credential',
      entityId: row.id,
      after: toKioskCredentialDto(row),
    });
    return { credential: toKioskCredentialDto(row), qrToken };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Credential already exists for member', requestId);
    }
    throw error;
  }
}

/** Resolve a device by key digest within a workspace (device-key is the auth). */
export async function findKioskDeviceByKey(
  client: AuthorizedContext['db']['client'],
  workspaceId: string,
  deviceKey: string,
  requestId: string,
): Promise<KioskDevice> {
  const digest = deviceKeyDigest(deviceKey);
  const rows = await client
    .select()
    .from(kioskDevices)
    .where(and(eq(kioskDevices.deviceKeyHash, digest), eq(kioskDevices.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw authFailed(requestId);
  if (row.status !== 'active') throw deviceRevoked(requestId);
  return row;
}

async function authenticateMember(
  client: AuthorizedContext['db']['client'],
  workspaceId: string,
  input: KioskPunchInput,
  requestId: string,
): Promise<string> {
  const rows = await client
    .select()
    .from(kioskMemberCredentials)
    .where(eq(kioskMemberCredentials.workspaceId, workspaceId));

  if (input.method === 'pin') {
    if (!input.pin) throw authFailed(requestId);
    for (const row of rows) {
      if (!row.pinHash || !row.pinSalt) continue;
      if (verifyScrypt(input.pin, row.pinSalt, row.pinHash)) {
        return row.userId;
      }
    }
    throw authFailed(requestId);
  }

  if (!input.qrToken) throw authFailed(requestId);
  for (const row of rows) {
    if (!row.qrTokenHash) continue;
    const [salt, expected] = row.qrTokenHash.split(':');
    if (!salt || !expected) continue;
    if (verifyScrypt(input.qrToken, salt, expected)) {
      return row.userId;
    }
  }
  throw authFailed(requestId);
}

/**
 * Device-key + PIN/QR punch. Creates or closes attendance only (never project time).
 * Caller must already have RLS/workspace context bound for the device's workspace.
 */
export async function kioskPunch(
  ctx: AuthorizedContext,
  device: KioskDevice,
  input: KioskPunchInput,
  requestId: string,
): Promise<KioskPunchResult> {
  const userId = await authenticateMember(ctx.db.client, ctx.workspaceId, input, requestId);

  const openRows = await ctx.db.client
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workspaceId, ctx.workspaceId),
        eq(attendanceRecords.userId, userId),
        isNull(attendanceRecords.clockOutAt),
      ),
    )
    .limit(1);
  const open = openRows[0] ?? null;
  const action = resolveKioskPunchAction(open !== null);
  const now = new Date();

  let record: AttendanceRecord;
  if (action === 'clock_in') {
    if (!canClockIn(open !== null)) {
      throw toApiError(ERROR_CODES.ATTENDANCE_ALREADY_OPEN, 'Already clocked in', requestId);
    }
    try {
      const inserted = await ctx.db.client
        .insert(attendanceRecords)
        .values({
          workspaceId: ctx.workspaceId,
          userId,
          clockInAt: now,
          workDate: calendarDateInTimezone(now, input.timezone),
          timezone: input.timezone,
          source: 'kiosk',
          kioskDeviceId: device.id,
          note: input.note ?? null,
        })
        .returning();
      record = inserted[0];
      if (!record) {
        throw toApiError(ERROR_CODES.INTERNAL, 'Failed to clock in', requestId);
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw toApiError(ERROR_CODES.ATTENDANCE_ALREADY_OPEN, 'Already clocked in', requestId);
      }
      throw error;
    }
    await recordAudit(ctx, requestId, {
      action: 'attendance.kiosk_clock_in',
      entityType: 'attendance_record',
      entityId: record.id,
      after: record,
    });
  } else {
    if (!open || !canClockOut(true)) {
      throw toApiError(ERROR_CODES.ATTENDANCE_NOT_OPEN, 'Not clocked in', requestId);
    }
    assertValidAttendanceInterval(open.clockInAt, now);
    const durationMinutes = attendanceDurationMinutes(open.clockInAt, now);
    const updated = await ctx.db.client
      .update(attendanceRecords)
      .set({
        clockOutAt: now,
        durationMinutes,
        kioskDeviceId: device.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(attendanceRecords.id, open.id),
          eq(attendanceRecords.workspaceId, ctx.workspaceId),
          isNull(attendanceRecords.clockOutAt),
        ),
      )
      .returning();
    record = updated[0];
    if (!record) {
      throw toApiError(ERROR_CODES.ATTENDANCE_NOT_OPEN, 'Not clocked in', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'attendance.kiosk_clock_out',
      entityType: 'attendance_record',
      entityId: record.id,
      before: open,
      after: record,
    });
  }

  await ctx.db.client
    .update(kioskDevices)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(kioskDevices.id, device.id));

  return {
    action,
    recordId: record.id,
    userId: record.userId,
    clockInAt: record.clockInAt.toISOString(),
    clockOutAt: record.clockOutAt?.toISOString() ?? null,
    deviceId: record.kioskDeviceId,
  };
}

export function parseKioskListQuery(query: URLSearchParams, requestId: string): ListKioskOptions {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'userId']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(kioskListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return { ...result.output, limit: result.output.limit ?? DEFAULT_LIST_LIMIT };
}
