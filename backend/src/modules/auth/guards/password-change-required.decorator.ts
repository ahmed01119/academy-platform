import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED = 'allowWhilePasswordChangeRequired';

/**
 * Marks an endpoint that stays usable while the user must change their password (`users.must_reset_password`, set
 * by a platform administrator). Every other JWT-protected endpoint answers 403 PASSWORD_CHANGE_REQUIRED until the
 * password is changed; the database clears the flag on the change (trigger users_clear_must_reset_password).
 * Used on: GET /auth/me, POST /auth/change-password, POST /auth/logout.
 */
export const AllowWhilePasswordChangeRequired = () =>
  SetMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED, true);
