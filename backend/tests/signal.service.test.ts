import { SignalService } from '../src/services/signal.service';
import prisma from '../src/lib/prisma';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    match: { findUnique: jest.fn() },
    signal: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    bet: { create: jest.fn(), update: jest.fn() }
  },
}));

const prismaMock = prisma as any;

describe('SignalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger Logic 1 (Strong Favorite Drop) when odds drop significantly', async () => {
    const matchId = 123;
    const mockMatchWithHistory: any = {
      id: matchId,
      homeTeam: 'Favorite',
      awayTeam: 'Underdog',
      matchTime: '70',
      odds: [
        {
          type: 'HDP',
          line: '-0.5',
          history: [
            { createdAt: new Date(Date.now()), homeOdds: 1.6 },
            { createdAt: new Date(Date.now() - 1000), homeOdds: 1.7 },
            { createdAt: new Date(Date.now() - 2000), homeOdds: 1.8 }
          ]
        }
      ]
    };

    prismaMock.match.findUnique.mockResolvedValue(mockMatchWithHistory);
    prismaMock.signal.findFirst.mockResolvedValue(null);
    prismaMock.signal.findMany.mockResolvedValue([]);
    prismaMock.signal.create.mockResolvedValue({ id: 'sig-123' });
    prismaMock.bet.create.mockResolvedValue({ id: 'bet-123' });

    await SignalService.checkSignals(matchId);

    expect(prismaMock.signal.create).toHaveBeenCalled();
  });

  it('should trigger Logic 2 (Line Shift) when line changes', async () => {
    const matchId = 124;
    const mockMatchWithHistory: any = {
      id: matchId,
      name: 'Team A vs Team B',
      matchTime: '70',
      odds: [
        {
          type: 'HDP',
          history: [
            { createdAt: new Date(Date.now()), line: '-1.0', homeOdds: 0.8, awayOdds: 0.9 },
            { createdAt: new Date(Date.now() - 1000), line: '-0.5', homeOdds: 0.8, awayOdds: 0.9 }
          ]
        }
      ]
    };

    prismaMock.match.findUnique.mockResolvedValue(mockMatchWithHistory);
    prismaMock.signal.findFirst.mockResolvedValue(null);
    prismaMock.signal.findMany.mockResolvedValue([]);
    prismaMock.signal.create.mockResolvedValue({ id: 'sig-124' });
    prismaMock.bet.create.mockResolvedValue({ id: 'bet-124' });

    await SignalService.checkSignals(matchId);

    expect(prismaMock.signal.create).toHaveBeenCalled();
  });
});
