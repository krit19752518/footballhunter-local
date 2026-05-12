import 'package:flutter/material.dart';
import '../models/football_models.dart';
import 'package:intl/intl.dart';

class SignalCard extends StatelessWidget {
  final Signal signal;
  const SignalCard({super.key, required this.signal});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _getLogicColor(signal.logicType).withOpacity(0.1),
        border: Border.all(color: _getLogicColor(signal.logicType).withOpacity(0.5)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(signal.logicType, style: TextStyle(color: _getLogicColor(signal.logicType), fontWeight: FontWeight.bold)),
              Text(DateFormat('HH:mm').format(signal.createdAt), style: const TextStyle(fontSize: 12, color: Colors.white54)),
            ],
          ),
          const SizedBox(height: 8),
          Text(signal.message, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          if (signal.match != null) ...[
            const SizedBox(height: 4),
            Text('${signal.match!.homeTeam} vs ${signal.match!.awayTeam}', style: const TextStyle(fontSize: 12, color: Colors.white38)),
          ]
        ],
      ),
    );
  }

  Color _getLogicColor(String type) {
    switch (type) {
      case 'Logic 1': return Colors.redAccent;
      case 'Logic 2': return Colors.orangeAccent;
      case 'Logic 3': return Colors.greenAccent;
      case 'Logic 4': return Colors.blueAccent;
      case 'Logic 5': return Colors.purpleAccent;
      default: return Colors.white;
    }
  }
}
