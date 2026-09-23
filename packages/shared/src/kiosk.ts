import * as v from 'valibot';
import { timezoneSchema } from './attendance.ts';
import { idSchema } from './schemas.ts';

export const kioskPinSchema = v.pipe(v.string(), v.regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits'));

export const kioskQrTokenSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z0-9_-]{32,128}$/, 'QR token must be 32-128 URL-safe characters'),
);

export const deviceKeyHeaderSchema = v.pipe(
  v.string(),
  v.minLength(32),
  v.maxLength(128),
  v.regex(/^[A-Za-z0-9_-]+$/, 'Invalid device key'),
);

export const createKioskDeviceInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
});

export const updateKioskDeviceInputSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  status: v.optional(v.picklist(['active', 'revoked'])),
});

export const setKioskPinInputSchema = v.object({
  userId: v.optional(idSchema),
  pin: kioskPinSchema,
});

export const clearKioskPinInputSchema = v.object({
  userId: v.optional(idSchema),
});

export const rotateKioskQrInputSchema = v.object({
  userId: v.optional(idSchema),
});

export const kioskPunchInputSchema = v.object({
  method: v.picklist(['pin', 'qr']),
  pin: v.optional(kioskPinSchema),
  qrToken: v.optional(kioskQrTokenSchema),
  timezone: timezoneSchema,
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500))),
});

export const kioskListQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer('limit must be an integer'),
      v.minValue(1),
      v.maxValue(200),
    ),
  ),
  cursor: v.optional(idSchema),
  userId: v.optional(idSchema),
});

export const kioskDeviceDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  keyPrefix: v.string(),
  status: v.picklist(['active', 'revoked']),
  lastUsedAt: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const kioskDeviceListResultSchema = v.object({
  items: v.array(kioskDeviceDtoSchema),
  nextCursor: v.nullable(v.string()),
});

/** Returned once at registration / key rotation. */
export const kioskDeviceCreatedSchema = v.object({
  device: kioskDeviceDtoSchema,
  deviceKey: v.string(),
});

export const kioskCredentialDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  hasPin: v.boolean(),
  hasQrToken: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const kioskCredentialListResultSchema = v.object({
  items: v.array(kioskCredentialDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const kioskPunchResultSchema = v.object({
  action: v.picklist(['clock_in', 'clock_out']),
  recordId: v.string(),
  userId: v.string(),
  clockInAt: v.string(),
  clockOutAt: v.nullable(v.string()),
  deviceId: v.nullable(v.string()),
});

export type KioskPin = v.InferOutput<typeof kioskPinSchema>;
export type CreateKioskDeviceInput = v.InferOutput<typeof createKioskDeviceInputSchema>;
export type UpdateKioskDeviceInput = v.InferOutput<typeof updateKioskDeviceInputSchema>;
export type SetKioskPinInput = v.InferOutput<typeof setKioskPinInputSchema>;
export type KioskPunchInput = v.InferOutput<typeof kioskPunchInputSchema>;
export type KioskListQuery = v.InferOutput<typeof kioskListQuerySchema>;
export type KioskDeviceDto = v.InferOutput<typeof kioskDeviceDtoSchema>;
export type KioskDeviceListResult = v.InferOutput<typeof kioskDeviceListResultSchema>;
export type KioskDeviceCreated = v.InferOutput<typeof kioskDeviceCreatedSchema>;
export type KioskCredentialDto = v.InferOutput<typeof kioskCredentialDtoSchema>;
export type KioskCredentialListResult = v.InferOutput<typeof kioskCredentialListResultSchema>;
export type KioskPunchResult = v.InferOutput<typeof kioskPunchResultSchema>;
