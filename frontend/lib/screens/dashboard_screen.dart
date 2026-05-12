import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/signal_provider.dart';
import '../widgets/match_card.dart';
import '../widgets/signal_card.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Football Hunter Dashboard'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<SignalProvider>().refreshData(),
          ),
        ],
      ),
      body: Consumer<SignalProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.matches.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          return Row(
            children: [
              // Left side: Signals
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Live Signals', style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 16),
                      Expanded(
                        child: ListView.builder(
                          itemCount: provider.signals.length,
                          itemBuilder: (context, index) {
                            return SignalCard(signal: provider.signals[index]);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Right side: Matches
              Expanded(
                flex: 3,
                child: Container(
                  color: const Color(0xFF020617),
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Live Matches', style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 16),
                      Expanded(
                        child: GridView.builder(
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 1.5,
                            crossAxisSpacing: 16,
                            mainAxisSpacing: 16,
                          ),
                          itemCount: provider.matches.length,
                          itemBuilder: (context, index) {
                            return MatchCard(match: provider.matches[index]);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
