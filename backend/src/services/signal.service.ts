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

    // ระบบคัดกรองลีก (Blacklist) ข้ามการทำงานหากเป็นลีกย่อย/เยาวชน/สมัครเล่น ที่มีความผันผวนของราคาสูง
    const blacklistWords = ['youth', 'u19', 'u20', 'u21', 'u23', 'women', 'หญิง', 'เยาวชน', 'reserve', 'amateur', 'สมัครเล่น', 'friendly', 'กระชับมิตร'];
    const leagueNameLower = match.leagueName.toLowerCase();
    const isBlacklisted = blacklistWords.some(word => leagueNameLower.includes(word));
    
    if (isBlacklisted) {
      return; // สั่งข้ามการเช็คสัญญาณทั้งหมดของคู่นี้
    }

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

    const homeDiff = (oldest.homeOdds || 0) - (current.homeOdds || 0);
    const awayDiff = (oldest.awayOdds || 0) - (current.awayOdds || 0);

    const THRESHOLD = 0.15; // ปรับเกณฑ์เป็น 0.15 เพื่อลดสัญญาณรบกวน (Noise) และหาการทุบราคาของจริง

    if (homeDiff >= THRESHOLD) {
      const oddsOption = {
        recommended: current.homeOdds || 1.8,
        opposite: current.awayOdds || 1.8
      };
      const betSide = match.homeTeam;
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `📈 ต่อไหลแรง: ${match.homeTeam} ราคาลดเหลือ ${current.homeOdds} (ไหลลง ${homeDiff.toFixed(2)}) 🔥 วางเดิมพัน ${betSide}`, oddsOption, odds.line, betSide, odds.type);
    } else if (awayDiff >= THRESHOLD) {
      const oddsOption = {
        recommended: current.awayOdds || 1.8,
        opposite: current.homeOdds || 1.8
      };
      const betSide = match.awayTeam;
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `📈 ต่อไหลแรง: ${match.awayTeam} ราคาลดเหลือ ${current.awayOdds} (ไหลลง ${awayDiff.toFixed(2)}) 🔥 วางเดิมพัน ${betSide}`, oddsOption, odds.line, betSide, odds.type);
    }
  }

  private static async checkLineShift(match: any, odds: any) {
    const history = odds.history;
    if (history.length < 2) return;

    if (history[0].line !== history[history.length - 1].line) {
      const currentLine = parseFloat(history[0].line || '0');
      const oldLine = parseFloat(history[history.length - 1].line || '0');
      
      const direction = currentLine > oldLine ? 'เพิ่มขึ้น' : 'ลดลง';
      const betSide = direction === 'เพิ่มขึ้น' ? match.homeTeam : match.awayTeam;
      const rec = `ตามไปที่ ${betSide}`;
      const oddsOption = {
        recommended: direction === 'เพิ่มขึ้น' ? (history[0].homeOdds || 0.9) : (history[0].awayOdds || 0.9),
        opposite: direction === 'เพิ่มขึ้น' ? (history[0].awayOdds || 0.9) : (history[0].homeOdds || 0.9)
      };
      
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `🚧 ขยับกำแพง: แต้มต่อ ${direction} (${history[history.length - 1].line} -> ${history[0].line}) 🔥 ${rec}`, oddsOption, history[0].line, betSide, odds.type);
    }
  }

  private static async checkLateOverGoal(match: any, odds: any) {
    const minutes = parseInt(match.matchTime || '0');
    
    // คำนวณผลต่างประตู หากเกมขาดแล้ว (ห่างกันเกิน 1 ลูก) ทีมจะไม่ค่อยบุก ให้ข้ามไป
    const scoreHome = match.scoreHome || 0;
    const scoreAway = match.scoreAway || 0;
    const goalDiff = Math.abs(scoreHome - scoreAway);
    
    // เสมอกัน หรือ ห่างกัน 1 ลูก (เช่น 0-0, 1-1, 1-0, 0-1) ถึงจะน่าลุ้นประตูท้ายเกม
    const isHighlyMotivated = goalDiff <= 1;

    if (match.status === 'Live' && odds.line === '0.5' && minutes >= 75 && (odds.overOdds || 0) < 2.0 && isHighlyMotivated) {
      const oddsOption = {
        recommended: odds.overOdds || 1.8,
        opposite: odds.underOdds || 1.8
      };
      const betSide = '[สูง]';
      await this.createSignalAndBet(match, 'สูง/ต่ำ (O/U)', `⏱️ สูงท้ายเกม: ${match.name} สูง 0.5 ราคา ${oddsOption.recommended} 🔥 กด ${betSide} ทันที`, oddsOption, odds.line, betSide, odds.type);
    }
  }

  private static async createSignalAndBet(match: any, logicType: string, message: string, oddsOption: { recommended: number; opposite: number }, lineAtBet: string, betSide: string, oddsType: string) {
    if (oddsType.startsWith('FH')) return;

    const fullLogicType = `${logicType} [${lineAtBet}]`;
    const currentMinutes = parseInt(match.matchTime || '0');
    const isSecondHalf = currentMinutes > 45 || match.matchTime?.includes('2H');

    // เช็คสัญญาณซ้ำในครึ่งเวลาเดียวกัน
    const signalsInThisHalf = await prisma.signal.findMany({
      where: { matchId: match.id, createdAt: { gte: new Date(Date.now() - 1000 * 60 * 120) } }
    });
    const alreadyBettedInThisHalf = signalsInThisHalf.some(s => {
      const signalMin = parseInt(s.matchTimeAtSignal || '0');
      return isSecondHalf === (signalMin > 45);
    });
    if (alreadyBettedInThisHalf) return;

    const existingSignal = await prisma.signal.findFirst({
      where: { matchId: match.id, logicType: fullLogicType, createdAt: { gte: new Date(Date.now() - 1000 * 60 * 5) } }
    });

    if (!existingSignal) {
      // 🟢 ประกาศตัวแปรเหล่านี้ด้วย let ไว้ที่จุดนี้ เพื่อให้ใช้ได้ทั่วทั้งบล็อก if นี้
      let finalOdds = oddsOption.recommended;
      let finalBetSide = betSide;
      const period = oddsType.startsWith('FH') ? 'FH' : 'FT';
      
      const periodTag = period === 'FH' ? '[ครึ่งแรก]' : '[เต็มเวลา]';
      let cleanMsg = message
        .replace(/[\(\[].*?(ครึ่งแรก|ครึ่งหลัง|เต็มเวลา|1H|2H).*?[\)\]]/g, '')
        .replace(/\s+/g, ' ').trim();
      const finalMessage = `${periodTag} ${cleanMsg}`;

      const signal = await prisma.signal.create({
        data: { matchId: match.id, logicType: fullLogicType, message: finalMessage, matchTimeAtSignal: match.matchTime || '0', period: period, value: `${match.scoreHome}-${match.scoreAway}` }
      });
      
      const betMode = (process.env.BET_MODE || 'FOLLOW').toUpperCase();
      const isOpposite = betMode === 'OPPOSITE';

      if (isOpposite) {
        finalOdds = oddsOption.opposite;
        if (betSide === match.homeTeam) finalBetSide = match.awayTeam;
        else if (betSide === match.awayTeam) finalBetSide = match.homeTeam;
        else if (betSide.includes('สูง')) finalBetSide = '[ต่ำ]';
        else if (betSide.includes('ต่ำ')) finalBetSide = '[สูง]';
      }

      const bet = await prisma.bet.create({
        data: { signalId: signal.id, matchId: match.id, amount: 10, oddsAtBet: finalOdds, lineAtBet: lineAtBet, betSide: finalBetSide, status: 'Pending', period: period }
      });

      // ส่วนการแสดงผลและ Trigger Auto-Bet
      let sideLabel = finalBetSide;
      const modeTag = isOpposite ? 'แทงสวน' : 'แทงตาม';
      if (finalBetSide === match.homeTeam) sideLabel = `ทีมเหย้า (${modeTag})`;
      else if (finalBetSide === match.awayTeam) sideLabel = `ทีมเยือน (${modeTag})`;
      else if (finalBetSide.includes('สูง')) sideLabel = `สูง (${modeTag})`;
      else if (finalBetSide.includes('ต่ำ')) sideLabel = `ต่ำ (${modeTag})`;

      const formatLine = (l: string) => { /* ... ฟังก์ชันเดิมของน้า ... */ return l; };
      const webLine = formatLine(lineAtBet);

      botLog(`[SIGNAL & BET] ✅ [ลีก: ${match.leagueName}] [คู่: ${match.name}] [ฝั่ง: ${sideLabel}] [ราคา: ${webLine}] [ช่วงเวลา: ${period}] (นาทีที่ ${match.matchTime}') [โหมด: ${betMode}]`);

      if (BrowserService.getStatus()) {
        try {
          await BrowserService.findAndBet(match.leagueName, match.name, finalBetSide, 10, lineAtBet, false, signal.id);
          await prisma.bet.update({ where: { id: bet.id }, data: { autoBetStatus: 'Queued' } });
        } catch (e: any) {
          await prisma.bet.update({ where: { id: bet.id }, data: { autoBetStatus: 'Failed', autoBetError: e.message } });
        }
      } else {
        await prisma.bet.update({ where: { id: bet.id }, data: { autoBetStatus: 'Paused' } });
      }
    }
  }
}
