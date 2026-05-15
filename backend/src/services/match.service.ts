import prisma from '../lib/prisma';
import { ApiMatchRecord } from '../types/api.types';

export class MatchService {
  static async syncMatches(records: ApiMatchRecord[]): Promise<number[]> {
    const updatedMatchIds: number[] = [];

    let skipCount = 0;
    for (const record of records) {
      if (record.sid !== 1 || !record.mc || record.mc.tp === 0 || record.mc.tp >= 100) {
        skipCount++;
        continue; // กรองเอาเฉพาะบอลจริง (Sport ID 1) และต้องกำลังเตะอยู่ (Live) เท่านั้น
      }
      updatedMatchIds.push(record.id);

      const homeTeam = record.ts[0]?.na || 'Unknown';
      const awayTeam = record.ts[1]?.na || 'Unknown';
      const fullTimeScore = record.nsg?.find((s: any) => s.tyg === 5)?.sc || [0, 0];
      
      // ดึงนาทีการแข่ง
      let minutes = 0;
      if (record.mc?.s) {
        minutes = Math.floor(record.mc.s / 60);
      } else if (record.mc?.tp) {
        // บางครั้ง API ไม่ส่งวินาทีมา แต่ส่ง period มา
        minutes = record.mc.tp === 1 ? 45 : (record.mc.tp === 2 ? 90 : 0);
      }
      
      const matchTimeStr = minutes > 0 ? minutes.toString() : '';

      // Find existing match to check HT scores
      const existingMatch = await prisma.match.findUnique({ where: { id: record.id } });
      const currentMinutes = parseInt(matchTimeStr || '0');
      const isHTor2H = record.mc?.tp === 2 || currentMinutes > 45 || matchTimeStr.includes('HT');
      
      let htScoreHome = existingMatch?.scoreHomeHT ?? 0;
      let htScoreAway = existingMatch?.scoreAwayHT ?? 0;

      // บันทึกสกอร์ครึ่งแรก ถ้ายังไม่มีการบันทึก และถึงเวลาแล้ว
      if (isHTor2H && htScoreHome === 0 && htScoreAway === 0) {
        htScoreHome = fullTimeScore[0];
        htScoreAway = fullTimeScore[1];
      }

      await prisma.match.upsert({
        where: { id: record.id },
        update: {
          name: `${homeTeam} vs ${awayTeam}`,
          leagueName: record.lg?.na || 'Unknown League',
          scoreHome: fullTimeScore[0],
          scoreAway: fullTimeScore[1],
          scoreHomeHT: htScoreHome,
          scoreAwayHT: htScoreAway,
          status: record.mc?.tp === 100 ? 'Finished' : 'Live',
          matchTime: matchTimeStr !== '' ? matchTimeStr : null,
          updatedAt: new Date()
        },
        create: {
          id: record.id,
          name: `${homeTeam} vs ${awayTeam}`,
          leagueName: record.lg?.na || 'Unknown League',
          homeTeam,
          awayTeam,
          startTime: new Date((record.st || 0) * 1000),
          scoreHome: fullTimeScore[0],
          scoreAway: fullTimeScore[1],
          scoreHomeHT: htScoreHome,
          scoreAwayHT: htScoreAway,
          status: 'Live',
          matchTime: matchTimeStr !== '' ? matchTimeStr : null
        }
      });

      // Sync Odds...
      if (record.mg) {
        for (const group of record.mg) {
          if (!group.mks) continue;
          
          let type = '';
          if (group.mty === 1000) type = 'HDP';
          else if (group.mty === 1001) type = 'FH-HDP';
          else if (group.mty === 1007) type = 'OU';
          else if (group.mty === 1008) type = 'FH-OU';
          else if (group.mty === 1005) type = '1X2';
          
          if (!type || type === '1X2') continue;

          for (const m of group.mks) {
            const line = m.li || '';
            let homeOdds: number | null = null;
            let awayOdds: number | null = null;
            let overOdds: number | null = null;
            let underOdds: number | null = null;
            
            if (type === 'HDP' || type === 'FH-HDP') {
              homeOdds = m.op.find((o: any) => o.ty === 1)?.od || null;
              awayOdds = m.op.find((o: any) => o.ty === 2)?.od || null;
            } else if (type === 'OU' || type === 'FH-OU') {
              overOdds = m.op.find((o: any) => o.ty === 4)?.od || null;
              underOdds = m.op.find((o: any) => o.ty === 5)?.od || null;
            }

            const odds = await prisma.odds.upsert({
              where: { id: `${record.id}_${type}_${line || 'main'}` },
              update: {
                line: line,
                homeOdds: homeOdds,
                awayOdds: awayOdds,
                overOdds: overOdds,
                underOdds: underOdds,
                updatedAt: new Date()
              },
              create: {
                id: `${record.id}_${type}_${line || 'main'}`,
                matchId: record.id,
                type,
                line: line,
                homeOdds: homeOdds,
                awayOdds: awayOdds,
                overOdds: overOdds,
                underOdds: underOdds
              }
            });

            await prisma.oddsHistory.create({
              data: {
                oddsId: odds.id,
                line: line,
                homeOdds: homeOdds,
                awayOdds: awayOdds,
                overOdds: overOdds,
                underOdds: underOdds
              }
            });
          }
        }
      }
    }

    if (skipCount > 0) {
      console.log(`[MATCH-SERVICE] Filtered out ${skipCount} non-soccer/virtual matches`);
    }

    // Cleanup: เปลี่ยนสถานะคู่ที่ไม่มีข้อมูลอัปเดตเกิน 2 นาที ให้เป็น Finished
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.match.updateMany({
      where: {
        status: 'Live',
        updatedAt: { lt: twoMinutesAgo }
      },
      data: {
        status: 'Finished',
        matchTime: 'FT'
      }
    });

    return updatedMatchIds;
  }
}
