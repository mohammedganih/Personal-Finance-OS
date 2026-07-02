import { z } from 'zod';

export const createFamilyMemberSchema = z.object({
  name:      z.string().min(1).max(100),
  relation:  z.string().max(50).optional(),
  color:     z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emoji:     z.string().max(4).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateFamilyMemberSchema = createFamilyMemberSchema.partial();

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>;
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;
