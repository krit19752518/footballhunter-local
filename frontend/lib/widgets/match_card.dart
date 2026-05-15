import 'package:flutter/material.dart';
import '../models/football_models.dart';

class MatchCard extends StatelessWidget {
  final FootballMatch match;
  const MatchCard({super.key, required this.match});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  match.leagueName,
                  style: const TextStyle(fontSize: 10, color: Colors.white38),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (match.status == 'Live')
                Row(
                  children: [
                    if (match.matchTime != null)
                      Text(
                        "${match.matchTime}' ",
                        style: const TextStyle(fontSize: 10, color: Colors.greenAccent, fontWeight: FontWeight.bold),
                      ),
                    const Icon(Icons.circle, size: 8, color: Colors.greenAccent),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  match.homeTeam,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.right,
                ),
              ),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 8),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${match.scoreHome} - ${match.scoreAway}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.yellowAccent),
                ),
              ),
              Expanded(
                child: Text(
                  match.awayTeam,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.left,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
