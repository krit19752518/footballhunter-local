import { SignalService } from '../src/services/signal.service';
import prisma from '../src/lib/prisma';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    match: { findUnique: jest.fn() },
    signal: { findFirst: jest.fn(), create: jest.fn() }
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
      odds: [
        {
          type: 'HDP',
          history: [
            { createdAt: new Date(Date.now()), homeOdds: 1.6 },
            { createdAt: new Date(Date.now() - 1000), homeOdds: 1.8 }
          ]
        }
      ]
    };

    prismaMock.match.findUnique.mockResolvedValue(mockMatchWithHistory);
    prismaMock.signal.findFirst.mockResolvedValue(null);

    await SignalService.checkSignals(matchId);

    expect(prismaMock.signal.create).toHaveBeenCalled();
  });

  it('should trigger Logic 2 (Line Shift) when line changes', async () => {
    const matchId = 124;
    const mockMatchWithHistory: any = {
      id: matchId,
      name: 'Team A vs Team B',
      odds: [
        {
          type: 'HDP',
          history: [
            { createdAt: new Date(Date.now()), line: '1.0' },
            { createdAt: new Date(Date.now() - 1000), line: '0.5' }
          ]
        }
      ]
    };

    prismaMock.match.findUnique.mockResolvedValue(mockMatchWithHistory);
    prismaMock.signal.findFirst.mockResolvedValue(null);

    await SignalService.checkSignals(matchId);

    expect(prismaMock.signal.create).toHaveBeenCalled();
  });
});
