import { ALL_PERMISSIONS, isValidCustomRoleName } from '@stampp/domain';
import * as v from 'valibot';
import { idSchema } from './schemas.ts';

export { ALL_PERMISSIONS };

export const permissionSchema = v.picklist(ALL_PERMISSIONS);

export const customRoleDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  description: v.nullable(v.string()),
  permissions: v.array(permissionSchema),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const customRoleListResultSchema = v.object({
  items: v.array(customRoleDtoSchema),
});

export const createCustomRoleInputSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.check((input) => isValidCustomRoleName(input), 'Name must be 1-80 characters'),
  ),
  description: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
  permissions: v.pipe(v.array(permissionSchema), v.minLength(1)),
});

export const updateCustomRoleInputSchema = v.object({
  name: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.check((input) => isValidCustomRoleName(input), 'Name must be 1-80 characters'),
    ),
  ),
  description: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200)))),
  permissions: v.optional(v.pipe(v.array(permissionSchema), v.minLength(1))),
});

export const assignMemberRoleInputSchema = v.object({
  role: v.optional(v.picklist(['admin', 'manager', 'member', 'guest'])),
  customRoleId: v.optional(v.nullable(idSchema)),
});

export const workspaceMemberDtoSchema = v.object({
  id: v.string(),
  userId: v.string(),
  name: v.nullable(v.string()),
  email: v.string(),
  role: v.string(),
  customRoleId: v.nullable(v.string()),
  customRoleName: v.nullable(v.string()),
});

export const workspaceMemberListResultSchema = v.object({
  items: v.array(workspaceMemberDtoSchema),
});

export type CustomRoleDto = v.InferOutput<typeof customRoleDtoSchema>;
export type CreateCustomRoleInput = v.InferOutput<typeof createCustomRoleInputSchema>;
export type UpdateCustomRoleInput = v.InferOutput<typeof updateCustomRoleInputSchema>;
export type AssignMemberRoleInput = v.InferOutput<typeof assignMemberRoleInputSchema>;
export type WorkspaceMemberDto = v.InferOutput<typeof workspaceMemberDtoSchema>;
