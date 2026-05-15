import 'package:flutter/material.dart';
import '../models/football_models.dart';
import '../utils/formatters.dart';
import 'blinking_dot.dart';

class SignalCard extends StatelessWidget {
  final Signal signal;
  final int runningNo;
  const SignalCard({super.key, required this.signal, required this.runningNo});

  @override
  Widget build(BuildContext context) {
    String advice = "";
    String recommendation = "";
    
    // จัดรูปแบบราคาให้เหมือนหน้าเว็บ (0.75 -> 0.5/1)
    String displayLogicType = signal.logicType;
    if (displayLogicType.contains('[') && displayLogicType.contains(']')) {
      int start = displayLogicType.indexOf('[');
      int end = displayLogicType.indexOf(']');
      String linePart = displayLogicType.substring(start, end + 1);
      String baseLogic = displayLogicType.substring(0, start).trim();
      displayLogicType = "$baseLogic [${Formatters.formatBetLine(linePart)}]";
    }
    
    // ลบข้อความ [ทีมรอง] และ [ทีมต่อ] ออกจากข้อความแสดงผล
    String cleanMessage = signal.message.replaceAll('[ทีมรอง]', '').replaceAll('[ทีมต่อ]', '').trim();
    
    // แปลงราคาในข้อความ (ถ้ามี)
    RegExp lineRegex = RegExp(r'ราคา (\d+\.?\d*)');
    cleanMessage = cleanMessage.replaceAllMapped(lineRegex, (m) => 'ราคา ${Formatters.formatBetLine(m.group(1))}');
    
    // คำนวณครึ่งเวลาจากนาทีที่บันทึกไว้
    int minutes = int.tryParse(signal.matchTimeAtSignal ?? '0') ?? 0;
    String periodText = minutes > 45 ? '(ครึ่งหลัง)' : '(ครึ่งแรก)';
    
    if (cleanMessage.contains('🔥')) {
      List<String> parts = cleanMessage.split('🔥');
      advice = parts[0].trim();
      recommendation = '🔥 ${parts[1].trim()} $periodText';
    } else {
      advice = '$cleanMessage $periodText';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        border: Border.all(color: Colors.white10),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. ชื่อลีก (ขนาดใหญ่)
          if (signal.match != null) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    signal.match!.leagueName,
                    style: const TextStyle(fontSize: 18, color: Colors.blueAccent, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  'running No. $runningNo',
                  style: const TextStyle(fontSize: 14, color: Colors.yellowAccent, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],
          
          // 2. ชื่อทีม A VS ชื่อทีม B
          if (signal.match != null) ...[
            Text(
              '${signal.match!.homeTeam} vs ${signal.match!.awayTeam}',
              style: const TextStyle(fontSize: 14, color: Colors.white, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
          ],

          // 3. คำแนะนำการตัดสินใจ
          Text(
            advice,
            style: const TextStyle(fontSize: 13, color: Colors.white70),
          ),
          
          // 4. คำแนะนำการแทง (🔥 แนะนำสวน)
          if (recommendation.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              recommendation,
              style: const TextStyle(fontSize: 14, color: Colors.yellowAccent, fontWeight: FontWeight.bold),
            ),
          ],

          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _getLogicColor(signal.logicType).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _getLogicColor(signal.logicType).withOpacity(0.5)),
                ),
                child: Text(
                  displayLogicType, 
                  style: TextStyle(fontSize: 15, color: _getLogicColor(signal.logicType), fontWeight: FontWeight.bold)
                ),
              ),
              Row(
                children: [
                  const BlinkingDot(),
                  const SizedBox(width: 6),
                  Text(
                    signal.matchTimeAtSignal != null ? "นาทีที่ ${signal.matchTimeAtSignal!}'" : "--'", 
                    style: const TextStyle(fontSize: 16, color: Colors.greenAccent, fontWeight: FontWeight.bold)
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getLogicColor(String type) {
    if (type.contains('HDP')) return Colors.orangeAccent;
    if (type.contains('O/U')) return Colors.greenAccent;
    if (type.contains('1x2')) return Colors.blueAccent;
    return Colors.white;
  }
}
