import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/signal_provider.dart';
import '../widgets/match_card.dart';
import '../widgets/signal_card.dart';
import '../widgets/bet_card.dart';
import '../utils/formatters.dart';
import 'bet_history_screen.dart';
import 'test_bot_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<SignalProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Football Hunter Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E293B),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            child: OutlinedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const TestBotScreen()),
                );
              },
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red, width: 2),
                foregroundColor: Colors.yellow,
              ),
              child: const Text('Test Auto-bot', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: ElevatedButton.icon(
              onPressed: () => provider.toggleBrowserReady(),
              icon: Icon(
                provider.isBrowserReady ? Icons.play_arrow : Icons.pause,
                color: Colors.white,
              ),
              label: Text(provider.isBrowserReady ? 'Auto-Bet: ON' : 'Apply Auto-Bet'),
              style: ElevatedButton.styleFrom(
                backgroundColor: provider.isBrowserReady ? Colors.green : Colors.orange,
                foregroundColor: Colors.white,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const BetHistoryScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => provider.fetchData(),
          ),
        ],
      ),
      body: Row(
        children: [
          // Left Side: Live Signals (Latest)
          Expanded(
            flex: 3,
            child: _buildSection(
              title: 'Live Signals (${Formatters.formatNumber(provider.signals.length)})',
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: provider.signals.length,
                itemBuilder: (context, index) => SignalCard(
                  signal: provider.signals[index],
                  runningNo: index + 1,
                ),
              ),
            ),
          ),
          
          // Middle Side: Compact Matches
          Expanded(
            flex: 2,
            child: _buildSection(
              title: 'Live Matches (${provider.matches.length})',
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: provider.matches.length,
                itemBuilder: (context, index) => MatchCard(match: provider.matches[index]),
              ),
            ),
          ),

          // Right Side: Betting Info (Pending Only)
          Expanded(
            flex: 2,
            child: _buildSection(
              title: 'กำลังเดิมพัน (${Formatters.formatNumber(provider.latestBets.length)} คู่)',
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: provider.latestBets.length,
                itemBuilder: (context, index) => BetCard(
                  bet: provider.latestBets[index],
                  runningNo: index + 1,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({required String title, required Widget child}) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: Colors.white10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white70)),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}
