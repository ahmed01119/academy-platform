import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { Permission } from '@academy/shared';

export const PERMISSIONS_KEY = 'required_permissions';
export const RequirePermissions = (...permissions: Permission[]): CustomDecorator<string> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
