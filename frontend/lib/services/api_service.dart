import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/football_models.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000'; // Update with VPS IP if needed

  static Future<List<FootballMatch>> getMatches() async {
    final response = await http.get(Uri.parse('$baseUrl/matches'));
    if (response.statusCode == 200) {
      List data = json.decode(response.body);
      return data.map((m) => FootballMatch.fromJson(m)).toList();
    }
    throw Exception('Failed to load matches');
  }

  static Future<List<Signal>> getSignals() async {
    final response = await http.get(Uri.parse('$baseUrl/signals'));
    if (response.statusCode == 200) {
      List data = json.decode(response.body);
      return data.map((s) => Signal.fromJson(s)).toList();
    }
    throw Exception('Failed to load signals');
  }
}
