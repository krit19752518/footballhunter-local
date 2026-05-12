import prisma from '../lib/prisma';

export class SignalService {
  static async checkSignals(matchId: number) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { odds: { include: { history: true } } }
    });

    if (!match) return;

    for (const odds of match.odds) {
      if (odds.type === 'HDP') {
        await this.checkStrongFavoriteDrop(match, odds);
        await this.checkLineShift(match, odds);
      } else if (odds.type === 'OU') {
        await this.checkLateOverGoal(match, odds);
      }
    }
  }

  private static async checkStrongFavoriteDrop(match: any, odds: any) {
    const history = odds.history.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    if (history.length < 2) return;

    const current = history[0];
    const previous = history[1];

    if (current.homeOdds < previous.homeOdds - 0.1 && current.homeOdds < 1.8) {
      await this.createSignal(match.id, 'Logic 1', `Strong Favorite Drop: ${match.homeTeam} odds dropped to ${current.homeOdds}`);
    }
  }

  private static async checkLineShift(match: any, odds: any) {
    const history = odds.history.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    if (history.length < 2) return;

    if (history[0].line !== history[1].line) {
      await this.createSignal(match.id, 'Logic 2', `Line Shift: ${match.name} HDP moved from ${history[1].line} to ${history[0].line}`);
    }
  }

  private static async checkLateOverGoal(match: any, odds: any) {
    if (match.status === 'Live' && odds.line === '0.5' && odds.overOdds < 1.7) {
      await this.createSignal(match.id, 'Logic 3', `Late Over Goal Opportunity: ${match.name} OU 0.5 at ${odds.overOdds}`);
    }
  }

  private static async createSignal(matchId: number, logicType: string, message: string) {
    const existing = await prisma.signal.findFirst({
      where: {
        matchId,
        logicType,
        createdAt: { gte: new Date(Date.now() - 1000 * 60 * 10) }
      }
    });

    if (!existing) {
      await prisma.signal.create({
        data: { matchId, logicType, message }
      });
      console.log(`[SIGNAL] ${logicType}: ${message}`);
    }
  }
}
