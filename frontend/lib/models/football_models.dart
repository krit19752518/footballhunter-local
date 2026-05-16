class FootballMatch {
  final int id;
  final String name;
  final String leagueName;
  final String homeTeam;
  final String awayTeam;
  final DateTime startTime;
  final int scoreHome;
  final int scoreAway;
  final String? status;
  final String? matchTime;
  final List<Odds> odds;

  FootballMatch({
    required this.id,
    required this.name,
    required this.leagueName,
    required this.homeTeam,
    required this.awayTeam,
    required this.startTime,
    required this.scoreHome,
    required this.scoreAway,
    this.status,
    this.matchTime,
    this.odds = const [],
  });

  factory FootballMatch.fromJson(Map<String, dynamic> json) {
    return FootballMatch(
      id: json['id'],
      name: json['name'],
      leagueName: json['leagueName'] ?? 'Unknown League',
      homeTeam: json['homeTeam'],
      awayTeam: json['awayTeam'],
      startTime: DateTime.parse(json['startTime']),
      scoreHome: json['scoreHome'],
      scoreAway: json['scoreAway'],
      status: json['status'],
      matchTime: json['matchTime'],
      odds: (json['odds'] as List?)?.map((i) => Odds.fromJson(i)).toList() ?? [],
    );
  }
}

class Odds {
  final String id;
  final String type;
  final String? line;
  final double? homeOdds;
  final double? awayOdds;
  final double? overOdds;
  final double? underOdds;

  Odds({
    required this.id,
    required this.type,
    this.line,
    this.homeOdds,
    this.awayOdds,
    this.overOdds,
    this.underOdds,
  });

  factory Odds.fromJson(Map<String, dynamic> json) {
    return Odds(
      id: json['id'],
      type: json['type'],
      line: json['line'],
      homeOdds: json['homeOdds']?.toDouble(),
      awayOdds: json['awayOdds']?.toDouble(),
      overOdds: json['overOdds']?.toDouble(),
      underOdds: json['underOdds']?.toDouble(),
    );
  }
}

class Signal {
  final String id;
  final String logicType;
  final String message;
  final DateTime createdAt;
  final String? matchTimeAtSignal;
  final bool? isWon;
  final FootballMatch? match;
  final Bet? bet; // แก้จาก List เป็นออบเจกต์เดียว

  Signal({
    required this.id,
    required this.logicType,
    required this.message,
    required this.createdAt,
    this.matchTimeAtSignal,
    this.isWon,
    this.match,
    this.period,
    this.bet,
  });

  final String? period;

  factory Signal.fromJson(Map<String, dynamic> json) {
    return Signal(
      id: json['id'],
      logicType: json['logicType'],
      message: json['message'],
      createdAt: DateTime.parse(json['createdAt']),
      matchTimeAtSignal: json['matchTimeAtSignal'],
      isWon: json['isWon'],
      match: json['match'] != null ? FootballMatch.fromJson(json['match']) : null,
      period: json['period'],
      bet: json['bet'] != null ? Bet.fromJson(json['bet']) : null,
    );
  }
}

class Bet {
  final String id;
  final String signalId;
  final int matchId;
  final double amount;
  final double? oddsAtBet;
  final String? lineAtBet;
  final String status;
  final double? netProfit;
  final DateTime createdAt;
  final String? betSide;
  final String? autoBetStatus;
  final String? autoBetError;
  final Signal? signal;

  Bet({
    required this.id,
    required this.signalId,
    required this.matchId,
    required this.amount,
    this.oddsAtBet,
    this.lineAtBet,
    required this.status,
    this.netProfit,
    required this.createdAt,
    this.betSide,
    this.autoBetStatus,
    this.autoBetError,
    this.signal,
    this.period,
  });

  final String? period;

  factory Bet.fromJson(Map<String, dynamic> json) {
    return Bet(
      id: json['id'],
      signalId: json['signalId'],
      matchId: json['matchId'],
      amount: json['amount'].toDouble(),
      oddsAtBet: json['oddsAtBet']?.toDouble(),
      lineAtBet: json['lineAtBet'],
      status: json['status'],
      netProfit: json['netProfit']?.toDouble(),
      createdAt: DateTime.parse(json['createdAt']),
      betSide: json['betSide'],
      autoBetStatus: json['autoBetStatus'],
      autoBetError: json['autoBetError'],
      signal: json['signal'] != null ? Signal.fromJson(json['signal']) : null,
      period: json['period'],
    );
  }
}
