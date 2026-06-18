import { z } from 'zod';
import { postSummarySchema } from './content';

/** Profile, author, and like contracts (Phase 9). */

/** Self-service account edit (the signed-in user updating their own profile). */
export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(600).optional(),
  image: z.literal('').or(z.string().trim().url().max(1000)).optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/** Public author profile: identity + their published posts. */
export const authorProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  bio: z.string().nullable(),
  posts: z.array(postSummarySchema),
});
export type AuthorProfile = z.infer<typeof authorProfileSchema>;

/** Like state for a post: total count + whether the current user liked it. */
export const likeStateSchema = z.object({
  likes: z.number().int(),
  liked: z.boolean(),
});
export type LikeState = z.infer<typeof likeStateSchema>;
