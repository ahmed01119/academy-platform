import { describe, expect, it } from 'vitest';
import {
  CreateBranchSchema,
  UpdateBranchSchema,
  CreatePlayerSchema,
  UpdatePlayerSchema,
  CreateEnrollmentSchema,
  TransferBranchSchema,
  UpdateAcademySettingsSchema,
  PlayerGender,
  GuardianRelationship,
  PlayerStatus,
} from '../index';

describe('Sprint 2 Shared Schemas', () => {
  describe('Branch Schemas', () => {
    it('validates a valid create branch request', () => {
      const valid = {
        name: 'فرع المعادي',
        code: 'MAADI',
        city: 'القاهرة',
        country: 'EG',
        address: 'شارع النصر، المعادي',
        phone: '+201011112222',
        capacity: 150,
      };
      const parsed = CreateBranchSchema.parse(valid);
      expect(parsed.name).toBe('فرع المعادي');
      expect(parsed.code).toBe('MAADI');
      expect(parsed.capacity).toBe(150);
    });

    it('rejects invalid branch code with special characters', () => {
      const invalid = {
        name: 'Branch Name',
        code: 'BAD CODE!',
      };
      expect(() => CreateBranchSchema.parse(invalid)).toThrow();
    });

    it('validates partial update on branch', () => {
      const partial = {
        capacity: 200,
        status: 'INACTIVE' as const,
      };
      const parsed = UpdateBranchSchema.parse(partial);
      expect(parsed.capacity).toBe(200);
      expect(parsed.status).toBe('INACTIVE');
    });
  });

  describe('Player Schemas', () => {
    it('validates a valid player creation request with guardian', () => {
      const valid = {
        firstName: 'أحمد',
        lastName: 'محمد',
        gender: PlayerGender.MALE,
        dateOfBirth: '2014-06-15',
        nationalId: '31406150101234',
        emergencyContactName: 'محمد أحمد (الأب)',
        emergencyContactPhone: '+201099998888',
        medicalNotes: 'لا يعاني من أي أمراض مزمنة',
        primaryGuardian: {
          firstName: 'محمد',
          lastName: 'أحمد',
          relationship: GuardianRelationship.FATHER,
          phone: '+201099998888',
          email: 'father@example.com',
          isPrimary: true,
        },
        initialBranchId: '00000000-0000-4000-8000-000000000001',
        sport: 'FOOTBALL' as const,
      };
      const parsed = CreatePlayerSchema.parse(valid);
      expect(parsed.firstName).toBe('أحمد');
      expect(parsed.primaryGuardian.relationship).toBe(GuardianRelationship.FATHER);
    });

    it('rejects invalid date of birth format', () => {
      const invalid = {
        firstName: 'أحمد',
        lastName: 'محمد',
        gender: PlayerGender.MALE,
        dateOfBirth: '15/06/2014', // Invalid format, must be YYYY-MM-DD
        emergencyContactName: 'Contact',
        emergencyContactPhone: '+201000000000',
        primaryGuardian: {
          firstName: 'Guardian',
          lastName: 'Last',
          relationship: GuardianRelationship.MOTHER,
          phone: '+201000000000',
        },
        initialBranchId: '00000000-0000-4000-8000-000000000001',
      };
      expect(() => CreatePlayerSchema.parse(invalid)).toThrow();
    });

    it('validates partial player status update', () => {
      const update = {
        status: PlayerStatus.SUSPENDED,
      };
      const parsed = UpdatePlayerSchema.parse(update);
      expect(parsed.status).toBe(PlayerStatus.SUSPENDED);
    });
  });

  describe('Enrollment Schemas', () => {
    it('validates create enrollment request', () => {
      const valid = {
        playerId: '00000000-0000-4000-8000-000000000001',
        branchId: '00000000-0000-4000-8000-000000000002',
        sport: 'FOOTBALL' as const,
        startDate: '2026-10-20',
        notes: 'تسجيل في موسم الخريف',
      };
      const parsed = CreateEnrollmentSchema.parse(valid);
      expect(parsed.status).toBeUndefined(); // defaults applied on server
      expect(parsed.sport).toBe('FOOTBALL');
    });

    it('validates transfer branch request', () => {
      const valid = {
        targetBranchId: '00000000-0000-4000-8000-000000000003',
        effectiveDate: '2026-11-01',
        notes: 'نقل الفرع بسبب تغيير السكن',
      };
      const parsed = TransferBranchSchema.parse(valid);
      expect(parsed.targetBranchId).toBe('00000000-0000-4000-8000-000000000003');
    });
  });

  describe('Academy Settings Schema', () => {
    it('validates academy settings update', () => {
      const valid = {
        name: 'أكاديمية الأبطال لكرة القدم',
        phone: '+201022223333',
        email: 'info@heroes-academy.eg',
        address: 'التجمع الخامس، القاهرة الجديدة',
        currency: 'EGP',
        timezone: 'Africa/Cairo',
      };
      const parsed = UpdateAcademySettingsSchema.parse(valid);
      expect(parsed.name).toBe('أكاديمية الأبطال لكرة القدم');
      expect(parsed.currency).toBe('EGP');
    });
  });
});
