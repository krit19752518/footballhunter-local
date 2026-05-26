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
      }
      // [ปรับปรุง] ลบ Late Over Goal signal - False signal มากเกินไป, Line 0.5 ขาดทุนเยอะ
    }
  }

  private static async checkStrongFavoriteDrop(match: any, odds: any) {
    const minutes = parseInt(match.matchTime || '0');
    
    // (ลบการจำกัดเวลา 60-75 นาทีออก เพื่อให้ประมวลผลได้ทุกนาที)
    
    const history = odds.history;
    if (history.length < 3) return; 

    const current = history[0];
    const oldest = history[history.length - 1]; 

    const diff = (oldest.homeOdds || 0) - (current.homeOdds || 0);

    // [ข้อ 2 & 5] ปรับ Threshold ตาม Line: Line 0 ต้อง drop >= 0.10, Line อื่น >= 0.05
    const lineVal = parseFloat(odds.line || '0');
    const requiredDrop = (Math.abs(lineVal) < 0.01) ? 0.10 : 0.05;

    if (diff >= requiredDrop) {
      const oddsOption = {
        recommended: current.homeOdds || 1.8,
        opposite: current.awayOdds || 1.8
      };
      const betSide = match.homeTeam;
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `📈 ต่อไหลแรง: ${match.homeTeam} ราคาลดเหลือ ${current.homeOdds} (ไหลลง ${diff.toFixed(2)}) 🔥 วางเดิมพัน ${betSide}`, oddsOption, odds.line, betSide, odds.type);
    }
  }

  private static async checkLineShift(match: any, odds: any) {
    const minutes = parseInt(match.matchTime || '0');
    
    // (ลบการจำกัดเวลา 60-75 นาทีออก)
    
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
      
    // (อนุญาตลายน์บวกและลายน์อ่อนให้ผ่านได้)
      
      await this.createSignalAndBet(match, 'แฮนดิแคป (HDP)', `🚧 ขยับกำแพง: แต้มต่อ ${direction} (${history[history.length - 1].line} -> ${history[0].line}) 🔥 ${rec}`, oddsOption, history[0].line, betSide, odds.type);
    }
  }

  // [ปรับปรุง] ลบ Late Over Goal signal - False signal มากเกินไป (ลบทั้งฟังก์ชัน)

  private static async createSignalAndBet(match: any, logicType: string, message: string, oddsOption: { recommended: number; opposite: number }, lineAtBet: string, betSide: string, oddsType: string) {
    // (ลบการบล็อกครึ่งแรก, การบล็อกเวลา, การแบนลีก, และการจำกัดราคาติดลบ ออกทั้งหมด)
    const currentMinutes = parseInt(match.matchTime || '0');

    // (ลบ Safety Guard เดิมออกเพื่อให้โหมด OPPOSITE สามารถทำงานร่วมกับกฎ Negative Handicap ได้)

    const fullLogicType = `${logicType} [${lineAtBet}]`;
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
          period: period,
          value: `${match.scoreHome}-${match.scoreAway}`
        }
      });
      
      // 1. อ่านการตั้งค่า Mode จาก Environment Variable (ค่าเริ่มต้นเป็น FOLLOW)
      const betMode = (process.env.BET_MODE || 'FOLLOW').toUpperCase();
      const isOpposite = betMode === 'OPPOSITE';

      // 2. กำหนดฝั่งเดิมพันและราคาตาม Mode
      let finalBetSide = betSide;
      let finalOdds = oddsOption.recommended;
      let finalLineAtBet = lineAtBet;

      if (isOpposite) {
        finalOdds = oddsOption.opposite;
        
        // ฟังก์ชันช่วยสลับเครื่องหมาย +/- สำหรับแฮนดิแคป
        const flipSign = (line: string) => {
          if (line === '0' || line === '0.0' || line === '0.00' || line === '0/0.5') {
            // กรณีพิเศษ ถ้าเดิมส่งมาไม่มีเครื่องหมาย ให้ถือว่าเป็นบวก แล้วกลับเป็นลบ
            if (line === '0/0.5') return '-0/0.5';
            return line; 
          }
          if (line.startsWith('+')) return line.replace('+', '-');
          if (line.startsWith('-')) return line.replace('-', '+');
          // ถ้าไม่มีเครื่องหมาย (เช่น 0.5) ให้เติมลบไปข้างหน้า (กลายเป็น -0.5)
          return '-' + line;
        };

        if (betSide === match.homeTeam) {
          finalBetSide = match.awayTeam;
          finalLineAtBet = flipSign(lineAtBet);
        } else if (betSide === match.awayTeam) {
          finalBetSide = match.homeTeam;
          finalLineAtBet = flipSign(lineAtBet);
        } else if (betSide.includes('สูง')) {
          finalBetSide = '[ต่ำ]';
          // ราคา สูง/ต่ำ ไม่ต้องกลับเครื่องหมาย
        } else if (betSide.includes('ต่ำ')) {
          finalBetSide = '[สูง]';
          // ราคา สูง/ต่ำ ไม่ต้องกลับเครื่องหมาย
        }
      }

      const bet = await prisma.bet.create({
        data: {
          signalId: signal.id,
          matchId: match.id,
          amount: 10,
          oddsAtBet: finalOdds,
          lineAtBet: finalLineAtBet,
          betSide: finalBetSide, 
          status: 'Pending',
          period: period,
          autoBetStatus: 'Pending'
        }
      });

      // 3. กำหนดป้ายแสดงผล
      let sideLabel = finalBetSide;
      const modeTag = isOpposite ? 'แทงสวน' : 'แทงตาม';
      if (finalBetSide === match.homeTeam) sideLabel = `ทีมเหย้า (${modeTag})`;
      else if (finalBetSide === match.awayTeam) sideLabel = `ทีมเยือน (${modeTag})`;
      else if (finalBetSide.includes('สูง')) sideLabel = `สูง (${modeTag})`;
      else if (finalBetSide.includes('ต่ำ')) sideLabel = `ต่ำ (${modeTag})`;

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

      const webLine = formatLine(finalLineAtBet);

      // ✅ ระบบใหม่: บันทึกเป็น Pending เพื่อให้ BrowserService ที่ตั้งค่า Ready ไปดึงข้อมูลมาแทงเอง (รองรับการเปิด 2 จอ Local/VPS)
      botLog(
        `[SIGNAL & BET] ✅ [ลีก: ${match.leagueName}] [คู่: ${match.name}] [ฝั่ง: ${sideLabel}] [ราคา: ${webLine}] [ช่วงเวลา: ${periodLabel}] (นาทีที่ ${match.matchTime}') [โหมด: ${betMode}] [betSide=${finalBetSide}] [lineAtBet=${finalLineAtBet}]`
      );

    } else {
      // Log ว่าข้ามเพราะเป็นคู่ซ้ำ (แต่ขยับข้อความให้ไม่รกจนเกินไป)
      // botLog(`[SIGNAL] Skipping duplicate signal for ${match.name} (Last seen < 15m ago)`);
    }
  }
}
