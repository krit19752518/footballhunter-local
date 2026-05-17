
import re
import os

screen_path = r'c:\FootballHunter2\frontend\lib\screens\bet_history_screen.dart'

with open(screen_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add _realBetsFuture to state
code = code.replace(
    'late Future<List<Bet>> _betsFuture;',
    'late Future<List<Bet>> _betsFuture;\n  late Future<List<RealBetLog>> _realBetsFuture;'
)

code = code.replace(
    '_betsFuture = ApiService.getBetHistory();',
    '_betsFuture = ApiService.getBetHistory();\n    _realBetsFuture = ApiService.getRealBetHistory();'
)

code = code.replace(
    '_betsFuture = ApiService.getBetHistory();',
    '_betsFuture = ApiService.getBetHistory();\n                _realBetsFuture = ApiService.getRealBetHistory();'
)

# Fix duplicate initialization if any
code = re.sub(r'(_realBetsFuture = ApiService\.getRealBetHistory\(\);\n\s*){2,}', r'\1', code)


# 2. Change FutureBuilder to handle both futures
code = code.replace(
    'body: FutureBuilder<List<Bet>>(',
    'body: FutureBuilder<List<dynamic>>('
)

code = code.replace(
    'future: _betsFuture,',
    'future: Future.wait([_betsFuture, _realBetsFuture]),'
)

code = code.replace(
    'List<Bet> allBets = snapshot.data ?? [];',
    '''List<Bet> allBets = snapshot.data?[0] ?? [];
          List<RealBetLog> allRealBets = snapshot.data?[1] ?? [];'''
)

# 3. Add realBets filtering and stat calculation
target_stat_calc = '''          // คำนวณสถิติ
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
          }'''

replacement_stat_calc = '''          // คำนวณสถิติ Mock Bot
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
              var mockBetMatch = filteredBets.where((b) => b.signalId == realBet.signalId).toList();
              if (mockBetMatch.isNotEmpty) {
                var mockBet = mockBetMatch.first;
                if (mockBet.status == 'Won') {
                  realWinCount++;
                  // กำไรสุทธิจากอัตราต่อรองของจริง (ถ้าไม่มีให้ใช้ 1.8 สมมติ)
                  double odds = (realBet.oddsAtBet != null && realBet.oddsAtBet! >= 1.0) ? realBet.oddsAtBet! : 1.8;
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
'''
code = code.replace(target_stat_calc, replacement_stat_calc)

# 4. Update _buildSummaryBoard method signature and call
target_board_call = '''              _buildSummaryBoard(
                totalBets: filteredBets.length,
                totalBetAmount: totalBetAmount,
                totalWonAmount: totalWonAmount,
                netProfit: netProfit,
                winCount: winCount,
                loseCount: loseCount,
                pendingCount: pendingCount,
              ),'''

replacement_board_call = '''              _buildSummaryBoard(
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
              ),'''
code = code.replace(target_board_call, replacement_board_call)

# 5. Redesign _buildSummaryBoard
# Use regex to replace the entire _buildSummaryBoard function block up to its end.
# We will just find the start of Widget _buildSummaryBoard and replace it.
board_func_start_idx = code.find('Widget _buildSummaryBoard({')
board_func_end_idx = code.find('Widget _buildStatItem(', board_func_start_idx)

new_board_func = '''Widget _buildSummaryBoard({
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

  '''

if board_func_start_idx != -1 and board_func_end_idx != -1:
    code = code[:board_func_start_idx] + new_board_func + code[board_func_end_idx:]

with open(screen_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("bet_history_screen.dart updated successfully!")
