class FootballMatch {
  final int id;
  final String name;
  final String leagueName;
  final String homeTeam;
  final String awayTeam;
  final DateTime startTime;
  final int scoreHome;
  final int scoreAway;
  final String status;
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
    required this.status,
    required this.odds,
  });

  factory FootballMatch.fromJson(Map<String, dynamic> json) {
    return FootballMatch(
      id: json['id'],
      name: json['name'],
      leagueName: json['leagueName'],
      homeTeam: json['homeTeam'],
      awayTeam: json['awayTeam'],
      startTime: DateTime.parse(json['startTime']),
      scoreHome: json['scoreHome'],
      scoreAway: json['scoreAway'],
      status: json['status'] ?? 'Unknown',
      odds: (json['odds'] as List? ?? []).map((o) => Odds.fromJson(o)).toList(),
    );
  }
}

class Odds {
  final String type;
  final String? line;
  final double? homeOdds;
  final double? awayOdds;
  final double? overOdds;
  final double? underOdds;

  Odds({
    required this.type,
    this.line,
    this.homeOdds,
    this.awayOdds,
    this.overOdds,
    this.underOdds,
  });

  factory Odds.fromJson(Map<String, dynamic> json) {
    return Odds(
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
  final int matchId;
  final String logicType;
  final String message;
  final DateTime createdAt;
  final bool? isWon;
  final FootballMatch? match;

  Signal({
    required this.id,
    required this.matchId,
    required this.logicType,
    required this.message,
    required this.createdAt,
    this.isWon,
    this.match,
  });

  factory Signal.fromJson(Map<String, dynamic> json) {
    return Signal(
      id: json['id'],
      matchId: json['matchId'],
      logicType: json['logicType'],
      message: json['message'],
      createdAt: DateTime.parse(json['createdAt']),
      isWon: json['isWon'],
      match: json['match'] != null ? FootballMatch.fromJson(json['match']) : null,
    );
  }
}
