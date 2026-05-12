import 'package:flutter/material.dart';
import '../models/football_models.dart';

class MatchCard extends StatelessWidget {
  final FootballMatch match;
  const MatchCard({super.key, required this.match});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(match.leagueName, style: const TextStyle(fontSize: 12, color: Colors.blueAccent)),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Expanded(child: Text(match.homeTeam, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold))),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0),
                  child: Text('${match.scoreHome} - ${match.scoreAway}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.amber)),
                ),
                Expanded(child: Text(match.awayTeam, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold))),
              ],
            ),
            const SizedBox(height: 8),
            Text(match.status, style: const TextStyle(fontSize: 12, color: Colors.greenAccent)),
          ],
        ),
      ),
    );
  }
}
