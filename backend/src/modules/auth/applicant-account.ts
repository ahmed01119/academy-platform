import type { TenantTransactionClient } from '@academy/database';
import { singleRow } from '../../common/db-function-error';

/**
 * Creating the account of a new applicant (shared by the three applicant kinds).
 *
 *  - COACH / academy owner: `AuthService.register` (academy application, reviewed by the platform);
 *  - PLAYER and GUARDIAN: `PortalService.submitPlayerJoinRequest` (join request, reviewed by the academy).
 *
 * The account is an ordinary user row. It is "pending" only because the user has no membership, no player/guardian
 * link and no platform role yet; login gating (`AuthService.login`) then refuses sign-in while the latest application
 * or join request is still under review, and lets the user in once it is approved and linked.
 */
export interface ApplicantAccountInput {
  /** Lower-cased, trimmed e-mail address. */
  email: string;
  /** Argon2 hash (PasswordService.hash); never the plain password. */
  passwordHash: string;
  name: string;
  phone?: string | null;
}

/**
 * Inserts the applicant's user row and makes it the transaction's actor (`app.actor_user_id`), so the definer
 * functions and RLS policies that follow in the same transaction see the new applicant as the current user.
 *
 * The INSERT names its columns explicitly: the runtime database role may insert only these 7 columns of `users`
 * (Phase 3A.2). Prisma's `create()` would also send every column that has a default (`is_email_verified`,
 * `session_version`, the platform flags), which the database refuses; the defaults therefore come from the database.
 *
 * Must run inside a transaction. Returns the new user id.
 */
export async function insertApplicantAccount(
  tx: TenantTransactionClient,
  input: ApplicantAccountInput,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.users (id, email, password_hash, name, phone, created_at, updated_at)
    VALUES (gen_random_uuid(), ${input.email}, ${input.passwordHash}, ${input.name.trim()},
            ${input.phone?.trim() || null}, now(), now())
    RETURNING id::text AS id`;
  const userId = singleRow(rows).id;
  await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${userId}, true)`;
  return userId;
}

/** True when the error is the unique violation on `users.email` (two sign-ups racing for one address). */
export function isDuplicateEmailError(error: unknown): boolean {
  return /users_email_key|duplicate key/.test(String((error as Error)?.message));
}
