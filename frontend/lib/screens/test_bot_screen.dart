import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/signal_provider.dart';
import '../utils/formatters.dart';

class TestBotScreen extends StatelessWidget {
  const TestBotScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Auto-Bot Selection Test'),
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
      ),
      body: Consumer<SignalProvider>(
        builder: (context, provider, child) {
          final signals = provider.signals;
          final isRunning = provider.isTestRunning;

          return Column(
            children: [
              // 1. แถบสถานะด้านบน
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                color: isRunning ? Colors.orange.withOpacity(0.2) : Colors.blue.withOpacity(0.2),
                child: Row(
                  children: [
                    Icon(
                      isRunning ? Icons.play_circle_fill : Icons.info_outline,
                      color: isRunning ? Colors.orange : Colors.blue,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        provider.testStatus,
                        style: TextStyle(
                          color: isRunning ? Colors.orange : Colors.blue,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 2. ส่วนของรายการ Signals
              Expanded(
                flex: 3,
                child: signals.isEmpty
                    ? const Center(
                        child: Text(
                          'ไม่พบสัญญาณ Live ในขณะนี้',
                          style: TextStyle(color: Colors.white70),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: signals.length,
                        itemBuilder: (context, index) {
                          final s = signals[index];
                          final isSelected = provider.selectedSignalIds.contains(s.id);
                          final match = s.match;
                          final bet = s.bet;

                          if (match == null) return const SizedBox.shrink();

                          return Card(
                            color: const Color(0xFF1E293B),
                            margin: const EdgeInsets.only(bottom: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: isSelected ? Colors.orange : Colors.transparent,
                                width: 2,
                              ),
                            ),
                            child: CheckboxListTile(
                              enabled: !isRunning,
                              value: isSelected,
                              onChanged: (val) => provider.toggleSignalSelection(s.id),
                              activeColor: Colors.orange,
                              checkColor: Colors.black,
                              title: Text(
                                match.leagueName,
                                style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    match.name,
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      if (bet != null)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: Colors.orange.withOpacity(0.2),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            '${bet.betSide} [${Formatters.formatBetLine(bet.lineAtBet ?? "0")}]',
                                            style: const TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'นาทีที่ ${s.matchTimeAtSignal ?? "--"}\'',
                                        style: const TextStyle(color: Colors.greenAccent, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),

              // 3. หน้าต่าง Log Window (ใหม่!)
              if (isRunning || provider.testLogs.isNotEmpty)
                Expanded(
                  flex: 2,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.8),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.terminal, size: 16, color: Colors.greenAccent),
                            SizedBox(width: 8),
                            Text(
                              'Test Bot Logs',
                              style: TextStyle(color: Colors.greenAccent, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const Divider(color: Colors.white24),
                        Expanded(
                          child: ListView.builder(
                            reverse: true, // โชว์ล่าสุดไว้ล่างสุด
                            itemCount: provider.testLogs.length,
                            itemBuilder: (context, index) {
                              final log = provider.testLogs[provider.testLogs.length - 1 - index];
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Text(
                                  log,
                                  style: const TextStyle(
                                    color: Colors.white, 
                                    fontFamily: 'monospace', 
                                    fontSize: 11
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // 4. ส่วนของปุ่มควบคุมด้านล่าง
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: Color(0xFF1E293B),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Column(
                  children: [
                    // ปุ่ม START
                    SizedBox(
                      width: double.infinity,
                      height: 55,
                      child: ElevatedButton.icon(
                        onPressed: (isRunning || provider.selectedSignalIds.isEmpty)
                            ? null
                            : () => provider.startBulkTest(),
                        icon: const Icon(Icons.rocket_launch),
                        label: Text(
                          isRunning 
                            ? 'กำลังรันการทดสอบ...' 
                            : 'เริ่มต้นการทดสอบ (${provider.selectedSignalIds.length} คู่)',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange,
                          foregroundColor: Colors.black,
                          disabledBackgroundColor: Colors.grey.withOpacity(0.3),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        // ปุ่ม STOP / CLEAR
                        Expanded(
                          child: SizedBox(
                            height: 50,
                            child: OutlinedButton.icon(
                              onPressed: (isRunning || provider.selectedSignalIds.isNotEmpty)
                                  ? () => provider.clearTestQueue()
                                  : null,
                              icon: Icon(isRunning ? Icons.stop_circle : Icons.clear_all),
                              label: Text(isRunning ? 'STOP & CLEAR' : 'ล้างที่เลือก'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.redAccent,
                                side: const BorderSide(color: Colors.redAccent),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // ปุ่ม NEXT STEP
                        Expanded(
                          child: SizedBox(
                            height: 50,
                            child: ElevatedButton.icon(
                              onPressed: isRunning ? () => provider.nextStep() : null,
                              icon: const Icon(Icons.fast_forward),
                              label: const Text('NEXT STEP'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
