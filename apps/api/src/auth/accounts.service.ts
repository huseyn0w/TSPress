import type {
  AuthResult,
  CaslAction,
  ChangePasswordInput,
  LoginInput,
  OAuthInput,
  Permission,
  PublicUser,
  RegisterInput,
  UpdateAccountInput,
} from '@cmstack-ts/config';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  ROLE_REPOSITORY,
  type RoleRepository,
  USER_REPOSITORY,
  type UserPublicFields,
  type UserRepository,
  type UserWithRole,
} from '@cmstack-ts/db';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from './authenticated-user';
import { PasswordService } from './password.service';

/** Default role assigned to self-registered and first-time OAuth users. */
const DEFAULT_ROLE = 'Member';

@Injectable()
export class AccountsService {
  /**
   * A throwaway hash, computed once, used to verify against on the
   * unknown-email / passwordless paths so login takes roughly constant time and
   * does not leak which emails are registered.
   */
  private readonly decoyHash: Promise<string>;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {
    this.decoyHash = this.passwords.hash('cmstack-ts-decoy-password');
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findIdByEmail(input.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await this.passwords.hash(input.password);
    const role = await this.roles.findIdByName(DEFAULT_ROLE);

    const user = await this.users.createWithRole({
      email: input.email,
      name: input.name ?? null,
      passwordHash,
      roleId: role?.id ?? null,
    });

    return this.buildAuthResult(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmailWithRole(input.email);

    // Always run a verification (against a decoy hash when the user or password
    // is absent) so response timing does not reveal which emails are registered.
    const hashToCheck = user?.passwordHash ?? (await this.decoyHash);
    const passwordMatches = await this.passwords.verify(hashToCheck, input.password);
    if (!user || user.passwordHash == null || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.buildAuthResult(user);
  }

  async oauth(input: OAuthInput): Promise<AuthResult> {
    const linked = await this.accounts.findByProvider(input.provider, input.providerAccountId);
    if (linked) {
      return this.buildAuthResult(linked.user);
    }

    const existing = await this.users.findByEmailWithRole(input.email);
    if (existing) {
      await this.accounts.linkToUser(existing.id, {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      });
      return this.buildAuthResult(existing);
    }

    const role = await this.roles.findIdByName(DEFAULT_ROLE);
    const user = await this.users.createWithRoleAndAccount({
      email: input.email,
      name: input.name ?? null,
      image: input.image ?? null,
      roleId: role?.id ?? null,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    });
    return this.buildAuthResult(user);
  }

  /** Loads the user for an authenticated request, or null if they no longer exist. */
  async getAuthenticatedUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.users.findByIdWithRole(id);
    if (!user) {
      return null;
    }
    return { ...this.toPublicUser(user), permissions: this.flattenPermissions(user) };
  }

  /** Self-service profile update for the signed-in user (name / bio / avatar). */
  async updateProfile(userId: string, input: UpdateAccountInput): Promise<UserPublicFields> {
    const data: { name?: string; bio?: string; image?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.image !== undefined) data.image = input.image === '' ? null : input.image;

    return this.users.updateProfileFields(userId, data);
  }

  /**
   * Change the signed-in user's password: verify the current one, then store the
   * new Argon2id hash. OAuth-only accounts (no password set) are rejected with a
   * clear message; a wrong current password is a 401.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.users.findByIdWithRole(userId);
    if (!user) throw new UnauthorizedException('You are not signed in.');
    if (user.passwordHash == null) {
      throw new BadRequestException(
        'This account signs in with a provider and has no password to change.',
      );
    }
    const matches = await this.passwords.verify(user.passwordHash, input.currentPassword);
    if (!matches) throw new UnauthorizedException('Your current password is incorrect.');

    const newHash = await this.passwords.hash(input.newPassword);
    await this.users.updatePasswordHash(userId, newHash);
  }

  private async buildAuthResult(user: UserWithRole): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: UserWithRole): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role ? { name: user.role.name, permissions: this.flattenPermissions(user) } : null,
    };
  }

  private flattenPermissions(user: UserWithRole): Permission[] {
    return (user.role?.permissions ?? []).map((p) => ({
      action: p.action as CaslAction,
      subject: p.subject,
    }));
  }
}
