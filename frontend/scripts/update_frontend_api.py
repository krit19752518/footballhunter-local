
import os

models_path = r'c:\FootballHunter2\frontend\lib\models\football_models.dart'
api_path = r'c:\FootballHunter2\frontend\lib\services\api_service.dart'

# 1. Update football_models.dart
with open(models_path, 'r', encoding='utf-8') as f:
    models_code = f.read()

if 'class RealBetLog' not in models_code:
    real_bet_model = """
class RealBetLog {
  final String id;
  final String? signalId;
  final String matchName;
  final String leagueName;
  final String betSide;
  final double? oddsAtBet;
  final String? lineAtBet;
  final double? amount;
  final String status;
  final String? errorMessage;
  final DateTime createdAt;

  RealBetLog({
    required this.id,
    this.signalId,
    required this.matchName,
    required this.leagueName,
    required this.betSide,
    this.oddsAtBet,
    this.lineAtBet,
    this.amount,
    required this.status,
    this.errorMessage,
    required this.createdAt,
  });

  factory RealBetLog.fromJson(Map<String, dynamic> json) {
    return RealBetLog(
      id: json['id'],
      signalId: json['signalId'],
      matchName: json['matchName'],
      leagueName: json['leagueName'],
      betSide: json['betSide'],
      oddsAtBet: json['oddsAtBet']?.toDouble(),
      lineAtBet: json['lineAtBet'],
      amount: json['amount']?.toDouble(),
      status: json['status'],
      errorMessage: json['errorMessage'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}
"""
    with open(models_path, 'w', encoding='utf-8') as f:
        f.write(models_code + '\n' + real_bet_model)


# 2. Update api_service.dart
with open(api_path, 'r', encoding='utf-8') as f:
    api_code = f.read()

if 'getRealBetHistory' not in api_code:
    api_method = """
  static Future<List<RealBetLog>> getRealBetHistory() async {
    final response = await http.get(Uri.parse('$baseUrl/real-bets/history'));
    if (response.statusCode == 200) {
      List jsonResponse = json.decode(response.body);
      return jsonResponse.map((data) => RealBetLog.fromJson(data)).toList();
    } else {
      throw Exception('Failed to load real bet history');
    }
  }
"""
    # Insert it before getBrowserStatus
    api_code = api_code.replace("  static Future<bool> getBrowserStatus()", api_method + "\n  static Future<bool> getBrowserStatus()")
    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(api_code)

print("Frontend models and API updated successfully!")
