import prisma from '../lib/prisma';
import { SignalService } from '../services/signal.service';

async function main() {
  console.log("🧪 STARTING BET MODE VERIFICATION TEST...");

  const mockMatchId = 999999;

  // 1. Create a mock match
  const match = await prisma.match.create({
    data: {
      id: mockMatchId,
      name: "Mock Favorite FC vs Mock Underdog City",
      homeTeam: "Mock Favorite FC",
      awayTeam: "Mock Underdog City",
      leagueName: "Mock Test League",
      status: "Live",
      matchTime: "55",
      startTime: new Date(),
      scoreHome: 0,
      scoreAway: 0,
      odds: {
        create: [
          {
            type: "HDP",
            line: "-0.5",
            homeOdds: 1.6, // Flowed down
            awayOdds: 2.1,
            overOdds: 0,
            underOdds: 0,
            history: {
              create: [
                {
                  line: "-0.5",
                  homeOdds: 1.6, // Current
                  awayOdds: 2.1,
                  overOdds: 0,
                  underOdds: 0
                },
                {
                  line: "-0.5",
                  homeOdds: 1.7,
                  awayOdds: 2.0,
                  overOdds: 0,
                  underOdds: 0
                },
                {
                  line: "-0.5",
                  homeOdds: 1.8, // Oldest (diff is 1.8 - 1.6 = 0.2 >= 0.03)
                  awayOdds: 1.9,
                  overOdds: 0,
                  underOdds: 0
                }
              ]
            }
          }
        ]
      }
    },
    include: { odds: { include: { history: true } } }
  });

  console.log(`✅ Mock Match created: ${match.name}`);

  try {
    // Test 1: FOLLOW mode
    console.log("\n--- TEST 1: FOLLOW MODE ---");
    process.env.BET_MODE = 'FOLLOW';
    await SignalService.checkSignals(match.id);

    const bet1 = await prisma.bet.findFirst({
      where: { matchId: match.id },
      include: { signal: true }
    });

    if (bet1) {
      console.log(`[FOLLOW MODE RESULT]`);
      console.log(`  Signal Message: ${bet1.signal.message}`);
      console.log(`  Bet Side: ${bet1.betSide}`);
      console.log(`  Odds at Bet: ${bet1.oddsAtBet}`);
      console.log(`  Expected Side: Mock Favorite FC | Expected Odds: 1.6`);
      
      if (bet1.betSide?.includes("Mock Favorite FC") && bet1.oddsAtBet === 1.6) {
        console.log("🎉 SUCCESS: Follow mode works correctly!");
      } else {
        console.error("❌ FAILED: Follow mode side or odds mismatch.");
      }
    } else {
      console.error("❌ FAILED: No bet created in Follow mode.");
    }

    // Clean up signals and bets for second test
    await prisma.bet.deleteMany({ where: { matchId: match.id } });
    await prisma.signal.deleteMany({ where: { matchId: match.id } });

    // Test 2: OPPOSITE mode
    console.log("\n--- TEST 2: OPPOSITE MODE ---");
    process.env.BET_MODE = 'OPPOSITE';
    await SignalService.checkSignals(match.id);

    const bet2 = await prisma.bet.findFirst({
      where: { matchId: match.id },
      include: { signal: true }
    });

    if (bet2) {
      console.log(`[OPPOSITE MODE RESULT]`);
      console.log(`  Signal Message: ${bet2.signal.message}`);
      console.log(`  Bet Side: ${bet2.betSide}`);
      console.log(`  Odds at Bet: ${bet2.oddsAtBet}`);
      console.log(`  Expected Side: Mock Underdog City | Expected Odds: 2.1`);
      
      if (bet2.betSide?.includes("Mock Underdog City") && bet2.oddsAtBet === 2.1) {
        console.log("🎉 SUCCESS: Opposite mode works correctly!");
      } else {
        console.error("❌ FAILED: Opposite mode side or odds mismatch.");
      }
    } else {
      console.error("❌ FAILED: No bet created in Opposite mode.");
    }

  } finally {
    // 3. Clean up the database
    console.log("\n🧹 Cleaning up database...");
    await prisma.bet.deleteMany({ where: { matchId: match.id } });
    await prisma.signal.deleteMany({ where: { matchId: match.id } });
    await prisma.oddsHistory.deleteMany({ where: { odds: { matchId: match.id } } });
    await prisma.odds.deleteMany({ where: { matchId: match.id } });
    await prisma.match.delete({ where: { id: match.id } });
    console.log("🧹 Cleanup complete.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
