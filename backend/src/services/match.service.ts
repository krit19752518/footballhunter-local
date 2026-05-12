import prisma from '../lib/prisma';
import { ApiMatchRecord } from '../types/api.types';

export class MatchService {
  static async syncMatches(records: ApiMatchRecord[]) {
    for (const record of records) {
      const homeTeam = record.ts[0]?.na || 'Unknown';
      const awayTeam = record.ts[1]?.na || 'Unknown';
      const fullTimeScore = record.nsg.find(s => s.tyg === 5)?.sc || [0, 0];

      await prisma.match.upsert({
        where: { id: record.id },
        update: {
          scoreHome: fullTimeScore[0],
          scoreAway: fullTimeScore[1],
          status: record.mc.s > 0 ? 'Live' : 'Scheduled',
        },
        create: {
          id: record.id,
          name: record.nm,
          leagueName: record.lg.na,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          startTime: new Date(record.bt),
          scoreHome: fullTimeScore[0],
          scoreAway: fullTimeScore[1],
          status: record.mc.s > 0 ? 'Live' : 'Scheduled',
        },
      });

      for (const group of record.mg) {
        let type = '';
        if (group.nm === 'แฮนดิแคป') type = 'HDP';
        else if (group.nm === 'สูง/ต่ำ') type = 'OU';
        else if (group.nm === '1x2') type = '1X2';

        if (!type) continue;

        for (const market of group.mks) {
          const oddsData: any = {
            matchId: record.id,
            type: type,
            line: market.li || '',
          };

          if (type === 'HDP') {
            oddsData.homeOdds = market.op.find(o => o.ty === 1)?.od;
            oddsData.awayOdds = market.op.find(o => o.ty === 2)?.od;
          } else if (type === 'OU') {
            oddsData.overOdds = market.op.find(o => o.ty === 4)?.od;
            oddsData.underOdds = market.op.find(o => o.ty === 5)?.od;
          } else if (type === '1X2') {
            oddsData.homeOdds = market.op.find(o => o.ty === 1)?.od;
            oddsData.drawOdds = market.op.find(o => o.ty === 3)?.od;
            oddsData.awayOdds = market.op.find(o => o.ty === 2)?.od;
          }

          const existingOdds = await prisma.odds.findFirst({
            where: { matchId: record.id, type: type, line: oddsData.line }
          });

          if (existingOdds) {
            const hasChanged = 
              existingOdds.homeOdds !== oddsData.homeOdds ||
              existingOdds.awayOdds !== oddsData.awayOdds ||
              existingOdds.overOdds !== oddsData.overOdds ||
              existingOdds.underOdds !== oddsData.underOdds;

            if (hasChanged) {
              await prisma.odds.update({
                where: { id: existingOdds.id },
                data: oddsData
              });

              await prisma.oddsHistory.create({
                data: {
                  oddsId: existingOdds.id,
                  line: oddsData.line,
                  homeOdds: oddsData.homeOdds,
                  awayOdds: oddsData.awayOdds,
                  overOdds: oddsData.overOdds,
                  underOdds: oddsData.underOdds,
                  drawOdds: oddsData.drawOdds
                }
              });
            }
          } else {
            const newOdds = await prisma.odds.create({
              data: oddsData
            });

            await prisma.oddsHistory.create({
              data: {
                oddsId: newOdds.id,
                line: oddsData.line,
                homeOdds: oddsData.homeOdds,
                awayOdds: oddsData.awayOdds,
                overOdds: oddsData.overOdds,
                underOdds: oddsData.underOdds,
                drawOdds: oddsData.drawOdds
              }
            });
          }
        }
      }
    }
  }
}
