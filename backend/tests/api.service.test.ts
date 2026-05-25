import axios from 'axios';
import { ApiService } from '../src/services/api.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiService', () => {
  it('should fetch matches successfully', async () => {
    const mockData = {
      success: true,
      data: {
        records: [
          { id: 1, nm: 'Team A vs Team B', lg: { na: 'League X', id: 101 }, ts: [], nsg: [], mg: [], bt: Date.now(), mc: { s: 0 } }
        ]
      }
    };

    mockedAxios.post.mockResolvedValue({ data: mockData });

    const result = await ApiService.fetchMatches();

    expect(result.success).toBe(true);
    expect(result.data.records).toHaveLength(1);
    expect(result.data.records[0].nm).toBe('Team A vs Team B');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/match/getList'),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('should handle API failure gracefully', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network Error'));

    const result = await ApiService.fetchMatches();
    expect(result.success).toBe(false);
    expect(result.data.records).toHaveLength(0);
  });
});
