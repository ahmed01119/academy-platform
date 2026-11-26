import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { PortalService } from './portal.service';
import type { PrismaService } from '../database/prisma.service';
import type { RedisService } from '../redis/redis.service';
import type { PasswordService } from '../auth/password.service';
import type { EmailCodeService } from '../auth/email-code.service';
import { CreatePlayerJoinRequestSchema } from '@academy/shared';

/**
 * K6: every join request belongs to an account.
 *  - signed in      -> linked to the current account, no new account
 *  - not signed in  -> new pending account + request in ONE transaction
 */
type MockFn = ReturnType<typeof vi.fn>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000042';

/** The SQL text of a tagged-template $queryRaw / $executeRaw mock call. */
const sqlOf = (call: unknown[] | undefined) => ((call?.[0] ?? []) as string[]).join('?');

const functionRow = {
  request_id: '00000000-0000-4000-8000-0000000000aa',
  tenant_name: 'Academy',
  applicant_user_id: USER,
  requester_type: 'GUARDIAN',
  created_at: new Date('2026-11-16T10:00:00Z'),
};

describe('PortalService.submitPlayerJoinRequest (K6)', () => {
  let tx: { $queryRaw: MockFn; $executeRaw: MockFn };
  let prisma: Record<string, unknown> & {
    user: { findUnique: MockFn };
    $transaction: MockFn;
    withAuthLookupTransaction: MockFn;
  };
  let redis: { incrementRateLimit: MockFn };
  let password: { hash: MockFn };
  let emailCode: { assertProof: MockFn; markVerifiedInTx: MockFn; assertDomainAcceptsMail: MockFn };
  let service: PortalService;

  const guardianDto = (extra: Record<string, unknown> = {}) =>
    CreatePlayerJoinRequestSchema.parse({
      tenantId: TENANT,
      requesterType: 'GUARDIAN',
      playerName: 'Youssef Sharif',
      guardianName: 'Ahmed Sharif',
      contactEmail: 'Parent@Example.test',
      contactPhone: '+201000000000',
      ...extra,
    });

  beforeEach(() => {
    tx = {
      $queryRaw: vi
        .fn()
        .mockImplementation((strings: string[]) =>
          Promise.resolve(
            strings.join('?').includes('INSERT INTO public.users') ? [{ id: USER }] : [functionRow],
          ),
        ),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockImplementation((fn) => fn(tx)),
      withAuthLookupTransaction: vi.fn().mockImplementation((_c, fn) => fn(tx)),
    };
    redis = { incrementRateLimit: vi.fn().mockResolvedValue({ count: 1, remainingTime: 3600 }) };
    password = { hash: vi.fn().mockResolvedValue('argon2id$hash') };
    emailCode = {
      assertProof: vi.fn(),
      markVerifiedInTx: vi.fn().mockResolvedValue(undefined),
      assertDomainAcceptsMail: vi.fn().mockResolvedValue(undefined),
    };
    service = new PortalService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      password as unknown as PasswordService,
      emailCode as unknown as EmailCodeService,
    );
  });

  it('2026-11-25: stores the rest of the shared player form with the request', async () => {
    await service.submitPlayerJoinRequest(
      guardianDto({
        password: 'Str0ng-Passw0rd!',
        gender: 'FEMALE',
        jerseyNumber: 7,
        nationalId: '29901011234567',
        medicalNotes: 'Asthma',
      }),
      undefined,
      '203.0.113.7',
    );
    const submit = tx.$queryRaw.mock.calls[1];
    expect(sqlOf(submit)).toContain('submit_player_join_request');
    expect(submit?.slice(-4)).toEqual(['FEMALE', 7, '29901011234567', 'Asthma']);
  });

  it('anonymous: creates the pending account and the request in one transaction', async () => {
    const result = await service.submitPlayerJoinRequest(
      guardianDto({ password: 'Str0ng-Passw0rd!' }),
      undefined,
      '203.0.113.7',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const sql = tx.$queryRaw.mock.calls.map(sqlOf);
    expect(sql[0]).toContain('INSERT INTO public.users');
    expect(sql[1]).toContain('submit_player_join_request');
    // the account is named after the person asking: the guardian
    expect(tx.$queryRaw.mock.calls[0]).toContain('Ahmed Sharif');
    // e-mail normalised, requester type passed to the database
    expect(tx.$queryRaw.mock.calls[0]).toContain('parent@example.test');
    expect(tx.$queryRaw.mock.calls[1]).toContain('GUARDIAN');
    // the new account is the actor of the rest of the transaction
    expect(sqlOf(tx.$executeRaw.mock.calls[0])).toContain("set_config('app.actor_user_id'");
    expect(password.hash).toHaveBeenCalledWith('Str0ng-Passw0rd!');
    expect(result).toMatchObject({
      applicantUserId: USER,
      requesterType: 'GUARDIAN',
      status: 'PENDING_REVIEW',
    });
  });

  it('anonymous: the new account e-mail must be confirmed and is stored as verified', async () => {
    await service.submitPlayerJoinRequest(
      guardianDto({ password: 'Str0ng-Passw0rd!', emailProof: 'proof' }),
      undefined,
    );
    expect(emailCode.assertProof).toHaveBeenCalledWith('parent@example.test', 'proof');
    expect(emailCode.markVerifiedInTx).toHaveBeenCalledWith(tx, 'parent@example.test');

    emailCode.assertProof.mockImplementation(() => {
      throw new BadRequestException({ code: 'EMAIL_NOT_VERIFIED' });
    });
    prisma.$transaction.mockClear();
    await expect(
      service.submitPlayerJoinRequest(guardianDto({ password: 'Str0ng-Passw0rd!' }), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a PLAYER request's guardian e-mail must have a domain that receives mail", async () => {
    emailCode.assertDomainAcceptsMail.mockRejectedValue(
      new BadRequestException({ code: 'EMAIL_DOMAIN_INVALID' }),
    );
    const dto = CreatePlayerJoinRequestSchema.parse({
      tenantId: TENANT,
      requesterType: 'PLAYER',
      playerName: 'Player Name',
      contactEmail: 'player@example.test',
      guardianEmail: 'guardian@gmial.test',
      password: 'Str0ng-Passw0rd!',
      emailProof: 'proof',
    });
    await expect(service.submitPlayerJoinRequest(dto, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(emailCode.assertDomainAcceptsMail).toHaveBeenCalledWith(
      'guardian@gmial.test',
      'guardianEmail',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('signed in: no e-mail code is needed (the account already exists)', async () => {
    await service.submitPlayerJoinRequest(guardianDto(), USER);
    expect(emailCode.assertProof).not.toHaveBeenCalled();
  });

  it('anonymous without a password is refused before anything is written', async () => {
    await expect(service.submitPlayerJoinRequest(guardianDto(), undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('anonymous with an e-mail that already has an account must sign in first', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'someone-else' });

    await expect(
      service.submitPlayerJoinRequest(guardianDto({ password: 'Str0ng-Passw0rd!' }), undefined),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('anonymous account creation is rate limited per IP', async () => {
    redis.incrementRateLimit.mockResolvedValue({ count: 11, remainingTime: 100 });

    const attempt = service.submitPlayerJoinRequest(
      guardianDto({ password: 'Str0ng-Passw0rd!' }),
      undefined,
      '203.0.113.7',
    );
    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({ status: 429 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('signed in: the request is linked to the current account and no account is created', async () => {
    await service.submitPlayerJoinRequest(guardianDto({ password: 'ignored-Passw0rd!' }), USER);

    expect(prisma.withAuthLookupTransaction).toHaveBeenCalledWith(
      { actorUserId: USER },
      expect.any(Function),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(password.hash).not.toHaveBeenCalled();
    expect(tx.$queryRaw.mock.calls.map(sqlOf).join('\n')).not.toContain('INSERT INTO public.users');
  });

  it('maps database refusals to clear errors', async () => {
    tx.$queryRaw.mockRejectedValue(new Error('ERROR: PLAYER_PROFILE_EXISTS'));
    await expect(
      service.submitPlayerJoinRequest(guardianDto({ requesterType: 'PLAYER' }), USER),
    ).rejects.toBeInstanceOf(ConflictException);

    tx.$queryRaw.mockRejectedValue(new Error('ERROR: DUPLICATE_PENDING_REQUEST'));
    await expect(service.submitPlayerJoinRequest(guardianDto(), USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('a GUARDIAN request must name the guardian (shared schema)', () => {
    expect(() =>
      CreatePlayerJoinRequestSchema.parse({
        tenantId: TENANT,
        requesterType: 'GUARDIAN',
        playerName: 'Youssef Sharif',
        contactEmail: 'p@example.test',
      }),
    ).toThrow();
  });

  it('older clients without requesterType keep meaning PLAYER', () => {
    const dto = CreatePlayerJoinRequestSchema.parse({
      tenantId: TENANT,
      playerName: 'Youssef Sharif',
      contactEmail: 'p@example.test',
    });
    expect(dto.requesterType).toBe('PLAYER');
  });
});
