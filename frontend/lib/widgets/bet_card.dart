import 'package:flutter/material.dart';
import '../models/football_models.dart';
import '../utils/formatters.dart';

class BetCard extends StatelessWidget {
  final Bet bet;
  final int? runningNo;
  const BetCard({super.key, required this.bet, this.runningNo});

  @override
  Widget build(BuildContext context) {
    final bool isFinished = bet.status != 'Pending';
    final Color statusColor = bet.status == 'Won' ? Colors.greenAccent : (bet.status == 'Lost' ? Colors.redAccent : Colors.white54);
    
    String cleanBetSide = (bet.betSide ?? (bet.signal?.match?.homeTeam ?? 'Unknown'))
        .replaceAll('[ทีมรอง]', '')
        .replaceAll('[ทีมต่อ]', '')
        .trim();

    // กำหนดสีตามสถานะ Auto-Bet
    Color autoBetColor;
    IconData autoBetIcon;
    switch (bet.autoBetStatus) {
      case 'Executed':
        autoBetColor = Colors.greenAccent;
        autoBetIcon = Icons.check_circle_outline;
        break;
      case 'Failed':
        autoBetColor = Colors.redAccent;
        autoBetIcon = Icons.error_outline;
        break;
      case 'Paused':
        autoBetColor = Colors.orangeAccent;
        autoBetIcon = Icons.pause_circle_outline;
        break;
      default:
        autoBetColor = Colors.white24;
        autoBetIcon = Icons.help_outline;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  cleanBetSide,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.yellowAccent),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (runningNo != null)
                Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: Text(
                    'No.$runningNo',
                    style: const TextStyle(fontSize: 11, color: Colors.white38, fontWeight: FontWeight.bold),
                  ),
                ),
              Text(
                bet.status,
                style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${bet.signal?.match?.leagueName} | ${bet.signal?.match?.name}',
                  style: const TextStyle(fontSize: 10, color: Colors.white38),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Tooltip(
                message: bet.autoBetError ?? 'Auto-Bet Status: ${bet.autoBetStatus}',
                child: Row(
                  children: [
                    Icon(autoBetIcon, size: 12, color: autoBetColor),
                    const SizedBox(width: 4),
                    Text(
                      bet.autoBetStatus ?? '',
                      style: TextStyle(fontSize: 9, color: autoBetColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${Formatters.formatBetLine(bet.lineAtBet)} @ ${bet.oddsAtBet}',
            style: const TextStyle(fontSize: 12, color: Colors.white70),
          ),
          if (isFinished) ...[
            const Divider(color: Colors.white10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('ผลตอบแทน:', style: TextStyle(fontSize: 11, color: Colors.white38)),
                Text(
                  '${bet.netProfit! > 0 ? '+' : ''}${Formatters.formatCurrency(bet.netProfit!)} บาท',
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ] else
            const Text('สถานะ: กำลังแข่ง...', style: TextStyle(fontSize: 11, color: Colors.white38)),
        ],
      ),
    );
  }
}
