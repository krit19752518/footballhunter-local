import request from 'supertest';
import { app } from '../src/index';
import prisma from '../src/lib/prisma';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    match: {
      findMany: jest.fn(),
    },
    signal: {
      findMany: jest.fn(),
    }
  },
}));

const prismaMock = prisma as any;

describe('API Endpoints', () => {
  it('GET /matches should return a list of matches', async () => {
    const mockMatches = [{ id: 1, name: 'Match 1', odds: [], signals: [] }];
    prismaMock.match.findMany.mockResolvedValue(mockMatches);

    const response = await request(app).get('/matches');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockMatches);
  });

  it('GET /signals should return a list of signals', async () => {
    const mockSignals = [{ id: '1', logicType: 'Logic 1', match: {} }];
    prismaMock.signal.findMany.mockResolvedValue(mockSignals);

    const response = await request(app).get('/signals');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockSignals);
  });
});
