DELETE FROM "Bet" WHERE "oddsAtBet" = -999 OR "netProfit" <= -10000;
DELETE FROM "RealBetLog" WHERE "oddsAtBet" = -999;
