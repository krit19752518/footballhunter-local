import { MatchService } from '../src/services/match.service';
import prisma from '../src/lib/prisma';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    match: { findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
    odds: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    oddsHistory: { create: jest.fn() }
  },
}));

const prismaMock = prisma as any;

describe('MatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should sync matches and create history when odds change', async () => {
    const mockRecord: any = {
      id: 4618036,
      sid: 1,
      nm: 'Team A vs Team B',
      lg: { na: 'League X', id: 11335 },
      ts: [{ na: 'Team A' }, { na: 'Team B' }],
      nsg: [{ tyg: 5, sc: [1, 0] }],
      bt: 1778495400000,
      mc: { s: 4411, tp: 1 },
      mg: [
        {
          nm: 'แฮนดิแคป',
          mty: 1000,
          mks: [
            {
              li: '0.5',
              op: [
                { ty: 1, od: 1.95 },
                { ty: 2, od: 1.85 }
              ]
            }
          ]
        }
      ]
    };

    prismaMock.match.findUnique.mockResolvedValue(null);
    prismaMock.match.upsert.mockResolvedValue({} as any);
    prismaMock.odds.findFirst.mockResolvedValue({
      id: 'odds-123',
      matchId: 4618036,
      type: 'HDP',
      line: '0.5',
      homeOdds: 1.80,
      awayOdds: 1.90,
    } as any);
    prismaMock.odds.upsert.mockResolvedValue({
      id: 'odds-123',
      matchId: 4618036,
      type: 'HDP',
      line: '0.5',
      homeOdds: 1.80,
      awayOdds: 1.90,
    } as any);

    await MatchService.syncMatches([mockRecord]);

    expect(prismaMock.match.upsert).toHaveBeenCalled();
    expect(prismaMock.odds.upsert).toHaveBeenCalled();
    expect(prismaMock.oddsHistory.create).toHaveBeenCalled();
  });
});
