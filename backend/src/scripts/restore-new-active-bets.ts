import prisma from '../lib/prisma';

async function main() {
  console.log("🚀 Restoring NEW active running real bets to database...");

  const activeBets = [
    {
      realId: "real_restore_new_01",
      signalId: "cmpbfbal903nqpoxslcife6nf",
      matchId: 4666286,
      matchName: "PFK เบโร สตาร่า ซาโกร่า vs เซปเตมวรี โซเฟีย",
      leagueName: "บัลแกเรีย เฟิสต์ โปรเฟสชันนัล ลีก-รอบเพลย์ออฟ",
      betSide: "เซปเตมวรี โซเฟีย",
      line: "0",
      odds: 2.02,
      amount: 10.00,
      createdAt: new Date("2026-05-18T16:58:38.000Z") // 23:58:38 +07:00
    },
    {
      realId: "real_restore_new_02",
      signalId: "cmpbfas7w03fheazrr39m01ej",
      matchId: 4666277,
      matchName: "SJK Akatemia II vs VPS II",
      leagueName: "ฟินแลนด์ คักโคเนน",
      betSide: "SJK Akatemia II",
      line: "0",
      odds: 2.31,
      amount: 10.00,
      createdAt: new Date("2026-05-18T16:56:53.000Z") // 23:56:53 +07:00
    },
    {
      realId: "real_restore_new_03",
      signalId: "cmpbfsmoe06bhpoxss3kj9c7u",
      matchId: 4666278,
      matchName: "พุชช่า นิโปโลมิเช่ vs LKS ลอดส์",
      leagueName: "โปแลนด์ ลีกา 1",
      betSide: "พุชช่า นิโปโลมิเช่",
      line: "+0.5",
      odds: 1.49,
      amount: 10.00,
      createdAt: new Date("2026-05-18T16:54:27.000Z") // 23:54:27 +07:00
    }
  ];

  for (const bet of activeBets) {
    // 1. Double check the Match exists
    const match = await prisma.match.findUnique({
      where: { id: bet.matchId }
    });

    if (!match) {
      console.log(`⚠️ Match ${bet.matchId} not found in DB! Skipping...`);
      continue;
    }

    // 2. Double check the Signal exists
    const signal = await prisma.signal.findUnique({
      where: { id: bet.signalId }
    });

    if (!signal) {
      console.log(`⚠️ Signal ${bet.signalId} not found in DB! Skipping...`);
      continue;
    }

    // 3. Upsert Bet record linked to this signal
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

    // 4. Upsert RealBetLog record
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

    console.log(`✅ Restored active bet for Match: ${bet.matchName} (${bet.betSide})`);
  }

  console.log("🌟 Restoring active bets successfully finished!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
