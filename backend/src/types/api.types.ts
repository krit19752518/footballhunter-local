export interface ApiMatchRecord {
  id: number;
  sid: number; // Sport ID (1 = Soccer)
  nm: string; 
  lg: { // League
    na: string;
    id: number;
  };
  ts: { // Teams
    na: string;
    id: number;
  }[];
  nsg: {
    tyg: number;
    sc: number[];
  }[];
  mg: MarketGroup[];
  st: number; // Start time
  mc: {
    s: number; // Seconds
    tp: number; // Period (100 = Finished)
  };
}

export interface MarketGroup {
  mty: number; // 1000=HDP, 1007=OU
  mks: Market[]; 
}

export interface Market {
  id: number;
  li?: string; // Line description "0.5"
  op: Option[];
}

export interface Option {
  ty: number; // 1=Home, 2=Away, 4=Over, 5=Under
  od: number; // Odds value
}

export interface ApiResponse {
  success: boolean;
  data: {
    total: number;
    records: ApiMatchRecord[];
  };
}
