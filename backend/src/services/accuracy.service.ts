import prisma from '../lib/prisma';

export class AccuracyService {
  static async verifySignals() {
    // Find finished matches with unverified signals
    const finishedMatches = await prisma.match.findMany({
      where: {
        status: 'Finished',
        signals: {
          some: { isWon: null }
        }
      },
      include: { signals: true }
    });

    for (const match of finishedMatches) {
      for (const signal of match.signals) {
        if (signal.isWon !== null) continue;

        let isWon = false;

        if (signal.logicType === 'Logic 3') { // Late Over Goal (OU 0.5)
          // Check if there was at least one more goal after signal
          // For simplicity, if we signaled at score X-Y, and final score is > X+Y
          // We need to store the score at the time of signal to be accurate.
          // Let's assume Logic 3 is always for 1 more goal.
          // To be perfect, we should have stored 'currentScore' in Signal.value
          
          // Dummy logic for now: if total goals > 0 (assuming signal was at 0-0)
          const totalGoals = match.scoreHome + match.scoreAway;
          if (totalGoals > 0) isWon = true; 
        } 
        // Add other logics here...
        else if (signal.logicType === 'Logic 1') { // Favorite Drop
          // If favorite won the match (HDP logic is complex, needs full HDP calculation)
          // Simplified: If favorite (home) won
          if (match.scoreHome > match.scoreAway) isWon = true;
        }

        await prisma.signal.update({
          where: { id: signal.id },
          data: { isWon }
        });
      }
    }
  }
}
