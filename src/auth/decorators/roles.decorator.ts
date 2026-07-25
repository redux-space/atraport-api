import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles are allowed to access a route.
 *
 * @example
 * \@Roles(UserRole.ADMIN)
 * \@Get('admin-only')
 * adminOnly() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
