import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/signal_provider.dart';
import 'screens/dashboard_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SignalProvider()),
      ],
      child: const FootballHunterApp(),
    ),
  );
}

class FootballHunterApp extends StatelessWidget {
  const FootballHunterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Football Hunter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        textTheme: const TextTheme(
          headlineMedium: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
          titleLarge: TextStyle(fontWeight: FontWeight.w600, color: Colors.white70),
        ),
        // Simplified theme to avoid version compatibility issues
      ),
      home: const DashboardScreen(),
    );
  }
}
