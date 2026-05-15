import 'package:flutter/material.dart';
import '../models/football_models.dart';
import '../services/api_service.dart';
import '../utils/formatters.dart';
import '../widgets/bet_card.dart';

class BetHistoryScreen extends StatefulWidget {
  const BetHistoryScreen({super.key});

  @override
  State<BetHistoryScreen> createState() => _BetHistoryScreenState();
}

class _BetHistoryScreenState extends State<BetHistoryScreen> {
  DateTimeRange? _selectedDateRange;
  late Future<List<Bet>> _betsFuture;

  @override
  void initState() {
    super.initState();
    _betsFuture = ApiService.getBetHistory();
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
              });
            },
          ),
        ],
      ),
      body: FutureBuilder<List<Bet>>(
        future: _betsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.white)));
          }

          List<Bet> allBets = snapshot.data ?? [];
          
          // กรองข้อมูลตามช่วงวันที่เลือก
          List<Bet> filteredBets = allBets;
          if (_selectedDateRange != null) {
            final start = _selectedDateRange!.start;
            final end = _selectedDateRange!.end.add(const Duration(hours: 23, minutes: 59, seconds: 59));
            filteredBets = allBets.where((bet) {
              return bet.createdAt.isAfter(start) && bet.createdAt.isBefore(end);
            }).toList();
          }

          // กรองข้อมูลตามสถานะ
          List<Bet> pendingBets = filteredBets.where((b) => b.status == 'Pending').toList();
          List<Bet> wonBets = filteredBets.where((b) => b.status == 'Won').toList();
          List<Bet> lostBets = filteredBets.where((b) => b.status == 'Lost').toList();

          // เรียงตามเวลาล่าสุดในแต่ละกลุ่ม
          pendingBets.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          wonBets.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          lostBets.sort((a, b) => b.createdAt.compareTo(a.createdAt));

          if (filteredBets.isEmpty) {
            return const Center(child: Text('ไม่พบข้อมูลการเดิมพันในช่วงเวลาที่เลือก', style: TextStyle(color: Colors.white70)));
          }

          // คำนวณสถิติ
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
              ),
              Expanded(
                child: Row(
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
                                  'กำลังแข่งขัน (${Formatters.formatNumber(pendingBets.length)} คู่)',
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
                                  _buildSubColumn(
                                    title: 'ครึ่งแรก',
                                    bets: pendingBets.where((b) => b.period == 'FH').toList(),
                                    titleColor: Colors.yellowAccent.withOpacity(0.8),
                                  ),
                                  const VerticalDivider(width: 1, color: Colors.white10),
                                  _buildSubColumn(
                                    title: 'เต็มเวลา',
                                    bets: pendingBets.where((b) => b.period != 'FH').toList(), // รวม FT ทั้งหมดเป็นเต็มเวลา
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
  }) {
    int settledBets = winCount + loseCount;
    double winRate = settledBets > 0 ? (winCount / settledBets) * 100 : 0;

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
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('แทงทั้งหมด', '${Formatters.formatNumber(totalBets)} ไม้', Colors.white),
              _buildStatItem('ยอดแทงรวม', '${Formatters.formatCurrency(totalBetAmount)} ฿', Colors.orangeAccent),
              _buildStatItem('ยอดรับรวม', '${Formatters.formatCurrency(totalWonAmount)} ฿', Colors.greenAccent),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('ชนะ', Formatters.formatNumber(winCount), Colors.greenAccent),
              _buildStatItem('แพ้', Formatters.formatNumber(loseCount), Colors.redAccent),
              _buildStatItem('รอลุ้น', Formatters.formatNumber(pendingCount), Colors.white54),
              _buildStatItem('Win Rate', '${winRate.toStringAsFixed(1)}%', Colors.blueAccent),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
            decoration: BoxDecoration(
              color: netProfit >= 0 ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: netProfit >= 0 ? Colors.greenAccent : Colors.redAccent),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'กำไร/ขาดทุนสุทธิ: ',
                  style: TextStyle(fontSize: 16, color: Colors.white70),
                ),
                Text(
                  '${netProfit >= 0 ? '+' : ''}${Formatters.formatCurrency(netProfit)} บาท',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: netProfit >= 0 ? Colors.greenAccent : Colors.redAccent,
                  ),
                ),
              ],
            ),
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
}
