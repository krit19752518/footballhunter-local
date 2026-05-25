import { BrowserService } from '../src/services/browser.service';
import prisma from '../src/lib/prisma';

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    signal: { findUnique: jest.fn() },
    realBetLog: { create: jest.fn() },
    bet: { update: jest.fn() }
  },
}));

const prismaMock = prisma as any;

describe('BrowserService Live Verification Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractLiveScore', () => {
    it('should extract score successfully from layout pattern "0 - 2"', async () => {
      const mockPage: any = {
        locator: jest.fn().mockReturnValue({
          count: jest.fn().mockResolvedValue(1),
          nth: jest.fn().mockReturnValue({
            isVisible: jest.fn().mockResolvedValue(true),
            innerText: jest.fn().mockResolvedValue('0 - 2'),
            boundingBox: jest.fn().mockResolvedValue({ x: 10, y: 100, width: 50, height: 20 })
          })
        })
      };

      const result = await BrowserService.extractLiveScore(mockPage, 'Home', 'Away');
      expect(result).toEqual({ scoreHome: 0, scoreAway: 2 });
    });

    it('should extract score successfully from Header text evaluation fallback', async () => {
      const mockPage: any = {
        locator: jest.fn().mockImplementation((selector: string) => {
          if (selector === 'div, span, p') {
            return {
              count: jest.fn().mockResolvedValue(0)
            };
          }
          // สำหรับจำลอง Team locator
          return {
            filter: jest.fn().mockReturnValue({
              first: jest.fn().mockReturnValue({
                isVisible: jest.fn().mockResolvedValue(true),
                innerText: jest.fn().mockResolvedValue('Home Team'),
                elementHandle: jest.fn().mockResolvedValue({})
              })
            })
          };
        }),
        evaluate: jest.fn().mockResolvedValue('Some header text with Team A 1 - 3 Team B info')
      };

      const result = await BrowserService.extractLiveScore(mockPage, 'Team A', 'Team B');
      expect(result).toEqual({ scoreHome: 1, scoreAway: 3 });
    });
  });

  describe('getActualBalance', () => {
    it('should extract wallet balance from explicit selectors', async () => {
      const mockPage: any = {
        locator: jest.fn().mockReturnValue({
          first: jest.fn().mockReturnValue({
            isVisible: jest.fn().mockResolvedValue(true),
            innerText: jest.fn().mockResolvedValue('195.11 ฿')
          })
        })
      };
      mockPage.frames = jest.fn().mockReturnValue([mockPage]);

      // ใช้การ bind/call เพื่อเรียก static method ในสภาพแวดล้อมจำลอง
      const self = BrowserService as any;
      self.page = mockPage;
      self.lastBalance = null;

      const result = await BrowserService.getActualBalance();
      expect(result).toEqual(195.11);
    });

    it('should extract wallet balance from dynamically scanned header float values', async () => {
      const mockPage: any = {
        locator: jest.fn().mockReturnValue({
          first: jest.fn().mockReturnValue({
            isVisible: jest.fn().mockResolvedValue(false)
          })
        }),
        evaluate: jest.fn().mockResolvedValue(300.5)
      };
      mockPage.frames = jest.fn().mockReturnValue([mockPage]);

      const self = BrowserService as any;
      self.page = mockPage;
      self.lastBalance = null;

      const result = await BrowserService.getActualBalance();
      expect(result).toEqual(300.5);
    });
  });
});
