import prisma from '../lib/prisma';

async function main() {
  console.log("🚀 Restoring active running real bets to database...");

  // 1. Create Matches if they don't exist
  const matchesData = [
    {
      id: 999901,
      leagueName: "ฟินแลนด์ ไวเคาส์ลีกา",
      homeTeam: "ลาห์ติ",
      awayTeam: "วาซัน พัลโลคูรา",
      name: "ลาห์ติ vs วาซัน พัลโลคูรา",
      startTime: new Date("2026-05-18T15:00:00.000Z"), // 22:00:00 +07:00
      status: "Live",
      matchTime: "45"
    },
    {
      id: 999902,
      leagueName: "โอมาน โปรเฟสชันนัล ลีก",
      homeTeam: "อิบรี",
      awayTeam: "ดูฟาร์",
      name: "อิบรี vs ดูฟาร์",
      startTime: new Date("2026-05-18T15:20:00.000Z"), // 22:20:00 +07:00
      status: "Live",
      matchTime: "45"
    }
  ];

  for (const match of matchesData) {
    await prisma.match.upsert({
      where: { id: match.id },
      update: match,
      create: match
    });
    console.log(`- Upserted Match: ${match.homeTeam} vs ${match.awayTeam}`);
  }

  // 2. Create Signals, Bets, and RealBetLogs
  const activeBets = [
    {
      realId: "real_restore_01",
      signalId: "sig_restore_01",
      matchId: 999901,
      matchName: "ลาห์ติ vs วาซัน พัลโลคูรา",
      leagueName: "ฟินแลนด์ ไวเคาส์ลีกา",
      betSide: "ลาห์ติ",
      line: "-0/0.5",
      odds: 2.58,
      amount: 10.00,
      createdAt: new Date("2026-05-18T16:03:25.000Z") // 23:03:25 +07:00
    },
    {
      realId: "real_restore_02",
      signalId: "sig_restore_02",
      matchId: 999902,
      matchName: "อิบรี vs ดูฟาร์",
      leagueName: "โอมาน โปรเฟสชันนัล ลีก",
      betSide: "ดูฟาร์",
      line: "-0/0.5",
      odds: 2.20,
      amount: 10.00,
      createdAt: new Date("2026-05-18T15:59:41.000Z") // 22:59:41 +07:00
    },
    {
      realId: "real_restore_03",
      signalId: "sig_restore_03",
      matchId: 999902,
      matchName: "อิบรี vs ดูฟาร์",
      leagueName: "โอมาน โปรเฟสชันนัล ลีก",
      betSide: "อิบรี",
      line: "+0/0.5",
      odds: 1.66,
      amount: 10.00,
      createdAt: new Date("2026-05-18T15:58:20.000Z") // 22:58:20 +07:00
    },
    {
      realId: "real_restore_04",
      signalId: "sig_restore_04",
      matchId: 999902,
      matchName: "อิบรี vs ดูฟาร์",
      leagueName: "โอมาน โปรเฟสชันนัล ลีก",
      betSide: "อิบรี",
      line: "+0/0.5",
      odds: 1.68,
      amount: 10.00,
      createdAt: new Date("2026-05-18T15:58:20.000Z") // 22:58:20 +07:00
    }
  ];

  for (const bet of activeBets) {
    // A. Create Signal
    await prisma.signal.upsert({
      where: { id: bet.signalId },
      update: {
        matchId: bet.matchId,
        logicType: "Restore",
        message: `Restore active bet side: ${bet.betSide} line: ${bet.line}`,
        matchTimeAtSignal: "34",
        value: bet.line,
        period: "FT",
        createdAt: bet.createdAt
      },
      create: {
        id: bet.signalId,
        matchId: bet.matchId,
        logicType: "Restore",
        message: `Restore active bet side: ${bet.betSide} line: ${bet.line}`,
        matchTimeAtSignal: "34",
        value: bet.line,
        period: "FT",
        createdAt: bet.createdAt
      }
    });

    // B. Create Mock Bet
    await prisma.bet.upsert({
      where: { signalId: bet.signalId },
      update: {
        matchId: bet.matchId,
        amount: bet.amount,
        oddsAtBet: bet.odds,
        lineAtBet: bet.line,
        betSide: bet.betSide,
        status: "Pending",
        autoBetStatus: "Executed",
        period: "FT",
        createdAt: bet.createdAt
      },
      create: {
        signalId: bet.signalId,
        matchId: bet.matchId,
        amount: bet.amount,
        oddsAtBet: bet.odds,
        lineAtBet: bet.line,
        betSide: bet.betSide,
        status: "Pending",
        autoBetStatus: "Executed",
        period: "FT",
        createdAt: bet.createdAt
      }
    });

    // C. Create RealBetLog
    await prisma.realBetLog.upsert({
      where: { id: bet.realId },
      update: {
        signalId: bet.signalId,
        matchName: bet.matchName,
        leagueName: bet.leagueName,
        betSide: bet.betSide,
        oddsAtBet: bet.odds,
        lineAtBet: bet.line,
        amount: bet.amount,
        status: "Executed",
        createdAt: bet.createdAt
      },
      create: {
        id: bet.realId,
        signalId: bet.signalId,
        matchName: bet.matchName,
        leagueName: bet.leagueName,
        betSide: bet.betSide,
        oddsAtBet: bet.odds,
        lineAtBet: bet.line,
        amount: bet.amount,
        status: "Executed",
        createdAt: bet.createdAt
      }
    });

    console.log(`- Upserted Signal, Bet, and RealBetLog for ${bet.matchName} (${bet.betSide})`);
  }

  console.log("🌟 Active bets restoration successfully finished!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
