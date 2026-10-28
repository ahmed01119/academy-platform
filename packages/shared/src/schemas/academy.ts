import { z } from 'zod';

export const UpdateAcademySettingsSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  logoUrl: z.string().trim().url('Invalid URL').optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().min(2).max(50).optional(),
});

export type UpdateAcademySettings = z.infer<typeof UpdateAcademySettingsSchema>;

export interface AcademyProfile {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  timezone: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    branches: number;
    memberships: number;
    players: number;
  };
}
