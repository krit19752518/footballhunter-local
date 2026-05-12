import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/football_models.dart';
import '../services/api_service.dart';

class SignalProvider extends ChangeNotifier {
  List<FootballMatch> _matches = [];
  List<Signal> _signals = [];
  bool _isLoading = false;
  late IO.Socket socket;

  List<FootballMatch> get matches => _matches;
  List<Signal> get signals => _signals;
  bool get isLoading => _isLoading;

  SignalProvider() {
    initSocket();
    refreshData();
  }

  void initSocket() {
    socket = IO.io('http://localhost:3000', 
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .build()
    );

    socket.onConnect((_) => print('Connected to WebSocket'));
    
    socket.on('data_updated', (_) {
      refreshData();
    });
  }

  Future<void> refreshData() async {
    _isLoading = true;
    notifyListeners();
    try {
      _matches = await ApiService.getMatches();
      _signals = await ApiService.getSignals();
    } catch (e) {
      print('Error refreshing data: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
