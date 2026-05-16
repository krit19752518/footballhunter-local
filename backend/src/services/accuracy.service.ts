import prisma from '../lib/prisma';

export class AccuracyService {
  static async verifySignals() {
    // ดึงคู่ที่จบแล้วและมี Bet ที่ยังค้างอยู่ (Pending)
    const pendingBets = await prisma.bet.findMany({
      where: { status: 'Pending' },
      include: {
        signal: { include: { match: true } }
      }
    });

    if (pendingBets.length > 0) {
      console.log(`[ACCURACY] Checking results for ${pendingBets.length} pending bets...`);
    }

    for (const bet of pendingBets) {
      const match = bet.signal.match;
      // รองรับทั้งสถานะ Finished และ FT
      if (match.status !== 'Finished' && match.matchTime !== 'FT') {
        // console.log(`[ACCURACY] Skipping ${match.name} - Status: ${match.status}, Time: ${match.matchTime}`);
        continue;
      }

      let status = 'Lost';
      let netProfit = -bet.amount;
      
      // --- Period-based logic ---
      let finalHome = 0;
      let finalAway = 0;

      if (bet.period === 'FH') {
        // ครึ่งแรก: ใช้สกอร์ครึ่งแรกที่บันทึกไว้
        finalHome = match.scoreHomeHT;
        finalAway = match.scoreAwayHT;
      } else {
        // เต็มเวลา / ครึ่งหลัง: ใช้สกอร์จบเกม
        finalHome = match.scoreHome || 0;
        finalAway = match.scoreAway || 0;
      }

      const totalGoals = finalHome + finalAway;
      const diff = finalHome - finalAway;
      
      const logicType = bet.signal.logicType || '';
      const betSide = bet.betSide || '';
      const lineStr = bet.lineAtBet || '0';
      const line = parseFloat(lineStr);

      if (logicType.includes('HDP')) {
        // คำนวณแบบ Handicap (ใช้ผลต่างสกอร์ในครึ่งนั้นๆ)
        if (betSide.includes('ทีมต่อ') || (betSide.includes(match.homeTeam) && !betSide.includes('ทีมรอง'))) {
          if (diff > line) {
            status = 'Won';
            netProfit = bet.amount * ((bet.oddsAtBet || 1.9) - 1);
          } else if (diff === line) {
            status = 'Draw';
            netProfit = 0;
          }
        } else {
          // แทงทีมรอง
          if (diff < line) {
            status = 'Won';
            netProfit = bet.amount * ((bet.oddsAtBet || 1.9) - 1);
          } else if (diff === line) {
            status = 'Draw';
            netProfit = 0;
          }
        }
      } else if (logicType.includes('O/U')) {
        // คำนวณแบบ Over/Under
        if (betSide.includes('สูง') || betSide.includes('Over')) {
          if (totalGoals > line) {
            status = 'Won';
            netProfit = bet.amount * ((bet.oddsAtBet || 1.8) - 1);
          } else if (totalGoals === line) {
            status = 'Draw';
            netProfit = 0;
          }
        } else if (betSide.includes('ต่ำ') || betSide.includes('Under')) {
          if (totalGoals < line) {
            status = 'Won';
            netProfit = bet.amount * ((bet.oddsAtBet || 1.8) - 1);
          } else if (totalGoals === line) {
            status = 'Draw';
            netProfit = 0;
          }
        }
      }

      await prisma.bet.update({
        where: { id: bet.id },
        data: {
          status,
          netProfit,
          settledAt: new Date()
        }
      });

      await prisma.signal.update({
        where: { id: bet.signalId },
        data: { isWon: status === 'Won' }
      });

      console.log(`[BET SETTLED] [ลีก: ${match.leagueName}] ${match.name}: ${status} | Score: ${finalHome}-${finalAway} | Side: ${betSide} | Line: ${lineStr}`);
    }
  }
}
