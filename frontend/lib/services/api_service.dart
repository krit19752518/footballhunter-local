import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/football_models.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000';

  static Future<List<FootballMatch>> getMatches() async {
    final response = await http.get(Uri.parse('$baseUrl/matches'));
    if (response.statusCode == 200) {
      List jsonResponse = json.decode(response.body);
      return jsonResponse.map((data) => FootballMatch.fromJson(data)).toList();
    } else {
      throw Exception('Failed to load matches');
    }
  }

  static Future<List<Signal>> getSignals() async {
    final response = await http.get(Uri.parse('$baseUrl/signals'));
    if (response.statusCode == 200) {
      List jsonResponse = json.decode(response.body);
      return jsonResponse.map((data) => Signal.fromJson(data)).toList();
    } else {
      throw Exception('Failed to load signals');
    }
  }

  static Future<List<Bet>> getLatestBets() async {
    final response = await http.get(Uri.parse('$baseUrl/bets'));
    if (response.statusCode == 200) {
      List jsonResponse = json.decode(response.body);
      return jsonResponse.map((data) => Bet.fromJson(data)).toList();
    } else {
      throw Exception('Failed to load bets');
    }
  }

  static Future<List<Bet>> getBetHistory() async {
    final response = await http.get(Uri.parse('$baseUrl/bets/history'));
    if (response.statusCode == 200) {
      List jsonResponse = json.decode(response.body);
      return jsonResponse.map((data) => Bet.fromJson(data)).toList();
    } else {
      throw Exception('Failed to load bet history');
    }
  }


  static Future<List<RealBetLog>> getRealBetHistory() async {
    final response = await http.get(Uri.parse('$baseUrl/real-bets/history'));
    if (response.statusCode == 200) {
      List jsonResponse = json.decode(response.body);
      return jsonResponse.map((data) => RealBetLog.fromJson(data)).toList();
    } else {
      throw Exception('Failed to load real bet history');
    }
  }

  static Future<bool> getBrowserStatus() async {
    final response = await http.get(Uri.parse('$baseUrl/browser/status'));
    if (response.statusCode == 200) {
      return json.decode(response.body)['isReady'];
    }
    return false;
  }

  static Future<double?> getActualBalance() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/browser/balance'));
      if (response.statusCode == 200) {
        final val = json.decode(response.body)['balance'];
        if (val != null) {
          return double.tryParse(val.toString());
        }
      }
    } catch (_) {}
    return null;
  }

  static Future<void> setBrowserReady(bool ready) async {
    await http.post(
      Uri.parse('$baseUrl/browser/ready'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'ready': ready}),
    );
  }

  static Future<void> testAutoBot({
    required String leagueName,
    required String matchName,
    required String betSide,
    required double amount,
    required String targetLine,
  }) async {
    await http.post(
      Uri.parse('$baseUrl/browser/test-bot'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'leagueName': leagueName,
        'matchName': matchName,
        'betSide': betSide,
        'amount': amount,
        'targetLine': targetLine,
      }),
    );
  }

  static Future<void> nextStep() async {
    await http.post(Uri.parse('$baseUrl/browser/test-bot/next'));
  }

  static Future<void> stopTest() async {
    await http.post(Uri.parse('$baseUrl/browser/test-bot/stop'));
  }

  static Future<void> clearTestQueue() async {
    await http.post(Uri.parse('$baseUrl/browser/test-bot/clear'));
  }

  static Future<List<String>> getTestLogs() async {
    final response = await http.get(Uri.parse('$baseUrl/browser/test-bot/logs'));
    if (response.statusCode == 200) {
      List logs = json.decode(response.body)['logs'];
      return logs.map((l) => l.toString()).toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> getTestStatus() async {
    final response = await http.get(Uri.parse('$baseUrl/browser/test-bot/status'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    return {'isQueueEmpty': true, 'isTestRunning': false};
  }
}
