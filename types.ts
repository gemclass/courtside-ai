export enum GameStatus {
  IDLE = 'IDLE',
  LIVE = 'LIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED'
}

export interface Shot {
  id: string;
  x: number; // 0-100 (Left to Right)
  y: number; // 0-100 (Baseline to Halfcourt)
  type: '2FG' | '3FG' | 'FT';
  made: boolean;
  timestamp: number;
}

export interface Player {
  id: string;
  number: number | string;
  name: string;
  points: number;
  fouls: number;
  assists: number;
  isCourt: boolean;
  shots: Shot[]; // Shot History
  // Advanced Stats Data Points
  minutes: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  tov: number;
  stl: number;
  blk: number;
}

export interface TeamStats {
  name: string;
  score: number;
  fouls: number;
  timeouts: number;
  players: Player[];
}

export interface GameState {
  status: GameStatus;
  quarter: number;
  gameClock: string;
  home: TeamStats;
  guest: TeamStats;
  lastUpdate: string;
  lastActivePlayerId?: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'score' | 'foul' | 'analysis';
}

export interface AudioVisualizerData {
  volume: number;
}