import * as v from 'valibot';
import { idSchema } from './schemas.ts';

const invitationStatusSchema = v.picklist(['pending', 'accepted', 'rejected', 'canceled']);
const emailSchema = v.pipe(v.string(), v.email());

export const invitationDetailSchema = v.object({
  id: idSchema,
  email: emailSchema,
  role: v.string(),
  organizationId: idSchema,
  organizationName: v.optional(v.string()),
  organizationSlug: v.optional(v.string()),
  inviterEmail: v.optional(emailSchema),
  status: invitationStatusSchema,
});

export const memberListSchema = v.object({
  members: v.array(
    v.object({
      id: idSchema,
      role: v.string(),
      userId: idSchema,
      user: v.object({
        id: idSchema,
        name: v.optional(v.string()),
        email: emailSchema,
      }),
    }),
  ),
  total: v.optional(v.number()),
});

export const invitationListSchema = v.array(
  v.object({
    id: idSchema,
    email: emailSchema,
    role: v.string(),
    status: invitationStatusSchema,
  }),
);

export const acceptInvitationResultSchema = v.object({
  organizationId: v.optional(idSchema),
  invitationId: v.optional(idSchema),
});

export type InvitationDetail = v.InferOutput<typeof invitationDetailSchema>;
export type WorkspaceMember = v.InferOutput<typeof memberListSchema>['members'][number];
export type WorkspaceInvitation = v.InferOutput<typeof invitationListSchema>[number];
export type InviteRole = 'admin' | 'member';
