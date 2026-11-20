import { describe, expect, it } from 'vitest';
import { toPortalEvaluation } from './portal.service';

describe('toPortalEvaluation (player and guardian portals)', () => {
  const row = {
    id: '6f1d1f0e-4b8a-4c55-9a43-7b0a1c2d3e4f',
    evaluationDate: new Date('2026-11-10T00:00:00.000Z'),
    evaluatorUser: { name: 'Coach Omar' },
    overallScore: 8,
    technicalScore: 8.5,
    tacticalScore: 7.5,
    physicalScore: 8,
    behavioralScore: 9,
    strengths: 'Passing',
    areasForImprovement: 'Weak foot',
    guardianFeedback: 'Great week',
    suggestedGoals: 'Two-touch drills',
    privateCoachNotes: 'Staff only: discuss with the manager',
  };

  it('maps the visible fields and the evaluator name', () => {
    expect(toPortalEvaluation(row)).toEqual({
      id: row.id,
      evaluationDate: '2026-11-10',
      evaluatorName: 'Coach Omar',
      overallScore: 8,
      technicalScore: 8.5,
      tacticalScore: 7.5,
      physicalScore: 8,
      behavioralScore: 9,
      strengths: 'Passing',
      areasForImprovement: 'Weak foot',
      guardianFeedback: 'Great week',
      suggestedGoals: 'Two-touch drills',
    });
  });

  it('never copies private coach notes', () => {
    expect(JSON.stringify(toPortalEvaluation(row))).not.toContain('Staff only');
    expect(toPortalEvaluation(row)).not.toHaveProperty('privateCoachNotes');
  });
});
