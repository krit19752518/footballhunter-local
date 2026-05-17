import prisma from '../lib/prisma';
import { BrowserService } from './browser.service';
import { botLog } from '../lib/logger';

export class SignalService {
  static async checkSignals(matchId: number) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { odds: { include: { history: { orderBy: { createdAt: 'desc' }, take: 20 } } } }
    });

    if (!match) return;

    for (const odds of match.odds) {
      if (odds.type === 'HDP' || odds.type === 'FH-HDP') {
        await this.checkStrongFavoriteDrop(match, odds);
        await this.checkLineShift(match, odds);
      } else if (odds.type === 'OU' || odds.type === 'FH-OU') {
        await this.checkLateOverGoal(match, odds);
      }
    }
  }

  private static async checkStrongFavoriteDrop(match: any, odds: any) {
    const history = odds.history;
    if (history.length < 3) return; 

    const current = history[0];
    const oldest = history[history.length - 1]; 

    const diff = (oldest.homeOdds || 0) - (current.homeOdds || 0);

    // ถ้าราคาไหลลงเกิน 0.03 (ปรับให้สัญญาณออกถี่ขึ้นเพื่อเทสระบบตามคำขอ)
    if (diff >= 0.03) {
      const reversedOdds = current.awayOdds || 1.8;
      const betSide = match.awayTeam;
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `📈 ต่อไหลแรง: ${match.homeTeam} ราคาลดเหลือ ${current.homeOdds} (ไหลลง ${diff.toFixed(2)}) 🔥 วางเดิมพัน ${betSide}`, reversedOdds, odds.line, betSide, odds.type);
    }
  }

  private static async checkLineShift(match: any, odds: any) {
    const history = odds.history;
    if (history.length < 2) return;

    if (history[0].line !== history[history.length - 1].line) {
      const currentLine = parseFloat(history[0].line || '0');
      const oldLine = parseFloat(history[history.length - 1].line || '0');
      
      const direction = currentLine > oldLine ? 'เพิ่มขึ้น' : 'ลดลง';
      const betSide = direction === 'เพิ่มขึ้น' ? match.awayTeam : match.homeTeam;
      const rec = `สวนไปที่ ${betSide}`;
      const reversedOdds = direction === 'เพิ่มขึ้น' ? (history[0].awayOdds || 0.9) : (history[0].homeOdds || 0.9);
      
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `🚧 ขยับกำแพง: แต้มต่อ ${direction} (${history[history.length - 1].line} -> ${history[0].line}) 🔥 ${rec}`, reversedOdds, history[0].line, betSide, odds.type);
    }
  }

  private static async checkLateOverGoal(match: any, odds: any) {
    const minutes = parseInt(match.matchTime || '0');
    
    if (match.status === 'Live' && odds.line === '0.5' && minutes >= 75 && (odds.overOdds || 0) < 2.0) {
      const targetOdds = odds.overOdds || 1.8;
      const betSide = '[สูง]';
      await this.createSignalAndBet(match, 'สูง/ต่ำ (O/U)', `⏱️ สูงท้ายเกม: ${match.name} สูง 0.5 ราคา ${targetOdds} 🔥 กด ${betSide} ทันที`, targetOdds, odds.line, betSide, odds.type);
    }
  }

  private static async createSignalAndBet(match: any, logicType: string, message: string, oddsAtBet: number, lineAtBet: string, betSide: string, oddsType: string) {
    const fullLogicType = `${logicType} [${lineAtBet}]`;
    const currentMinutes = parseInt(match.matchTime || '0');
    const isSecondHalf = currentMinutes > 45 || match.matchTime?.includes('2H');

    // 1. เช็คว่าครึ่งนี้มีการแทงไปหรือยัง (จำกัดครึ่งละ 1 ไม้ ตามคำขอ)
    const signalsInThisHalf = await prisma.signal.findMany({
      where: {
        matchId: match.id,
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 120) } // ย้อนหลัง 2 ชม. กันเหนียว
      }
    });

    const alreadyBettedInThisHalf = signalsInThisHalf.some(s => {
      const signalMin = parseInt(s.matchTimeAtSignal || '0');
      const sIsSecondHalf = signalMin > 45;
      return isSecondHalf === sIsSecondHalf;
    });

    if (alreadyBettedInThisHalf) {
      // botLog(`[SIGNAL] Skipping ${match.name} because already betted in this half.`);
      return;
    }

    // 2. เช็คซ้ำที่ตัวคู่บอลและฝั่งที่แทงในระยะเวลาสั้นๆ (กันกรณีสัญญาณซ้อนกันในวินาทีเดียวกัน)
    const existingSignal = await prisma.signal.findFirst({
      where: {
        matchId: match.id,
        logicType: fullLogicType,
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 5) }
      }
    });

    if (!existingSignal) {
      // 1. กำหนดประเภทช่วงเวลาให้ชัดเจน
      const period = oddsType.startsWith('FH') ? 'FH' : 'FT';
      const periodTag = period === 'FH' ? '[ครึ่งแรก]' : '[เต็มเวลา]';
      
      // 2. ล้างข้อความเดิมให้สะอาดที่สุด (กวาดล้างทุกคำที่เกี่ยวกับช่วงเวลา)
      let cleanMsg = message
        .replace(/[\(\[].*?ครึ่งแรก.*?[\)\]]/g, '')
        .replace(/[\(\[].*?ครึ่งหลัง.*?[\)\]]/g, '')
        .replace(/[\(\[].*?เต็มเวลา.*?[\)\]]/g, '')
        .replace(/[\(\[].*?1H.*?[\)\]]/g, '')
        .replace(/[\(\[].*?2H.*?[\)\]]/g, '')
        .replace(/\s+/g, ' ') 
        .trim();

      // 3. ประกอบข้อความใหม่ โดยเอา Tag ไว้หน้าสุดเพื่อให้เด่นชัด
      const finalMessage = `${periodTag} ${cleanMsg}`;

      // ลบ Log Recording ที่ซ้ำซ้อนออก
      const signal = await prisma.signal.create({
        data: { 
          matchId: match.id, 
          logicType: fullLogicType, 
          message: finalMessage,
          matchTimeAtSignal: match.matchTime || '0',
          period: period
        }
      });
      
      const bet = await prisma.bet.create({
        data: {
          signalId: signal.id,
          matchId: match.id,
          amount: 10,
          oddsAtBet: oddsAtBet,
          lineAtBet: lineAtBet,
          betSide: betSide,
          status: 'Pending',
          period: period
        }
      });

      // หาว่า betSide เป็น เหย้า หรือ เยือน
      let sideLabel = betSide;
      if (betSide === match.homeTeam) sideLabel = 'ทีมเหย้า';
      else if (betSide === match.awayTeam) sideLabel = 'ทีมเยือน';
      else if (betSide.includes('สูง')) sideLabel = 'สูง';
      else if (betSide.includes('ต่ำ')) sideLabel = 'ต่ำ';

      const periodLabel = period === 'FH' ? 'ครึ่งแรก' : 'เต็มเวลา';

      // ฟังก์ชันแปลงทศนิยมกลับเป็นราคาควบ (Handicap Format)
      const formatLine = (l: string) => {
        const v = parseFloat(l);
        if (isNaN(v)) return l;
        const absV = Math.abs(v);
        const sign = v < 0 ? '-' : (v > 0 ? '+' : '');
        const remainder = absV % 1;
        
        if (Math.abs(remainder - 0.25) < 0.01) {
          const base = Math.floor(absV);
          return `${sign}${base}/${base + 0.5}`;
        }
        if (Math.abs(remainder - 0.75) < 0.01) {
          const base = Math.floor(absV);
          return `${sign}${base + 0.5}/${base + 1}`;
        }
        return l;
      };

      const webLine = formatLine(lineAtBet);

      botLog(`[SIGNAL & BET] ✅ [ลีก: ${match.leagueName}] [คู่: ${match.name}] [ฝั่ง: ${sideLabel}] [ราคา: ${webLine}] [ช่วงเวลา: ${periodLabel}] (นาทีที่ ${match.matchTime}')`);

      // Trigger Auto-Bet if ready
      if (BrowserService.getStatus()) {
        botLog(`[AUTO-BET] Calling BrowserService.findAndBet for ${match.name}...`);
        try {
          await BrowserService.findAndBet(match.leagueName, match.name, betSide, 10, lineAtBet, false, signal.id);
          await prisma.bet.update({
            where: { id: bet.id },
            data: { autoBetStatus: 'Queued' }
          });
        } catch (e: any) {
          await prisma.bet.update({
            where: { id: bet.id },
            data: { autoBetStatus: 'Failed', autoBetError: e.message }
          });
        }
      } else {
        // ปิด Log Not Ready เพื่อความสะอาด
        await prisma.bet.update({
          where: { id: bet.id },
          data: { autoBetStatus: 'Paused' }
        });
      }
    } else {
      // Log ว่าข้ามเพราะเป็นคู่ซ้ำ (แต่ขยับข้อความให้ไม่รกจนเกินไป)
      // botLog(`[SIGNAL] Skipping duplicate signal for ${match.name} (Last seen < 15m ago)`);
    }
  }
}
