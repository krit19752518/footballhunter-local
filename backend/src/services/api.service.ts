import axios from 'axios';
import { ApiResponse } from '../types/api.types';

const API_URL = 'https://api.9x5t.com/v1/match/getList';

export class ApiService {
  private static headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    'authorization': 'tt_qNSL5c6QcbKSBaLHDcvg4vIOgYM8al1D.cf415ee1679537c73eca3130e34dd8fc',
    'content-type': 'application/json',
    'origin': 'https://www.bet5688q.com',
    'referer': 'https://www.bet5688q.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  };

  private static payload = {
    "languageType": "THA",
    "current": 1,
    "size": 50, // Increased size to get more matches
    "oddsType": 1,
    "orderBy": 0,
    "sportId": 1,
    "isPC": false,
    "type": 1,
    "sportTypes": [1, 2]
  };

  static async fetchMatches(): Promise<ApiResponse> {
    try {
      const response = await axios.post<ApiResponse>(API_URL, this.payload, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching matches:', error);
      throw error;
    }
  }
}
