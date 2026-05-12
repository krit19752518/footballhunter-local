export interface ApiMatchRecord {
  id: number;
  nm: string; // Match name "Team A vs Team B"
  lg: {
    na: string; // League name
    id: number;
  };
  ts: {
    na: string; // Team name
    id: number;
  }[];
  nsg: {
    tyg: number;
    sc: number[]; // [HomeScore, AwayScore]
  }[];
  mg: MarketGroup[];
  bt: number; // Start time timestamp
  mc: {
    s: number; // Match time in seconds or status?
  };
}

export interface MarketGroup {
  nm: string; // "แฮนดิแคป", "สูง/ต่ำ", "1x2"
  mks: Market[];
}

export interface Market {
  id: number;
  op: Option[];
  li?: string; // Line e.g. "0.5"
}

export interface Option {
  na: string; // Option name
  nm: string; // Line display
  od: number; // Odds
  ty: number; // Type ID
}

export interface ApiResponse {
  success: boolean;
  data: {
    records: ApiMatchRecord[];
  };
}
