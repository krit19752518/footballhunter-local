import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../models/football_models.dart';
import '../services/api_service.dart';

class SignalProvider with ChangeNotifier {
  List<FootballMatch> _matches = [];
  List<Signal> _signals = [];
  List<Bet> _latestBets = [];
  bool _isBrowserReady = false;
  late io.Socket _socket;

  List<FootballMatch> get matches => _matches;
  List<Signal> get signals => _signals;
  List<Bet> get latestBets => _latestBets;
  bool get isBrowserReady => _isBrowserReady;

  SignalProvider() {
    _initSocket();
    fetchData();
  }

  void _initSocket() {
    _socket = io.io('http://localhost:3000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });

    _socket.onConnect((_) => print('Connected to WebSocket'));
    _socket.on('data_updated', (_) => fetchData());
  }

  Future<void> fetchData() async {
    try {
      _matches = await ApiService.getMatches();
      _signals = await ApiService.getSignals();
      _latestBets = await ApiService.getLatestBets();
      _isBrowserReady = await ApiService.getBrowserStatus();
      
      // เรียงลำดับคู่บอล: คู่ที่มี Bet Pending ให้ขึ้นก่อน
      _sortMatches();
      
      notifyListeners();
    } catch (e) {
      print('Error fetching data: $e');
    }
  }

  Future<void> toggleBrowserReady() async {
    _isBrowserReady = !_isBrowserReady;
    await ApiService.setBrowserReady(_isBrowserReady);
    notifyListeners();
  }

  Future<void> triggerTestBot({
    required String leagueName,
    required String matchName,
    required String betSide,
    required double amount,
    required String targetLine,
  }) async {
    await ApiService.testAutoBot(
      leagueName: leagueName,
      matchName: matchName,
      betSide: betSide,
      amount: amount,
      targetLine: targetLine,
    );
    await fetchData(); // รีเฟรชสถานะบอท
  }

  Future<void> nextStep() async {
    await ApiService.nextStep();
  }

  Future<void> stopTest() async {
    await ApiService.stopTest();
  }

  void _sortMatches() {
    // ดึง Match ID ทั้งหมดที่มีการแทงแบบ Pending
    final pendingMatchIds = _latestBets
        .where((bet) => bet.status == 'Pending')
        .map((bet) => bet.matchId)
        .toSet();

    _matches.sort((a, b) {
      bool aPending = pendingMatchIds.contains(a.id);
      bool bPending = pendingMatchIds.contains(b.id);
      
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;
      return 0;
    });
  }

  @override
  void dispose() {
    _socket.dispose();
    super.dispose();
  }
}
