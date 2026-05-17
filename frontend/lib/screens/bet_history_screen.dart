import 'package:flutter/material.dart';
import '../models/football_models.dart';
import '../services/api_service.dart';
import '../utils/formatters.dart';
import '../widgets/bet_card.dart';
import '../widgets/signal_card.dart';

class BetHistoryScreen extends StatefulWidget {
  const BetHistoryScreen({super.key});

  @override
  State<BetHistoryScreen> createState() => _BetHistoryScreenState();
}

class _BetHistoryScreenState extends State<BetHistoryScreen> {
  DateTimeRange? _selectedDateRange;
  late Future<List<Bet>> _betsFuture;
  late Future<List<RealBetLog>> _realBetsFuture;
  late Future<List<Signal>> _signalsFuture;
  bool _showRealLogs = false;

  @override
  void initState() {
    super.initState();
    _betsFuture = ApiService.getBetHistory();
    _realBetsFuture = ApiService.getRealBetHistory();
    _signalsFuture = ApiService.getSignals();
  }

  Future<void> _selectDateRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _selectedDateRange,
    );

    if (picked != null && picked != _selectedDateRange) {
      setState(() {
        _selectedDateRange = picked;
      });
    }
  }

  void _clearDateRange() {
    setState(() {
      _selectedDateRange = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('สรุปผลการเดิมพัน', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E293B),
        actions: [
          if (_selectedDateRange != null)
            IconButton(
              icon: const Icon(Icons.clear, color: Colors.redAccent),
              tooltip: 'ล้างตัวกรองวันที่',
              onPressed: _clearDateRange,
            ),
          IconButton(
            icon: const Icon(Icons.date_range),
            tooltip: 'เลือกช่วงวันที่',
            onPressed: _selectDateRange,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() {
                _betsFuture = ApiService.getBetHistory();
                _realBetsFuture = ApiService.getRealBetHistory();
                _signalsFuture = ApiService.getSignals();
              });
            },
          ),
        ],
      ),
      body: FutureBuilder<List<dynamic>>(
        future: Future.wait([_betsFuture, _realBetsFuture, _signalsFuture]),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.white)));
          }

          List<Bet> allBets = snapshot.data?[0] ?? [];
          List<RealBetLog> allRealBets = snapshot.data?[1] ?? [];
          List<Signal> allSignals = snapshot.data?[2] ?? [];
          
          // กรองข้อมูลตามช่วงวันที่เลือก
          List<Bet> filteredBets = allBets;
          List<Signal> filteredSignals = allSignals;
          if (_selectedDateRange != null) {
            final start = _selectedDateRange!.start;
            final end = _selectedDateRange!.end.add(const Duration(hours: 23, minutes: 59, seconds: 59));
            filteredBets = allBets.where((bet) {
              return bet.createdAt.isAfter(start) && bet.createdAt.isBefore(end);
            }).toList();
            filteredSignals = allSignals.where((sig) {
              return sig.createdAt.isAfter(start) && sig.createdAt.isBefore(end);
            }).toList();
          }

          // เรียงตามเวลาล่าสุด
          filteredSignals.sort((a, b) => b.createdAt.compareTo(a.createdAt));

          // กรองข้อมูลตามสถานะ (ชนะ, แพ้ เอาเฉพาะที่แทงจริง)
          List<Bet> pendingBets = filteredBets.where((b) => b.status == 'Pending').toList();
          List<Bet> wonBets = filteredBets.where((b) => b.status == 'Won' && b.autoBetStatus == 'Executed').toList();
          List<Bet> lostBets = filteredBets.where((b) => b.status == 'Lost' && b.autoBetStatus == 'Executed').toList();

          // เรียงตามเวลาล่าสุดในแต่ละกลุ่ม
          pendingBets.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          wonBets.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          lostBets.sort((a, b) => b.createdAt.compareTo(a.createdAt));

          if (filteredBets.isEmpty) {
            return const Center(child: Text('ไม่พบข้อมูลการเดิมพันในช่วงเวลาที่เลือก', style: TextStyle(color: Colors.white70)));
          }

          // คำนวณสถิติ Mock Bot
          double totalBetAmount = 0;
          double totalWonAmount = 0;
          double netProfit = 0;
          int winCount = 0;
          int loseCount = 0;
          int pendingCount = 0;

          for (var bet in filteredBets) {
            totalBetAmount += bet.amount;
            netProfit += (bet.netProfit ?? 0);
            
            if (bet.status == 'Won') {
              winCount++;
              totalWonAmount += bet.amount + (bet.netProfit ?? 0);
            } else if (bet.status == 'Lost') {
              loseCount++;
            } else if (bet.status == 'Pending') {
              pendingCount++;
            }
          }

          // คำนวณสถิติ Real Bot
          List<RealBetLog> filteredRealBets = allRealBets;
          if (_selectedDateRange != null) {
            final start = _selectedDateRange!.start;
            final end = _selectedDateRange!.end.add(const Duration(hours: 23, minutes: 59, seconds: 59));
            filteredRealBets = allRealBets.where((bet) {
              return bet.createdAt.isAfter(start) && bet.createdAt.isBefore(end);
            }).toList();
          }

          int realTotalBets = 0;
          double realTotalBetAmount = 0;
          int realWinCount = 0;
          int realLoseCount = 0;
          int realPendingCount = 0;
          double realNetProfit = 0;

          for (var realBet in filteredRealBets) {
            if (realBet.status == 'Executed') {
              realTotalBets++;
              double amount = realBet.amount ?? 0;
              realTotalBetAmount += amount;

              // หา Bet ที่ตรงกันจาก mock bot เพื่อดูสถานะแพ้/ชนะ
              var mockBetMatch = allBets.where((b) => b.signalId == realBet.signalId).toList();
              if (mockBetMatch.isNotEmpty) {
                var mockBet = mockBetMatch.first;
                if (mockBet.status == 'Won') {
                  realWinCount++;
                  // กำไรสุทธิจากอัตราต่อรองของจริง (ถ้าไม่มีให้ใช้ 1.8 สมมติ)
                  double odds = realBet.oddsAtBet ?? 1.8;
                  realNetProfit += (amount * (odds - 1));
                } else if (mockBet.status == 'Lost') {
                  realLoseCount++;
                  realNetProfit -= amount; // ขาดทุนเต็มจำนวน
                } else {
                  realPendingCount++;
                }
              } else {
                realPendingCount++; // ถ้าไม่เจอสถานะถือว่ายังไม่เคลียร์
              }
            }
          }


          return Column(
            children: [
              _buildSummaryBoard(
                totalBets: filteredBets.length,
                totalBetAmount: totalBetAmount,
                totalWonAmount: totalWonAmount,
                netProfit: netProfit,
                winCount: winCount,
                loseCount: loseCount,
                pendingCount: pendingCount,
                realTotalBets: realTotalBets,
                realTotalBetAmount: realTotalBetAmount,
                realWinCount: realWinCount,
                realLoseCount: realLoseCount,
                realPendingCount: realPendingCount,
                realNetProfit: realNetProfit,
              ),
              // สวิตช์เลือกโหมดแสดงผล
              Container(
                color: const Color(0xFF1E293B),
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: !_showRealLogs ? const Color(0xFF3B82F6) : const Color(0xFF334155),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: () {
                        setState(() {
                          _showRealLogs = false;
                        });
                      },
                      icon: const Icon(Icons.analytics_outlined, size: 18),
                      label: const Text('Mock up Bot Details', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 16),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _showRealLogs ? const Color(0xFF3B82F6) : const Color(0xFF334155),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: () {
                        setState(() {
                          _showRealLogs = true;
                        });
                      },
                      icon: const Icon(Icons.playlist_add_check_circle_outlined, size: 18),
                      label: const Text('Real Bot Logs & Failures', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _showRealLogs
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildRealColumn(
                            title: 'แทงสำเร็จ (${Formatters.formatNumber(filteredRealBets.where((b) => b.status == 'Executed').length)} รายการ)',
                            logs: filteredRealBets.where((b) => b.status == 'Executed').toList(),
                            titleColor: Colors.greenAccent,
                          ),
                          _buildRealColumn(
                            title: 'แทงล้มเหลว (${Formatters.formatNumber(filteredRealBets.where((b) => b.status != 'Executed').length)} รายการ)',
                            logs: filteredRealBets.where((b) => b.status != 'Executed').toList(),
                            titleColor: Colors.redAccent,
                          ),
                        ],
                      )
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // คอลัมน์กำลังแข่งขัน (แยกครึ่งแรก/ครึ่งหลัง)
                          Expanded(
                            flex: 2, // ขยายพื้นที่ให้กว้างขึ้นสำหรับ 2 คอลัมน์ย่อย
                            child: Container(
                              decoration: const BoxDecoration(
                                border: Border(right: BorderSide(color: Colors.white10)),
                              ),
                              child: Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    width: double.infinity,
                                    color: Colors.white.withOpacity(0.02),
                                    child: Center(
                                      child: Text(
                                        'กำลังแข่งขัน (${Formatters.formatNumber(filteredSignals.length)} คู่)',
                                        style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.yellowAccent,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const Divider(height: 1, color: Colors.white10),
                                  Expanded(
                                    child: Row(
                                      children: [
                                        _buildSignalsSubColumn(
                                          title: 'Live Signals',
                                          signals: filteredSignals,
                                          titleColor: Colors.yellowAccent.withOpacity(0.8),
                                        ),
                                        const VerticalDivider(width: 1, color: Colors.white10),
                                        _buildSubColumn(
                                          title: 'รอลุ้น',
                                          bets: pendingBets,
                                          titleColor: Colors.orangeAccent,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          _buildColumn(
                            title: 'ชนะ (${Formatters.formatNumber(wonBets.length)} คู่)',
                            bets: wonBets,
                            titleColor: Colors.greenAccent,
                          ),
                          _buildColumn(
                            title: 'แพ้ (${Formatters.formatNumber(lostBets.length)} คู่)',
                            bets: lostBets,
                            titleColor: Colors.redAccent,
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

  Widget _buildSummaryBoard({
    required int totalBets,
    required double totalBetAmount,
    required double totalWonAmount,
    required double netProfit,
    required int winCount,
    required int loseCount,
    required int pendingCount,
    required int realTotalBets,
    required double realTotalBetAmount,
    required int realWinCount,
    required int realLoseCount,
    required int realPendingCount,
    required double realNetProfit,
  }) {
    int settledBets = winCount + loseCount;
    double winRate = settledBets > 0 ? (winCount / settledBets) * 100 : 0;

    int realSettledBets = realWinCount + realLoseCount;
    double realWinRate = realSettledBets > 0 ? (realWinCount / realSettledBets) * 100 : 0;

    return Container(
      padding: const EdgeInsets.all(20),
      color: const Color(0xFF1E293B),
      child: Column(
        children: [
          if (_selectedDateRange != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16.0),
              child: Text(
                'ข้อมูลระหว่างวันที่: ${_selectedDateRange!.start.toString().split(' ')[0]} ถึง ${_selectedDateRange!.end.toString().split(' ')[0]}',
                style: const TextStyle(color: Colors.yellowAccent, fontWeight: FontWeight.bold),
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Mock up Bot Box
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.redAccent.withOpacity(0.5), width: 1.5),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.black12,
                  ),
                  child: Column(
                    children: [
                      const Text('Mock up Bot', style: TextStyle(color: Colors.yellowAccent, fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatItem('แทงทั้งหมด', '${Formatters.formatNumber(totalBets)} ไม้', Colors.white),
                          _buildStatItem('ยอดแทงรวม', '${Formatters.formatCurrency(totalBetAmount)} ฿', Colors.orangeAccent),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatItem('ชนะ', Formatters.formatNumber(winCount), Colors.greenAccent),
                          _buildStatItem('แพ้', Formatters.formatNumber(loseCount), Colors.redAccent),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                        decoration: BoxDecoration(
                          color: netProfit >= 0 ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: netProfit >= 0 ? Colors.greenAccent : Colors.redAccent),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('กำไร/ขาดทุนสุทธิ: ', style: TextStyle(fontSize: 14, color: Colors.white70)),
                            Text(
                              '${netProfit >= 0 ? '+' : ''}${Formatters.formatCurrency(netProfit)} บาท',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: netProfit >= 0 ? Colors.greenAccent : Colors.redAccent),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Real Bot Box
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.redAccent.withOpacity(0.5), width: 1.5),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.black12,
                  ),
                  child: Column(
                    children: [
                      const Text('Real Bot', style: TextStyle(color: Colors.yellowAccent, fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatItem('แทงสำเร็จ', '${Formatters.formatNumber(realTotalBets)} ไม้', Colors.white),
                          _buildStatItem('ยอดแทงรวม', '${Formatters.formatCurrency(realTotalBetAmount)} ฿', Colors.orangeAccent),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatItem('ชนะ', Formatters.formatNumber(realWinCount), Colors.greenAccent),
                          _buildStatItem('แพ้', Formatters.formatNumber(realLoseCount), Colors.redAccent),
                          _buildStatItem('รอลุ้น', Formatters.formatNumber(realPendingCount), Colors.white54),
                          _buildStatItem('Win Rate', '${realWinRate.toStringAsFixed(1)}%', Colors.blueAccent),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                        decoration: BoxDecoration(
                          color: realNetProfit >= 0 ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: realNetProfit >= 0 ? Colors.greenAccent : Colors.redAccent),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('กำไร/ขาดทุนสุทธิ: ', style: TextStyle(fontSize: 14, color: Colors.white70)),
                            Text(
                              '${realNetProfit >= 0 ? '+' : ''}${Formatters.formatCurrency(realNetProfit)} บาท',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: realNetProfit >= 0 ? Colors.greenAccent : Colors.redAccent),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color valueColor) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.white54)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: valueColor)),
      ],
    );
  }

  Widget _buildSubColumn({required String title, required List<Bet> bets, required Color titleColor}) {
    return Expanded(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: Text(
              title,
              style: TextStyle(color: titleColor, fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              itemCount: bets.length,
              itemBuilder: (context, index) => BetCard(
                bet: bets[index],
                runningNo: index + 1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignalsSubColumn({required String title, required List<Signal> signals, required Color titleColor}) {
    return Expanded(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: Text(
              title,
              style: TextStyle(color: titleColor, fontWeight: FontWeight.bold),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              itemCount: signals.length,
              itemBuilder: (context, index) => SignalCard(
                signal: signals[index],
                runningNo: index + 1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildColumn({required String title, required List<Bet> bets, required Color titleColor}) {
    return Expanded(
      child: Container(
        decoration: const BoxDecoration(
          border: Border(right: BorderSide(color: Colors.white10)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              width: double.infinity,
              color: Colors.white.withOpacity(0.02),
              child: Center(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: titleColor,
                  ),
                ),
              ),
            ),
            const Divider(height: 1, color: Colors.white10),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: bets.length,
                itemBuilder: (context, index) => BetCard(
                  bet: bets[index],
                  runningNo: index + 1,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRealColumn({required String title, required List<RealBetLog> logs, required Color titleColor}) {
    return Expanded(
      child: Container(
        decoration: const BoxDecoration(
          border: Border(right: BorderSide(color: Colors.white10)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              width: double.infinity,
              color: Colors.white.withOpacity(0.02),
              child: Center(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: titleColor,
                  ),
                ),
              ),
            ),
            const Divider(height: 1, color: Colors.white10),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: logs.length,
                itemBuilder: (context, index) => _buildRealBetLogCard(logs[index], index + 1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRealBetLogCard(RealBetLog log, int runningNo) {
    final isSuccess = log.status == 'Executed';
    final Color cardColor = isSuccess ? Colors.greenAccent : Colors.redAccent;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: cardColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  log.betSide ?? 'Unknown',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.yellowAccent),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                'No.$runningNo',
                style: const TextStyle(fontSize: 11, color: Colors.white38, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: cardColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  log.status ?? 'Failed',
                  style: TextStyle(color: cardColor, fontWeight: FontWeight.bold, fontSize: 10),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${log.leagueName} | ${log.matchName}',
            style: const TextStyle(fontSize: 10, color: Colors.white38),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'จำนวนเดิมพัน: ${log.amount ?? 10} ฿',
                style: const TextStyle(fontSize: 11, color: Colors.white70),
              ),
              if (log.oddsAtBet != null)
                Text(
                  'ค่าน้ำจริง: @${log.oddsAtBet}',
                  style: const TextStyle(fontSize: 11, color: Colors.greenAccent, fontWeight: FontWeight.bold),
                ),
            ],
          ),
          if (!isSuccess && log.errorMessage != null) ...[
            const Divider(color: Colors.white10),
            Container(
              padding: const EdgeInsets.all(8),
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.redAccent.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'สาเหตุความล้มเหลว:',
                    style: TextStyle(fontSize: 10, color: Colors.redAccent, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    log.errorMessage!,
                    style: const TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('เวลาทำรายการ:', style: TextStyle(fontSize: 10, color: Colors.white38)),
              Text(
                log.createdAt.toLocal().toString().split('.')[0],
                style: const TextStyle(fontSize: 10, color: Colors.white54),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
