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

  final Set<String> _selectedSignalIds = {};
  Set<String> get selectedSignalIds => _selectedSignalIds;

  bool _isTestRunning = false;
  bool get isTestRunning => _isTestRunning;

  String _testStatus = "ระบบพร้อมทดสอบ";
  String get testStatus => _testStatus;

  List<String> _testLogs = [];
  List<String> get testLogs => _testLogs;

  void toggleSignalSelection(String id) {
    if (_selectedSignalIds.contains(id)) {
      _selectedSignalIds.remove(id);
    } else {
      _selectedSignalIds.add(id);
    }
    notifyListeners();
  }

  void clearSelection() {
    _selectedSignalIds.clear();
    notifyListeners();
  }

  // ระบบดึง Log และสถานะแบบ Real-time
  bool _shouldPollLogs = false;
  Future<void> _startLogPolling() async {
    _shouldPollLogs = true;
    while (_shouldPollLogs) {
      await Future.delayed(const Duration(seconds: 2));
      _testLogs = await ApiService.getTestLogs();
      
      final status = await ApiService.getTestStatus();
      bool queueEmpty = status['isQueueEmpty'] ?? true;
      bool testRunning = status['isTestRunning'] ?? false;

      // ถ้าคิวว่างและไม่มีงานรันอยู่ ให้หยุดรัน (Reset ปุ่ม)
      if (queueEmpty && !testRunning && _isTestRunning) {
        _isTestRunning = false;
        _testStatus = "การทดสอบเสร็จสิ้นทั้งหมดแล้ว";
        _shouldPollLogs = false;
      }
      
      notifyListeners();
    }
  }

  Future<void> startBulkTest() async {
    if (_selectedSignalIds.isEmpty) return;
    
    _isTestRunning = true;
    _testStatus = "กำลังเริ่มการทดสอบ (${_selectedSignalIds.length} รายการ)...";
    _testLogs = ["กำลังเตรียมระบบ..."];
    notifyListeners();

    _startLogPolling(); // เริ่มดึง Log

    try {
      int count = 1;
      final idsToProcess = _selectedSignalIds.toList();
      
      for (var id in idsToProcess) {
        final signal = _signals.firstWhere((s) => s.id == id);
        final match = signal.match;
        final bet = signal.bet;

        if (match == null || bet == null) {
          _testStatus = "ข้ามคู่ที่ข้อมูลไม่ครบ: ID $id";
          notifyListeners();
          continue;
        }
        
        String league = match.leagueName;
        String matchName = match.name;
        String side = bet.betSide ?? "ทีมเหย้า"; 
        String targetLine = bet.lineAtBet ?? "0";

        _testStatus = "กำลังส่งคิวที่ $count/${idsToProcess.length}: $matchName";
        notifyListeners();

        await ApiService.testAutoBot(
          leagueName: league,
          matchName: matchName,
          betSide: side,
          amount: 10.0,
          targetLine: targetLine,
        );
        count++;
      }
      _testStatus = "ส่งงานเข้าคิวครบแล้ว (${idsToProcess.length} รายการ) | รอทำตามขั้นตอน...";
    } catch (e) {
      _testStatus = "เกิดข้อผิดพลาด: $e";
    }
    notifyListeners();
  }

  Future<void> stopTest() async {
    await ApiService.stopTest();
    _testStatus = "สั่งหยุดการทดสอบปัจจุบันแล้ว";
    notifyListeners();
  }

  Future<void> clearTestQueue() async {
    _shouldPollLogs = false;
    await ApiService.clearTestQueue();
    _isTestRunning = false;
    _selectedSignalIds.clear();
    _testLogs.clear();
    _testStatus = "ล้างคิวและหยุดการทดสอบทั้งหมดแล้ว";
    notifyListeners();
  }

  Future<void> nextStep() async {
    await ApiService.nextStep();
    
    // หลังจากกด Next ลองเช็คสถานะทันที
    final status = await ApiService.getTestStatus();
    if (status['isQueueEmpty'] == true && status['isTestRunning'] == false) {
       _isTestRunning = false;
       _testStatus = "การทดสอบเสร็จสิ้นแล้ว";
       _shouldPollLogs = false;
       notifyListeners();
    }
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
