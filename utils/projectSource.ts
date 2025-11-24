
export const PROJECT_FILES: Record<string, string> = {
  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CourtSide AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Chakra+Petch:wght@400;600;700&display=swap" rel="stylesheet">
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'],
              mono: ['Chakra Petch', 'monospace'],
            },
            colors: {
              court: {
                900: '#1a1a2e',
                800: '#16213e',
                700: '#0f3460',
                accent: '#e94560',
              }
            }
          }
        }
      }
    </script>
    <style>
      body {
        background-color: #0f172a;
        color: #f8fafc;
      }
      /* Hide scrollbar for clean UI */
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #1e293b;
      }
      ::-webkit-scrollbar-thumb {
        background: #475569;
        border-radius: 4px;
      }
    </style>
  <script type="importmap">
{
  "imports": {
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/",
    "react": "https://aistudiocdn.com/react@^19.2.0",
    "@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0",
    "lucide-react": "https://aistudiocdn.com/lucide-react@^0.554.0",
    "react/": "https://aistudiocdn.com/react@^19.2.0/",
    "jszip": "https://aistudiocdn.com/jszip@^3.10.1"
  }
}
</script>
</head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
  "index.tsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  "metadata.json": `{
  "name": "CourtSide AI - Smart Scorebook",
  "description": "Real-time basketball scorebook automated by Gemini Live Vision and Audio.",
  "requestFramePermissions": [
    "camera",
    "microphone"
  ]
}`,
  "types.ts": `export enum GameStatus {
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
}`,
  "utils/audio.ts": `import { Blob } from "@google/genai";

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768;
  }
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const blobToBase64 = (blob: globalThis.Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Remove data url prefix
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};`,
  "components/Scoreboard.tsx": `import React, { useMemo, useState } from 'react';
import { GameState, TeamStats, Player, GameStatus, Shot } from '../types';
import { Trophy, Clock, AlertCircle, Edit2, Plus, Minus, Users, TrendingUp, Play, Pause, RotateCcw, SkipForward, BookOpen, X, Info, Save, Crosshair, CircleDot, Hexagon } from 'lucide-react';

interface ScoreboardProps {
  gameState: GameState;
  onUpdateTeamName: (team: 'home' | 'guest', name: string) => void;
  onUpdateScore: (team: 'home' | 'guest', delta: number) => void;
  onUpdatePlayerStat: (team: 'home' | 'guest', playerId: string, field: string, value: any) => void;
  onUpdatePlayer: (team: 'home' | 'guest', player: Player) => void;
  onToggleClock: () => void;
  onResetClock: () => void;
  onAdvanceQuarter: () => void;
}

// Data from CSV
const GLOSSARY_DATA = [
  { category: "Shooting & Scoring Efficiency", metric: "TS%", definition: "True Shooting Percentage" },
  { category: "Shooting & Scoring Efficiency", metric: "eFG%", definition: "Effective Field Goal Percentage" },
  { category: "Shooting & Scoring Efficiency", metric: "PPS", definition: "Points Per Shot" },
  { category: "Shooting & Scoring Efficiency", metric: "FTr", definition: "Free Throw Rate" },
  { category: "Shooting & Scoring Efficiency", metric: "3PAr", definition: "3-Point Attempt Rate" },
  { category: "Possession-Based", metric: "Pace", definition: "Possessions per 48 minutes" },
  { category: "Possession-Based", metric: "PPP", definition: "Points Per Possession" },
  { category: "Possession-Based", metric: "ORtg", definition: "Offensive Rating" },
  { category: "Possession-Based", metric: "DRtg", definition: "Defensive Rating" },
  { category: "Possession-Based", metric: "NetRtg", definition: "Net Rating" },
  { category: "Rebounding", metric: "OREB%", definition: "Offensive Rebound Percentage" },
  { category: "Rebounding", metric: "DREB%", definition: "Defensive Rebound Percentage" },
  { category: "Rebounding", metric: "REB%", definition: "Total Rebound Percentage" },
  { category: "Creation & Passing", metric: "AST%", definition: "Assist Percentage" },
  { category: "Creation & Passing", metric: "AST/TO", definition: "Assist to Turnover Ratio" },
  { category: "Creation & Passing", metric: "TOV%", definition: "Turnover Percentage" },
  { category: "On/Off Impact", metric: "On-Off Net Rating", definition: "On vs off court impact" },
  { category: "On/Off Impact", metric: "RAPM", definition: "Regularized Adjusted Plus-Minus" },
  { category: "Defense", metric: "DBPM", definition: "Defensive Box Plus Minus" },
  { category: "Defense", metric: "Deflections", definition: "Ball disruptions" },
  { category: "Defense", metric: "Opponent Rim FG%", definition: "FG% allowed at rim when contesting" },
  { category: "Usage & Role", metric: "USG%", definition: "Usage Percentage" },
  { category: "Usage & Role", metric: "Play-Type PPP", definition: "Points per possession by play type" }
];

const GlossaryModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    // Group by Category
    const grouped = GLOSSARY_DATA.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, typeof GLOSSARY_DATA>);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-court-800 border border-white/20 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                        <BookOpen className="text-court-accent" />
                        Advanced Stats Glossary
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>
                <div className="overflow-y-auto p-6 space-y-8">
                    {Object.entries(grouped).map(([category, items]) => (
                        <div key={category}>
                            <h3 className="text-lg font-bold text-court-accent mb-3 uppercase tracking-wider">{category}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map((item) => (
                                    <div key={item.metric} className="bg-black/30 p-3 rounded-lg border border-white/5">
                                        <div className="font-mono font-bold text-white mb-1">{item.metric}</div>
                                        <div className="text-sm text-gray-400">{item.definition}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ShotChartModal: React.FC<{ isOpen: boolean; onClose: () => void; gameState: GameState }> = ({ isOpen, onClose, gameState }) => {
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'guest'>('home');
    const [hoveredShot, setHoveredShot] = useState<{shot: any, x: number, y: number} | null>(null);
    
    // Memoize shots to include player data and exclude FTs
    const shots = useMemo(() => {
        const team = gameState[selectedTeam];
        return team.players.flatMap(p => 
            (p.shots || [])
            .filter(s => s.type !== 'FT') // Filter out Free Throws
            .map(s => ({ ...s, player: p })) // Attach player data
        );
    }, [gameState, selectedTeam]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-court-800 border border-white/20 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Crosshair className="text-court-accent" />
                        Shot Chart
                    </h2>
                    <div className="flex gap-2">
                         <div className="flex bg-black/30 rounded-lg p-1">
                            <button 
                                onClick={() => setSelectedTeam('home')}
                                className={\`px-3 py-1 rounded-md text-xs font-bold transition-all \${selectedTeam === 'home' ? 'bg-court-accent text-white' : 'text-gray-400 hover:text-white'}\`}
                            >
                                {gameState.home.name}
                            </button>
                            <button 
                                onClick={() => setSelectedTeam('guest')}
                                className={\`px-3 py-1 rounded-md text-xs font-bold transition-all \${selectedTeam === 'guest' ? 'bg-court-accent text-white' : 'text-gray-400 hover:text-white'}\`}
                            >
                                {gameState.guest.name}
                            </button>
                         </div>
                         <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                             <X size={24} />
                         </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-black/20">
                     <div className="relative w-full max-w-[500px] aspect-[50/47] bg-court-900 border-2 border-white/10 rounded-lg shadow-inner">
                        {/* Court Markings (Simple CSS/SVG) */}
                        <svg viewBox="0 0 100 94" className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                            {/* Half Court Line */}
                            <line x1="0" y1="94" x2="100" y2="94" stroke="white" strokeWidth="0.5" />
                            {/* Baseline */}
                            <line x1="0" y1="0" x2="100" y2="0" stroke="white" strokeWidth="0.5" />
                            {/* Lane */}
                            <rect x="33" y="0" width="34" height="38" fill="none" stroke="white" strokeWidth="0.5" />
                            {/* Hoop/Rim */}
                            <circle cx="50" cy="5.25" r="1.5" stroke="orange" strokeWidth="1" fill="none" />
                            {/* Backboard */}
                            <line x1="44" y1="4" x2="56" y2="4" stroke="white" strokeWidth="0.5" />
                            {/* 3pt Line (Approximate) */}
                            <path d="M 6.6,0 L 6.6,28.2 A 47.5,47.5 0 0 0 93.4,28.2 L 93.4,0" fill="none" stroke="white" strokeWidth="0.5" />
                            {/* Center Circle */}
                            <path d="M 30,94 A 20,20 0 0 1 70,94" fill="none" stroke="white" strokeWidth="0.5" />
                        </svg>

                        {/* Shots */}
                        {shots.map((shot, idx) => (
                            <div 
                                key={idx}
                                className={\`absolute w-3 h-3 rounded-full border border-white/50 shadow-sm transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold cursor-crosshair z-10 hover:z-20 hover:scale-150 transition-transform \${shot.made ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}\`}
                                style={{ 
                                    left: \`\${shot.x}%\`, 
                                    bottom: \`\${shot.y}%\` 
                                }}
                                onMouseEnter={() => setHoveredShot({ shot, x: shot.x, y: shot.y })}
                                onMouseLeave={() => setHoveredShot(null)}
                            >
                                {shot.made ? '' : ''}
                            </div>
                        ))}

                        {/* Hover Tooltip */}
                        {hoveredShot && (
                            <div 
                                className="absolute z-30 bg-black/90 text-white text-xs p-2 rounded-lg pointer-events-none border border-white/20 whitespace-nowrap flex flex-col items-center gap-1 shadow-2xl animate-fade-in"
                                style={{
                                    left: \`\${hoveredShot.x}%\`, 
                                    bottom: \`\${hoveredShot.y + 4}%\`,
                                    transform: 'translateX(-50%)' 
                                }}
                            >
                                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                                    {hoveredShot.shot.type === '3FG' ? <Hexagon size={12} className="text-court-accent fill-current" /> : <CircleDot size={12} className="text-blue-400 fill-current" />}
                                    <span className={hoveredShot.shot.made ? 'text-green-400' : 'text-red-400'}>{hoveredShot.shot.made ? 'MADE' : 'MISSED'}</span>
                                </div>
                                <div className="text-[10px] text-gray-300 font-medium border-b border-white/10 pb-1 mb-0.5 w-full text-center">
                                     {hoveredShot.shot.player.name}
                                </div>
                                 <div className="font-mono text-yellow-400 text-sm font-bold">
                                     {/* Display Player Stats for this shot type */}
                                     {(() => {
                                         const p = hoveredShot.shot.player;
                                         if (hoveredShot.shot.type === '3FG') {
                                             return \`\${p.fg3m}-\${p.fg3a}\`;
                                         }
                                         return \`\${p.fgm - p.fg3m}-\${p.fga - p.fg3a}\`;
                                     })()}
                                </div>
                            </div>
                        )}
                     </div>
                     <div className="mt-4 flex gap-4 text-xs text-gray-400">
                         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Made</div>
                         <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Missed</div>
                         <div className="flex items-center gap-2 ml-4">
                             <Hexagon size={10} /> 3FG
                             <CircleDot size={10} /> 2FG
                         </div>
                     </div>
                </div>
            </div>
        </div>
    );
};

const PlayerEditModal: React.FC<{ 
    player: Player | null; 
    teamName: string;
    onClose: () => void; 
    onSave: (player: Player) => void;
}> = ({ player, teamName, onClose, onSave }) => {
    const [formData, setFormData] = useState<Player | null>(null);

    React.useEffect(() => {
        if (player) setFormData({ ...player });
    }, [player]);

    if (!player || !formData) return null;

    const handleChange = (field: keyof Player, value: any) => {
        setFormData(prev => prev ? { ...prev, [field]: value } : null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-court-800 border border-white/20 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Edit2 size={18} className="text-court-accent" />
                            Edit Player
                        </h2>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">{teamName}</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-4 gap-4">
                         <div className="col-span-3">
                             <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Player Name</label>
                             <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-court-accent focus:outline-none"
                             />
                         </div>
                         <div className="col-span-1">
                             <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">Number</label>
                             <input 
                                type="number" 
                                value={formData.number}
                                onChange={(e) => handleChange('number', e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-court-accent focus:outline-none text-center font-mono"
                             />
                         </div>
                    </div>

                    <div className="border-t border-white/10 my-4"></div>

                    {/* Stats Grid */}
                    <div>
                        <h3 className="text-xs font-bold text-court-accent uppercase tracking-widest mb-3">Game Stats</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Points</label>
                                 <input type="number" value={formData.points} onChange={(e) => handleChange('points', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Fouls</label>
                                 <input type="number" value={formData.fouls} onChange={(e) => handleChange('fouls', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Assists</label>
                                 <input type="number" value={formData.assists} onChange={(e) => handleChange('assists', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Turnovers</label>
                                 <input type="number" value={formData.tov} onChange={(e) => handleChange('tov', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Rebounds (Off)</label>
                                 <input type="number" value={formData.orb} onChange={(e) => handleChange('orb', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Rebounds (Def)</label>
                                 <input type="number" value={formData.drb} onChange={(e) => handleChange('drb', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Steals</label>
                                 <input type="number" value={formData.stl} onChange={(e) => handleChange('stl', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Blocks</label>
                                 <input type="number" value={formData.blk} onChange={(e) => handleChange('blk', parseInt(e.target.value)||0)} className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white font-mono" />
                             </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition">
                        Cancel
                    </button>
                    <button 
                        onClick={() => onSave(formData)}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-court-accent hover:bg-court-accent/80 transition shadow-lg shadow-court-accent/20 flex items-center gap-2"
                    >
                        <Save size={16} />
                        Save Changes
                    </button>
                </div>
             </div>
        </div>
    );
};

const StatControl: React.FC<{ value: number | string; onIncrement: () => void; onDecrement: () => void }> = ({ value, onIncrement, onDecrement }) => (
    <div className="flex items-center justify-end gap-0.5">
        <button 
            onClick={(e) => { e.stopPropagation(); onDecrement(); }}
            className="text-gray-600 hover:text-white transition-colors p-0.5"
        >
            <Minus size={10} />
        </button>
        <span className="min-w-[1.2em] text-center font-mono text-[10px] md:text-xs">{value}</span>
        <button 
            onClick={(e) => { e.stopPropagation(); onIncrement(); }}
            className="text-gray-600 hover:text-white transition-colors p-0.5"
        >
            <Plus size={10} />
        </button>
    </div>
);

const TeamDisplay: React.FC<{ 
  team: TeamStats; 
  align: 'left' | 'right'; 
  label: string;
  onNameChange: (name: string) => void;
  onScoreChange: (delta: number) => void;
}> = ({ team, align, label, onNameChange, onScoreChange }) => (
  <div className={\`flex flex-col \${align === 'right' ? 'items-end' : 'items-start'} space-y-1\`}>
    <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2">
      {label}
    </h3>
    <div className="relative group">
      <input
        type="text"
        value={team.name}
        onChange={(e) => onNameChange(e.target.value)}
        className={\`text-xl md:text-2xl font-black text-white bg-transparent border-b-2 border-transparent hover:border-white/20 focus:border-court-accent focus:outline-none w-[120px] md:w-[160px] truncate transition-all \${align === 'right' ? 'text-right' : 'text-left'}\`}
        placeholder="Team Name"
      />
      <Edit2 size={12} className={\`absolute top-1/2 -translate-y-1/2 text-gray-500 transition-opacity pointer-events-none \${align === 'right' ? '-left-4' : '-right-4'}\`} />
    </div>
    
    <div className="flex flex-col items-center gap-1">
        <div className="bg-black/40 p-2 md:p-3 rounded-xl border border-white/10 min-w-[100px] md:min-w-[120px] text-center relative group/score">
          <span className="text-5xl md:text-7xl font-mono font-bold text-court-accent leading-none">
            {team.score}
          </span>
        </div>
        
        {/* Manual Adjustments */}
        <div className="flex gap-1">
            <button 
                onClick={() => onScoreChange(-1)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
            >
                <Minus size={12} />
            </button>
            <button 
                onClick={() => onScoreChange(1)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
            >
                <Plus size={12} />
            </button>
        </div>
    </div>

    <div className="flex space-x-2 text-xs font-mono mt-1">
      <div className="flex items-center space-x-1 text-yellow-400">
        <AlertCircle size={12} />
        <span>FLS: {team.fouls}</span>
      </div>
      <div className="flex items-center space-x-1 text-blue-400">
        <Clock size={12} />
        <span>TO: {team.timeouts}</span>
      </div>
    </div>
  </div>
);

const PlayerStatsTable: React.FC<{ 
    players: Player[], 
    teamName: string, 
    activePlayerId: string | null | undefined,
    onStatChange: (playerId: string, field: string, value: any) => void,
    onEditPlayer: (player: Player) => void
}> = ({ players, teamName, activePlayerId, onStatChange, onEditPlayer }) => {
    // Sort players: Active first, then by Points Descending
    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            // Priority 1: Is Currently Active (On Court)
            if (a.isCourt !== b.isCourt) {
                return a.isCourt ? -1 : 1;
            }
            // Priority 2: Points Descending
            return b.points - a.points;
        });
    }, [players]);

    return (
        <div className="bg-black/20 rounded-xl p-2 border border-white/5 h-full relative">
          <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{teamName}</h4>
              <Users size={12} className="text-gray-600" />
          </div>
          {/* Scrollable Container - approx 6 rows visible */}
          <div className="overflow-auto max-h-[180px] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              <table className="w-full text-left text-sm whitespace-nowrap border-collapse relative">
                  <thead className="sticky top-0 z-20 bg-court-800 shadow-sm">
                      <tr className="text-gray-500 text-[10px] uppercase shadow-sm">
                          <th className="py-2 font-medium w-8 pl-1">#</th>
                          <th className="py-2 font-medium">Name</th>
                          <th className="py-2 font-medium text-right w-10">Pts</th>
                          <th className="py-2 font-medium text-right min-w-[50px]">2PM</th>
                          <th className="py-2 font-medium text-right min-w-[50px]">2PA</th>
                          <th className="py-2 font-medium text-right min-w-[50px]">3PM</th>
                          <th className="py-2 font-medium text-right min-w-[50px]">3PA</th>
                          <th className="py-2 font-medium text-right min-w-[50px]">Ast</th>
                          <th className="py-2 font-medium text-right min-w-[50px]">Fls</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {sortedPlayers.map(p => {
                          const isActive = activePlayerId === p.id;
                          const staminaPct = Math.max(5, 100 - (p.minutes * 2.2)); // Est. Stamina calculation
                          const staminaColor = staminaPct > 60 ? 'bg-green-500' : staminaPct > 30 ? 'bg-yellow-500' : 'bg-red-500';

                          return (
                              <tr 
                                key={p.id} 
                                className={\`group transition-all duration-500 \${
                                    isActive 
                                        ? 'bg-court-accent/20 border-l-2 border-court-accent' 
                                        : 'hover:bg-white/5 border-l-2 border-transparent'
                                } \${!p.isCourt ? 'opacity-50' : ''}\`}
                              >
                                  <td className="py-1 pl-1">
                                      <input 
                                        type="number"
                                        value={p.number}
                                        onChange={(e) => onStatChange(p.id, 'number', e.target.value)}
                                        className={\`w-6 bg-transparent text-xs font-mono focus:outline-none focus:text-white \${isActive ? 'text-white font-bold' : 'text-gray-400'}\`}
                                      />
                                  </td>
                                  <td 
                                    className={\`py-1 pr-2 cursor-pointer \${isActive ? 'text-white' : 'text-gray-300'}\`}
                                    onClick={() => onEditPlayer(p)}
                                    title="Click to edit player details"
                                  >
                                      <div className="flex flex-col justify-center h-full max-w-[80px]">
                                          <span className="truncate font-medium text-xs hover:text-court-accent hover:underline decoration-court-accent/50">{p.name}</span>
                                          {/* Stamina Bar */}
                                          <div className="w-full h-[2px] bg-white/10 mt-0.5 rounded-full overflow-hidden" title={\`Est. Stamina: \${Math.round(staminaPct)}%\`}>
                                              <div className={\`h-full \${staminaColor} transition-all duration-1000\`} style={{ width: \`\${staminaPct}%\` }} />
                                          </div>
                                      </div>
                                  </td>
                                  <td className={\`py-1 font-mono text-right font-bold \${isActive ? 'text-white scale-110' : 'text-court-accent'}\`}>
                                      {p.points}
                                  </td>
                                  
                                  {/* 2PM */}
                                  <td className="py-1 pr-1 relative">
                                      <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 opacity-20 pointer-events-none">
                                         <CircleDot size={8} />
                                      </div>
                                      <StatControl 
                                          value={p.fgm - p.fg3m} 
                                          onIncrement={() => onStatChange(p.id, '2PM', 1)}
                                          onDecrement={() => onStatChange(p.id, '2PM', -1)}
                                      />
                                  </td>
                                  
                                  {/* 2PA */}
                                  <td className="py-1 pr-1">
                                      <StatControl 
                                          value={p.fga - p.fg3a} 
                                          onIncrement={() => onStatChange(p.id, '2PA', 1)}
                                          onDecrement={() => onStatChange(p.id, '2PA', -1)}
                                      />
                                  </td>

                                  {/* 3PM */}
                                  <td className="py-1 pr-1 relative">
                                      <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 opacity-20 pointer-events-none">
                                         <Hexagon size={8} />
                                      </div>
                                      <StatControl 
                                          value={p.fg3m} 
                                          onIncrement={() => onStatChange(p.id, '3PM', 1)}
                                          onDecrement={() => onStatChange(p.id, '3PM', -1)}
                                      />
                                  </td>

                                  {/* 3PA */}
                                  <td className="py-1 pr-1">
                                      <StatControl 
                                          value={p.fg3a} 
                                          onIncrement={() => onStatChange(p.id, '3PA', 1)}
                                          onDecrement={() => onStatChange(p.id, '3PA', -1)}
                                      />
                                  </td>

                                  {/* Assists */}
                                  <td className="py-1 pr-1">
                                      <StatControl 
                                          value={p.assists} 
                                          onIncrement={() => onStatChange(p.id, 'assists', 1)}
                                          onDecrement={() => onStatChange(p.id, 'assists', -1)}
                                      />
                                  </td>

                                  {/* Fouls */}
                                  <td className="py-1 pr-1">
                                      <div className="flex items-center justify-end gap-1">
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); onStatChange(p.id, 'fouls', -1); }}
                                              className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                                          >
                                              <Minus size={10} />
                                          </button>
                                          <span className="min-w-[1em] text-center">{p.fouls}</span>
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); onStatChange(p.id, 'fouls', 1); }}
                                              className="text-gray-600 hover:text-court-accent transition-colors p-0.5"
                                          >
                                              <Plus size={10} />
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
        </div>
    );
};

const AdvancedStatsTable: React.FC<{ gameState: GameState }> = ({ gameState }) => {
    const [activeTab, setActiveTab] = useState("Shooting");
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'guest'>('home');
    const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
    const [isShotChartOpen, setIsShotChartOpen] = useState(false);

    const tabs = [
        "Shooting", 
        "Possession", 
        "Rebounding", 
        "Creation", 
        "On/Off", 
        "Defense", 
        "Usage"
    ];

    const currentPlayers = useMemo(() => {
        const team = gameState[selectedTeam];
        return team.players.map(p => ({ 
            ...p, 
            team: team.name, 
            totalTeamScore: team.score, 
            teamStats: team 
        })).sort((a, b) => b.points - a.points);
    }, [gameState, selectedTeam]);

    // Helper to calculate or simulate stats
    const calculateStat = (p: any, metric: string) => {
        // Shooting
        if (metric === "TS%") return p.fga + 0.44 * p.fta > 0 ? (p.points / (2 * (p.fga + 0.44 * p.fta)) * 100).toFixed(1) + "%" : "NA";
        if (metric === "eFG%") return p.fga > 0 ? (((p.fgm + 0.5 * p.fg3m) / p.fga) * 100).toFixed(1) + "%" : "NA";
        if (metric === "PPS") return p.fga > 0 ? (p.points / p.fga).toFixed(2) : "NA";
        if (metric === "FTr") return p.fga > 0 ? (p.fta / p.fga).toFixed(3) : "NA";
        if (metric === "3PAr") return p.fga > 0 ? (p.fg3a / p.fga).toFixed(3) : "NA";
        
        // Possession
        if (metric === "Pace") return "NA"; // Cannot determine from single camera view without full logging
        if (metric === "PPP") return (p.fga + 0.44 * p.fta + p.tov) > 0 ? (p.points / (p.fga + 0.44 * p.fta + p.tov)).toFixed(2) : "NA";
        if (metric === "ORtg") return "NA"; // Requires complex possession tracking
        if (metric === "DRtg") return "NA"; // Requires complex possession tracking
        if (metric === "NetRtg") return "NA"; // Requires complex possession tracking

        // Rebounding - Needs Opponent/Team totals while on court which we don't track per stint
        if (metric === "OREB%") return "NA";
        if (metric === "DREB%") return "NA";
        if (metric === "REB%") return "NA";

        // Creation
        if (metric === "AST%") {
            const teamFGM = p.teamStats.players.reduce((s:number, pl:any)=>s+pl.fgm,0);
            return teamFGM > 0 ? (p.assists / teamFGM * 100).toFixed(1) + "%" : "NA";
        }
        if (metric === "AST/TO") return p.tov > 0 ? (p.assists / p.tov).toFixed(2) : (p.assists > 0 ? "Inf" : "NA");
        if (metric === "TOV%") return (p.fga + 0.44 * p.fta + p.tov) > 0 ? (p.tov / (p.fga + 0.44 * p.fta + p.tov) * 100).toFixed(1) + "%" : "0.0%";

        // On/Off & Defense - Cannot determine reliably from basic video feed
        if (metric === "On-Off Net Rating") return "NA";
        if (metric === "RAPM") return "NA";
        if (metric === "DBPM") return "NA";
        if (metric === "Deflections") return "NA";
        if (metric === "Opponent Rim FG%") return "NA";

        // Usage
        if (metric === "USG%") {
             // Simplified Usage Estimate
             const playerPoss = p.fga + 0.44*p.fta + p.tov;
             const teamPoss = p.teamStats.players.reduce((s:number, pl:any)=>s+(pl.fga+0.44*pl.fta+pl.tov), 0);
             return teamPoss > 0 ? (playerPoss / teamPoss * 100).toFixed(1) + "%" : "NA";
        }
        if (metric === "Play-Type PPP") return "NA";

        return "NA";
    };

    const getColumnsForTab = (tab: string) => {
        return GLOSSARY_DATA.filter(d => d.category.includes(tab)).map(d => d.metric);
    };

    const currentColumns = getColumnsForTab(activeTab);

    return (
        <div className="mt-4 bg-black/40 rounded-xl border border-white/5 p-3">
             <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-court-accent" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest">
                        Advanced Analytics
                    </h4>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsShotChartOpen(true)}
                        className="flex items-center gap-1 text-[10px] text-court-accent hover:text-white transition px-2 py-1 rounded bg-court-accent/10 border border-court-accent/20"
                    >
                        <Crosshair size={10} />
                        Shot Chart
                    </button>
                    <button 
                        onClick={() => setIsGlossaryOpen(true)}
                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20"
                    >
                        <BookOpen size={10} />
                        Glossary
                    </button>
                </div>
            </div>

            {/* Team Selector */}
            <div className="flex justify-center mb-3">
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => setSelectedTeam('home')}
                        className={\`px-4 py-1.5 rounded-md text-xs font-bold transition-all \${
                            selectedTeam === 'home' 
                                ? 'bg-court-accent text-white shadow-md' 
                                : 'text-gray-400 hover:text-white'
                        }\`}
                    >
                        {gameState.home.name}
                    </button>
                    <button
                        onClick={() => setSelectedTeam('guest')}
                        className={\`px-4 py-1.5 rounded-md text-xs font-bold transition-all \${
                            selectedTeam === 'guest' 
                                ? 'bg-court-accent text-white shadow-md' 
                                : 'text-gray-400 hover:text-white'
                        }\`}
                    >
                        {gameState.guest.name}
                    </button>
                </div>
            </div>

            <div className="flex gap-1 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={\`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all \${
                            activeTab === tab 
                                ? 'bg-court-accent text-white shadow-lg shadow-court-accent/25' 
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }\`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] md:text-xs font-mono">
                    <thead>
                        <tr className="text-gray-500 uppercase tracking-wider border-b border-white/5">
                            <th className="pb-1 pl-1">Player</th>
                            <th className="pb-1">Team</th>
                            {currentColumns.map(col => (
                                <th key={col} className="pb-1 text-right pr-2 min-w-[50px]">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {currentPlayers.map((p, i) => (
                            <tr key={p.id + i} className="hover:bg-white/5 transition-colors">
                                <td className="py-1 pl-1 font-medium text-gray-300 truncate max-w-[80px]">
                                    {p.name} <span className="text-gray-600 text-[9px]">#{p.number}</span>
                                </td>
                                <td className="py-1 text-gray-500 truncate max-w-[60px]">{p.team}</td>
                                {currentColumns.map(col => (
                                    <td key={col} className={\`py-1 text-right pr-2 \${calculateStat(p, col) === "NA" ? "text-gray-600" : "text-gray-300"}\`}>
                                        {calculateStat(p, col)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <GlossaryModal isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
            <ShotChartModal isOpen={isShotChartOpen} onClose={() => setIsShotChartOpen(false)} gameState={gameState} />
        </div>
    );
};

export const Scoreboard: React.FC<ScoreboardProps> = ({ 
    gameState, 
    onUpdateTeamName, 
    onUpdateScore, 
    onUpdatePlayerStat,
    onUpdatePlayer,
    onToggleClock,
    onResetClock,
    onAdvanceQuarter
}) => {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingTeam, setEditingTeam] = useState<'home' | 'guest'>('home');

  return (
    <div className="bg-court-800 rounded-3xl p-4 shadow-2xl border border-court-700 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-court-accent/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex justify-between items-start relative z-10 pb-4 border-b border-white/5">
        <TeamDisplay 
          team={gameState.home} 
          align="left" 
          label="HOME" 
          onNameChange={(name) => onUpdateTeamName('home', name)}
          onScoreChange={(delta) => onUpdateScore('home', delta)}
        />
        
        <div className="flex flex-col items-center justify-center space-y-2 px-1 pt-6">
            {/* Game Clock */}
            <div className="text-center mb-1 flex flex-col items-center gap-1">
              <div className="bg-black/80 px-3 py-1.5 rounded-lg border border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
                <span className={\`text-2xl md:text-3xl font-mono font-bold tracking-wider \${gameState.status === GameStatus.LIVE ? 'text-red-500' : 'text-gray-400'}\`}>
                  {gameState.gameClock}
                </span>
              </div>
              
              {/* Clock Controls */}
              <div className="flex items-center gap-2">
                 <button 
                   onClick={onToggleClock}
                   className={\`p-1.5 rounded-full transition-all \${gameState.status === GameStatus.LIVE ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}\`}
                   title={gameState.status === GameStatus.LIVE ? "Pause Clock" : "Start Clock"}
                 >
                    {gameState.status === GameStatus.LIVE ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                 </button>
                 <button 
                   onClick={onResetClock}
                   className="p-1.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                   title="Reset Clock to 12:00"
                 >
                    <RotateCcw size={12} />
                 </button>
                 <button 
                   onClick={onAdvanceQuarter}
                   className="p-1.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                   title="Advance to Next Period"
                 >
                    <SkipForward size={12} />
                 </button>
              </div>
            </div>

            <div className="text-center">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">PERIOD</span>
                <div className="bg-black/40 px-2 py-0.5 rounded border border-white/5 inline-block">
                <span className="text-lg font-mono text-green-400">{gameState.quarter}</span>
                </div>
            </div>
            
             <div className="text-center mt-1">
                 <Trophy className="text-court-accent/20 mx-auto" size={16} />
             </div>
        </div>

        <TeamDisplay 
          team={gameState.guest} 
          align="right" 
          label="GUEST" 
          onNameChange={(name) => onUpdateTeamName('guest', name)}
          onScoreChange={(delta) => onUpdateScore('guest', delta)}
        />
      </div>

      {/* Game Status Footer */}
      <div className="pt-2 flex justify-between items-center text-[10px] text-gray-500 font-mono mb-2">
         <span>UPDATED: {gameState.lastUpdate}</span>
         <span className={\`flex items-center gap-2 \${gameState.status === 'LIVE' ? 'text-red-500' : 'text-gray-500'}\`}>
            <span className={\`w-1.5 h-1.5 rounded-full \${gameState.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}\`}></span>
            {gameState.status}
         </span>
      </div>

      {/* Player Stats Section */}
      <div className="grid grid-cols-1 gap-2">
         <PlayerStatsTable 
            players={gameState.home.players} 
            teamName={gameState.home.name} 
            activePlayerId={gameState.lastActivePlayerId}
            onStatChange={(pid, field, val) => onUpdatePlayerStat('home', pid, field, val)}
            onEditPlayer={(p) => { setEditingPlayer(p); setEditingTeam('home'); }}
         />
         <PlayerStatsTable 
            players={gameState.guest.players} 
            teamName={gameState.guest.name} 
            activePlayerId={gameState.lastActivePlayerId}
            onStatChange={(pid, field, val) => onUpdatePlayerStat('guest', pid, field, val)}
            onEditPlayer={(p) => { setEditingPlayer(p); setEditingTeam('guest'); }}
         />
      </div>

      {/* Advanced Stats */}
      <AdvancedStatsTable gameState={gameState} />

      {/* Edit Modal */}
      {editingPlayer && (
          <PlayerEditModal 
             player={editingPlayer} 
             teamName={editingTeam === 'home' ? gameState.home.name : gameState.guest.name}
             onClose={() => setEditingPlayer(null)}
             onSave={(updatedPlayer) => {
                 onUpdatePlayer(editingTeam, updatedPlayer);
                 setEditingPlayer(null);
             }}
          />
      )}
    </div>
  );
};`,
  "components/LiveLog.tsx": `import React, { useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { Activity, Mic, Video } from 'lucide-react';

interface LiveLogProps {
  logs: LogEntry[];
}

export const LiveLog: React.FC<LiveLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-court-900/50 rounded-2xl border border-white/10 h-64 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/20">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Activity size={16} className="text-court-accent" />
          Game Feed
        </h3>
        <span className="text-xs text-gray-600 px-2 py-1 rounded bg-black/40 font-mono">LIVE API</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm scroll-smooth">
        {logs.length === 0 && (
          <div className="text-center text-gray-600 mt-10 italic">
            Waiting for game events...
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-3 animate-fade-in">
            <div className="mt-1 flex-shrink-0">
               {log.type === 'score' && <span className="w-2 h-2 rounded-full bg-green-500 block"></span>}
               {log.type === 'foul' && <span className="w-2 h-2 rounded-full bg-yellow-500 block"></span>}
               {log.type === 'info' && <span className="w-2 h-2 rounded-full bg-blue-500 block"></span>}
               {log.type === 'analysis' && <Video size={10} className="text-purple-400" />}
            </div>
            <div className="flex-1">
              <span className="text-gray-500 text-xs mr-2">[{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
              <span className={\`\${log.type === 'score' ? 'text-green-300' : 'text-gray-300'}\`}>
                {log.message}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};`,
  "components/ControlPanel.tsx": `import React from 'react';
import { Camera, Mic, StopCircle, Play, Video, BarChart2, Monitor, Smartphone } from 'lucide-react';

interface ControlPanelProps {
  isStreaming: boolean;
  onToggleStream: () => void;
  onAnalyzeSnapshot: () => void;
  isAnalysing: boolean;
  volume: number;
  videoSource: 'camera' | 'screen';
  onSourceChange: (source: 'camera' | 'screen') => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  isStreaming, 
  onToggleStream, 
  onAnalyzeSnapshot,
  isAnalysing,
  volume,
  videoSource,
  onSourceChange
}) => {
  return (
    <div className="bg-court-800 rounded-2xl p-4 border border-white/10 flex flex-col gap-4">
      
      {/* Top Row: Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <button
            onClick={onToggleStream}
            className={\`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 \${
                isStreaming 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
                : 'bg-court-accent text-white hover:bg-court-accent/80 shadow-lg shadow-court-accent/20'
            }\`}
            >
            {isStreaming ? (
                <>
                <StopCircle size={20} />
                Stop Tracking
                </>
            ) : (
                <>
                <Play size={20} fill="currentColor" />
                Start Live Tracking
                </>
            )}
            </button>

            {isStreaming && (
                <div className="flex items-center gap-2 px-4 py-2 bg-black/30 rounded-lg border border-white/5">
                    <Mic size={16} className={volume > 0.1 ? 'text-green-400' : 'text-gray-500'} />
                    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-400 transition-all duration-75"
                            style={{ width: \`\${Math.min(volume * 100 * 3, 100)}%\` }}
                        />
                    </div>
                </div>
            )}
        </div>

        <div className="w-full md:w-auto flex gap-2">
            <button
                onClick={onAnalyzeSnapshot}
                disabled={!isStreaming || isAnalysing}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-600/30 hover:bg-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {isAnalysing ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                    <BarChart2 size={20} />
                )}
                <span className="hidden sm:inline">Deep Analysis</span>
            </button>
        </div>
      </div>

      {/* Bottom Row: Source Selection */}
      {!isStreaming && (
          <div className="flex items-center gap-4 pt-2 border-t border-white/5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Video Source</span>
              <div className="flex bg-black/30 p-1 rounded-lg">
                  <button
                      onClick={() => onSourceChange('camera')}
                      className={\`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all \${
                          videoSource === 'camera' 
                              ? 'bg-court-700 text-white shadow-sm' 
                              : 'text-gray-400 hover:text-white'
                      }\`}
                  >
                      <Smartphone size={14} />
                      Camera
                  </button>
                  <button
                      onClick={() => onSourceChange('screen')}
                      className={\`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all \${
                          videoSource === 'screen' 
                              ? 'bg-court-700 text-white shadow-sm' 
                              : 'text-gray-400 hover:text-white'
                      }\`}
                  >
                      <Monitor size={14} />
                      Screen Share
                  </button>
              </div>
              <span className="text-[10px] text-gray-500 italic ml-auto hidden md:inline">
                  Use "Screen Share" to analyze YouTube, NFHS, or other browser tabs.
              </span>
          </div>
      )}
    </div>
  );
};`,
  "App.tsx": `import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  GoogleGenAI, 
  LiveServerMessage, 
  Modality, 
  FunctionDeclaration, 
  Type, 
  Schema
} from '@google/genai';
import { Camera, Download, Save, RefreshCw, FolderOpen, Mic, Eye, Monitor, Check } from 'lucide-react';
import JSZip from 'jszip';
import { PROJECT_FILES } from './utils/projectSource';

import { Scoreboard } from './components/Scoreboard';
import { LiveLog } from './components/LiveLog';
import { ControlPanel } from './components/ControlPanel';
import { GameState, GameStatus, LogEntry, TeamStats, Player } from './types';
import { 
  base64ToUint8Array, 
  createPcmBlob, 
  decodeAudioData,
  blobToBase64 
} from './utils/audio';

// Helper to generate initial players with detailed stats (Demo Data)
const createInitialPlayers = (prefix: string): Player[] => {
  return Array.from({ length: 8 }).map((_, i) => {
    // Generate realistic stats
    const minutes = i < 5 ? 18 + Math.floor(Math.random() * 10) : Math.floor(Math.random() * 12);
    const fga = Math.floor(minutes / 2) + Math.floor(Math.random() * 5);
    const fgm = Math.floor(fga * (0.35 + Math.random() * 0.2)); // 35-55% FG
    const fg3a = Math.floor(fga * 0.4);
    const fg3m = Math.floor(fg3a * (0.3 + Math.random() * 0.15));
    const fta = Math.floor(Math.random() * 6);
    const ftm = Math.floor(fta * 0.75);
    const points = (fgm - fg3m) * 2 + fg3m * 3 + ftm;
    
    // Generate some random past shots for the demo
    const shots = [];
    for(let s=0; s<fgm; s++) {
        shots.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * 100,
            y: Math.random() * 90,
            type: Math.random() > 0.3 ? '2FG' : '3FG',
            made: true,
            timestamp: Date.now() - Math.random() * 3600000
        } as any);
    }
    
    return {
      id: \`\${prefix}-\${i}\`,
      number: (i + 1) * 10 + Math.floor(Math.random() * 9),
      name: \`\${prefix} Player \${i + 1}\`,
      points: points,
      fouls: Math.floor(Math.random() * 3),
      assists: i < 5 ? Math.floor(Math.random() * 8) : Math.floor(Math.random() * 2),
      isCourt: i < 5, // First 5 are starters
      shots: shots,
      minutes: minutes,
      fgm: fgm,
      fga: fga,
      fg3m: fg3m,
      fg3a: fg3a,
      ftm: ftm,
      fta: fta,
      orb: Math.floor(Math.random() * 3),
      drb: Math.floor(Math.random() * 6),
      tov: Math.floor(Math.random() * 4),
      stl: Math.floor(Math.random() * 3),
      blk: Math.floor(Math.random() * 2)
    };
  });
};

// Helper to generate fresh players for a new game (Zeroed Stats)
const createFreshPlayers = (prefix: string): Player[] => {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: \`\${prefix}-\${i}\`,
    number: (i + 1) * 10 + Math.floor(Math.random() * 9),
    name: \`\${prefix} Player \${i + 1}\`,
    points: 0,
    fouls: 0,
    assists: 0,
    isCourt: i < 5,
    shots: [],
    minutes: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    orb: 0,
    drb: 0,
    tov: 0,
    stl: 0,
    blk: 0
  }));
};

const INITIAL_GAME_STATE: GameState = {
  status: GameStatus.IDLE,
  quarter: 1,
  gameClock: '12:00',
  home: { 
    name: 'HOME', 
    score: 86, 
    fouls: 2, 
    timeouts: 3,
    players: createInitialPlayers('Home')
  },
  guest: { 
    name: 'GUEST', 
    score: 82, 
    fouls: 4, 
    timeouts: 2,
    players: createInitialPlayers('Guest')
  },
  lastUpdate: 'Just now',
  lastActivePlayerId: null
};

// --- Gemini Tool Definitions ---
const updateScoreTool: FunctionDeclaration = {
  name: 'update_score',
  description: 'Update the score for a specific team when a basket is made or points are awarded.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      team: { type: Type.STRING, enum: ['HOME', 'GUEST'], description: 'The team that scored.' },
      points: { type: Type.NUMBER, description: 'Points to add (1, 2, or 3).' },
      reason: { type: Type.STRING, description: 'Short description of the play (e.g., "Three pointer from the corner").' },
      player_number: { type: Type.NUMBER, description: 'The jersey number of the player who scored, if visible.' },
      shot_type: { 
          type: Type.STRING, 
          enum: ['2FG', '3FG', 'FT'], 
          description: 'The type of shot: 2-point field goal (2FG), 3-point field goal (3FG), or Free Throw (FT).' 
      },
      location_x: { 
          type: Type.NUMBER, 
          description: 'Shot location X coordinate (0-100). 0 is the left sideline (looking at hoop), 50 is center court, 100 is right sideline.' 
      },
      location_y: { 
          type: Type.NUMBER, 
          description: 'Shot location Y coordinate (0-100). 0 is the baseline/under hoop, 100 is the halfcourt line.' 
      }
    },
    required: ['team', 'points', 'reason']
  }
};

const updateFoulsTool: FunctionDeclaration = {
  name: 'update_fouls',
  description: 'Record a foul for a team.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      team: { type: Type.STRING, enum: ['HOME', 'GUEST'] },
      type: { type: Type.STRING, description: 'Type of foul (e.g., "Personal", "Technical").' }
    },
    required: ['team', 'type']
  }
};

const updateClockTool: FunctionDeclaration = {
  name: 'update_game_clock',
  description: 'Update the game clock and period based on the visible scoreboard in the video.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      clock: { type: Type.STRING, description: 'The time remaining (e.g., "12:00", "04:35").' },
      period: { type: Type.NUMBER, description: 'The current period/quarter number.' }
    },
    required: ['clock']
  }
};

const logActionTool: FunctionDeclaration = {
  name: 'log_action',
  description: 'Log a visible game action or player movement to the event feed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action_type: { 
          type: Type.STRING, 
          enum: ['DRIBBLE', 'PASS', 'SHOT_ATTEMPT', 'REBOUND', 'DEFENSE', 'OTHER'],
          description: 'The category of the action.'
      },
      description: { type: Type.STRING, description: 'Brief description of the event (e.g., "Player 10 drives to the basket", "Cross-court pass to corner").' },
      player_number: { type: Type.NUMBER, description: 'Jersey number if visible.' },
      is_free_throw: { type: Type.BOOLEAN, description: 'True if the action is related to a free throw.' }
    },
    required: ['action_type', 'description']
  }
};

const tools = [{ functionDeclarations: [updateScoreTool, updateFoulsTool, updateClockTool, logActionTool] }];

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [videoSource, setVideoSource] = useState<'camera' | 'screen'>('camera');
  const [buttonFeedback, setButtonFeedback] = useState<{[key: string]: string | null}>({});
  
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const clockIntervalRef = useRef<number | null>(null);

  // --- Helper: Add Log ---
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message,
      type
    }]);
  }, []);

  // --- Helper: Button Feedback ---
  const showFeedback = (key: string, message: string) => {
    setButtonFeedback(prev => ({ ...prev, [key]: message }));
    setTimeout(() => {
        setButtonFeedback(prev => ({ ...prev, [key]: null }));
    }, 2000);
  };

  // --- Clock Logic ---
  // Note: Automatic clock ticking removed per user request. 
  // Clock will be updated via "update_game_clock" tool from video analysis.

  // --- Clock Handlers ---
  const toggleClock = useCallback(() => {
    setGameState(prev => ({
        ...prev,
        status: prev.status === GameStatus.LIVE ? GameStatus.PAUSED : GameStatus.LIVE
    }));
  }, []);

  const resetClock = useCallback(() => {
      setGameState(prev => ({ ...prev, gameClock: '12:00', status: GameStatus.PAUSED }));
  }, []);

  const advanceQuarter = useCallback(() => {
      setGameState(prev => ({ 
          ...prev, 
          quarter: Math.min(4, prev.quarter + 1), 
          gameClock: '12:00', 
          status: GameStatus.PAUSED 
      }));
  }, []);


  // --- Effect: Clear Active Player Highlight ---
  useEffect(() => {
    if (gameState.lastActivePlayerId) {
        const timer = setTimeout(() => {
            setGameState(prev => ({ ...prev, lastActivePlayerId: null }));
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [gameState.lastActivePlayerId]);

  // --- Auto-Save Effect ---
  useEffect(() => {
    let interval: number;
    if (gameState.status === GameStatus.LIVE || gameState.status === GameStatus.PAUSED) {
        interval = window.setInterval(() => {
            saveGame(true); // Silent save
        }, 60000); // 60 seconds
    }
    return () => clearInterval(interval);
  }, [gameState]);

  // --- Helper: Update Team Name ---
  const updateTeamName = useCallback((team: 'home' | 'guest', name: string) => {
    setGameState(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        name
      }
    }));
  }, []);

  // --- Helper: Update Score Manually ---
  const updateTeamScore = useCallback((team: 'home' | 'guest', delta: number) => {
    setGameState(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        score: Math.max(0, prev[team].score + delta)
      },
      lastUpdate: new Date().toLocaleTimeString()
    }));
  }, []);

  // --- Helper: Update Player Stats Manually ---
  const updatePlayerStat = useCallback((team: 'home' | 'guest', playerId: string, field: string, value: any) => {
    setGameState(prev => {
      const teamStats = prev[team];
      const updatedPlayers = teamStats.players.map(p => {
        if (p.id === playerId) {
            const delta = typeof value === 'number' ? value : 0;
            
            // Handle basketball-specific smart updates
            if (field === '2PM') {
                return { 
                    ...p, 
                    fgm: Math.max(0, p.fgm + delta), 
                    fga: Math.max(0, p.fga + delta),
                    points: Math.max(0, p.points + (delta * 2))
                };
            }
            if (field === '2PA') {
                // Adjusting attempts (usually means a miss if adjusted separately from make)
                return { ...p, fga: Math.max(0, p.fga + delta) };
            }
            if (field === '3PM') {
                return { 
                    ...p, 
                    fg3m: Math.max(0, p.fg3m + delta),
                    fg3a: Math.max(0, p.fg3a + delta),
                    fgm: Math.max(0, p.fgm + delta),
                    fga: Math.max(0, p.fga + delta),
                    points: Math.max(0, p.points + (delta * 3))
                };
            }
            if (field === '3PA') {
                 // Adjusting attempts (usually means a miss if adjusted separately from make)
                return { 
                    ...p, 
                    fg3a: Math.max(0, p.fg3a + delta),
                    fga: Math.max(0, p.fga + delta)
                };
            }

            // Handle standard numeric updates
            if (typeof p[field as keyof Player] === 'number') {
                const currentVal = p[field as keyof Player] as number;
                return { ...p, [field]: Math.max(0, currentVal + delta) };
            }
            // Handle direct value updates (like number string)
            return { ...p, [field]: value };
        }
        return p;
      });
      return {
        ...prev,
        [team]: {
          ...teamStats,
          players: updatedPlayers
        }
      };
    });
  }, []);

  // --- Helper: Update Full Player (for Edit Modal) ---
  const updatePlayer = useCallback((team: 'home' | 'guest', updatedPlayer: Player) => {
    setGameState(prev => {
        const currentTeam = prev[team];
        const newPlayers = currentTeam.players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
        return {
            ...prev,
            [team]: {
                ...currentTeam,
                players: newPlayers
            }
        };
    });
  }, []);

  // --- Tool Execution Logic ---
  const handleToolCall = useCallback((toolCall: any, session: any) => {
    toolCall.functionCalls.forEach((fc: any) => {
      const { name, args, id } = fc;
      
      let result = { status: 'ok' };
      
      if (name === 'update_score') {
        const teamKey = args.team.toLowerCase() as 'home' | 'guest';
        const points = Number(args.points);
        const playerNumber = args.player_number;
        const shotType = args.shot_type; // '2FG', '3FG', 'FT'
        const locX = args.location_x;
        const locY = args.location_y;
        
        setGameState(prev => {
          let updatedPlayers = prev[teamKey].players;
          let activePlayerId = prev.lastActivePlayerId;

          if (playerNumber) {
            updatedPlayers = updatedPlayers.map(p => {
                if (Number(p.number) === Number(playerNumber)) {
                    activePlayerId = p.id;
                    let newStats = { ...p };

                    // Create new shot record
                    const newShot = {
                        id: Math.random().toString(36).substr(2, 9),
                        x: locX !== undefined ? locX : 50, // Default to center if unknown
                        y: locY !== undefined ? locY : (shotType === '3FG' ? 80 : 20), // Rough guess if unknown
                        type: shotType || (points === 3 ? '3FG' : '2FG'),
                        made: true,
                        timestamp: Date.now()
                    };
                    
                    newStats.shots = [...(newStats.shots || []), newShot];

                    // Update detailed stats based on shot type
                    if (shotType === '3FG' || (!shotType && points === 3)) {
                        newStats.fg3m += 1;
                        newStats.fg3a += 1; // Assume make means attempt too
                        newStats.fgm += 1;
                        newStats.fga += 1;
                        newStats.points += 3;
                    } else if (shotType === '2FG' || (!shotType && points === 2)) {
                        newStats.fgm += 1;
                        newStats.fga += 1;
                        newStats.points += 2;
                    } else if (shotType === 'FT' || (!shotType && points === 1)) {
                        newStats.ftm += 1;
                        newStats.fta += 1;
                        newStats.points += 1;
                    } else {
                        // Fallback
                        newStats.points += points;
                        if (points >= 2) {
                            newStats.fgm += 1;
                            newStats.fga += 1;
                        }
                    }
                    return newStats;
                }
                return p;
            });
          }

          return {
            ...prev,
            [teamKey]: {
              ...prev[teamKey],
              score: prev[teamKey].score + points,
              players: updatedPlayers
            },
            lastActivePlayerId: activePlayerId,
            lastUpdate: new Date().toLocaleTimeString(),
            status: GameStatus.LIVE // Score happens, assume LIVE
          };
        });
        addLog(\`\${args.team} scores \${points}! (\${shotType || 'Pts'}) \${args.reason}\`, 'score');
      } else if (name === 'update_fouls') {
        const teamKey = args.team.toLowerCase() as 'home' | 'guest';
        setGameState(prev => ({
          ...prev,
          [teamKey]: {
            ...prev[teamKey],
            fouls: prev[teamKey].fouls + 1
          },
          lastUpdate: new Date().toLocaleTimeString()
        }));
        addLog(\`Foul on \${args.team}: \${args.type}\`, 'foul');
      } else if (name === 'update_game_clock') {
        const { clock, period } = args;
        setGameState(prev => ({
            ...prev,
            gameClock: clock,
            quarter: period !== undefined ? Number(period) : prev.quarter,
            lastUpdate: new Date().toLocaleTimeString()
        }));
      } else if (name === 'log_action') {
        const { action_type, description, player_number, is_free_throw } = args;
        const typeStr = is_free_throw ? \`FT \${action_type}\` : action_type;
        const playerStr = player_number ? \` (#\${player_number})\` : '';
        addLog(\`[\${typeStr}] \${description}\${playerStr}\`, 'analysis');
      }

      // Send response back
      session.sendToolResponse({
        functionResponses: {
          id: id,
          name: name,
          response: { result }
        }
      });
    });
  }, [addLog]);

  // --- Start Live Session ---
  const startSession = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // 1. Get Microphone Stream (Always needed for user commands)
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
        }
      });

      // 2. Get Video Stream (Camera or Screen)
      let videoStream: MediaStream;
      if (videoSource === 'screen') {
          try {
              videoStream = await navigator.mediaDevices.getDisplayMedia({
                  video: {
                      width: 1280, 
                      height: 720
                  },
                  audio: true // Attempt to capture system/tab audio
              });
              addLog("Screen sharing started.", "info");
          } catch (err) {
              console.error("Screen share cancelled", err);
              addLog("Screen share cancelled.", "info");
              return; // Abort if cancelled
          }
      } else {
          videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: 640, 
                height: 360,
                frameRate: 15
            } 
          });
      }

      // Combine for local reference (we keep them separate for processing)
      streamRef.current = new MediaStream([
          ...micStream.getAudioTracks(),
          ...videoStream.getVideoTracks()
      ]);

      // Set Video Element Source
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play();
      }

      // Connect to Gemini Live
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: \`You are an expert basketball scorekeeper and commentator AI called "CourtSide". 
          Your job is to watch the video stream of a basketball game and:
          1. Provide excited, real-time commentary on the action.
          2. ACCURATELY update the score using the "update_score" tool whenever a basket is made. 
          
          3. VISUAL ANALYSIS GUIDELINES (CRITICAL):
             - IDENTIFYING PLAYERS: Look for jersey numbers on the front and back of jerseys. If numbers are not clearly visible, look for defining features (e.g., "Player with red shoes"). When calling tools, ALWAYS include the 'player_number' if you are at least 70% sure.
             - SHOT DISTANCE (2 vs 3): Analyze the player's feet position relative to the 3-point arc at the moment of the shot. 
               * FEET BEHIND LINE = 3 POINTS.
               * ANY PART OF FOOT ON LINE = 2 POINTS.
               * INSIDE LINE = 2 POINTS.
             - FOUL DETECTION: Watch for referee signals (whistle blowing, hand signals for pushing, holding, charging). Watch for physical contact that disrupts the play. Use "update_fouls" immediately when a foul occurs.
             - FREE THROWS: Explicitly identify Free Throw situations. These are not "Live Play".

          4. SCORING EXECUTION:
             - Pass the correct 'shot_type' ('2FG' or '3FG', or 'FT') to the "update_score" tool.
             - ESTIMATE COURT LOCATION: Provide "location_x" (0-100, where 0 is left sideline, 100 is right sideline) and "location_y" (0-100, where 0 is the hoop/baseline, 100 is halfcourt).

          5. GAME CLOCK: If a scoreboard or game clock is visible in the video feed, you MUST keep the app's clock and score synchronized with it using "update_game_clock" and "update_score". Prioritize the visible scoreboard data.

          6. MOVEMENT & ACTION LOGGING:
             - Actively analyze player movements such as Dribbling (driving to hoop), Passing (assists, cross-court), and Shooting mechanics.
             - Use the "log_action" tool to record significant events that don't immediately change the score.
             
          Be concise and sharp. Do not hallucinate scores. If unsure, ask for clarification.\`,
          tools: tools,
        },
        callbacks: {
          onopen: () => {
            addLog("Connected to Gemini Live. Analyzing court...", "info");
            processAudioInput(micStream); // Always use mic for commands
            processVideoInput();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
               playAudioResponse(base64Audio);
            }

            // Handle Tool Calls
            if (message.toolCall && sessionPromiseRef.current) {
                const session = await sessionPromiseRef.current;
                handleToolCall(message.toolCall, session);
            }
          },
          onclose: () => {
            addLog("Session disconnected.", "info");
            stopSession();
          },
          onerror: (err) => {
            console.error(err);
            addLog("Connection error occurred.", "info");
          }
        }
      });

      setIsStreaming(true);
      setGameState(prev => ({ ...prev, status: GameStatus.LIVE }));

    } catch (err) {
      console.error("Failed to start session:", err);
      addLog("Failed to access inputs or connect to API.", "info");
    }
  };

  // --- Stop Session ---
  const stopSession = () => {
    setIsStreaming(false);
    
    // Stop intervals
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);

    // Stop tracks
    if (videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(t => t.stop());
         videoRef.current.srcObject = null;
    }
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
    }
    
    // Close Audio Contexts
    inputAudioContextRef.current?.close();
    audioContextRef.current?.close();

    // Reset Refs
    sessionPromiseRef.current = null;
    streamRef.current = null;
    nextStartTimeRef.current = 0;
    
    setGameState(prev => ({ ...prev, status: GameStatus.PAUSED }));
  };

  // --- Process Audio Input ---
  const processAudioInput = (stream: MediaStream) => {
    if (!inputAudioContextRef.current) return;
    
    const source = inputAudioContextRef.current.createMediaStreamSource(stream);
    const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Simple volume meter logic
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      setAudioVolume(Math.sqrt(sum / inputData.length));

      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromiseRef.current?.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(processor);
    processor.connect(inputAudioContextRef.current.destination);
  };

  // --- Process Video Input ---
  const processVideoInput = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const sendFrame = async () => {
        if (!ctx || !videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        
        canvasRef.current!.width = videoRef.current.videoWidth / 2; // Downscale for bandwidth
        canvasRef.current!.height = videoRef.current.videoHeight / 2;
        
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
        
        canvasRef.current!.toBlob(async (blob) => {
            if (blob) {
                const base64 = await blobToBase64(blob);
                sessionPromiseRef.current?.then(session => {
                    session.sendRealtimeInput({
                        media: {
                            mimeType: 'image/jpeg',
                            data: base64
                        }
                    });
                });
            }
        }, 'image/jpeg', 0.6);
    };

    // 2 FPS for video analysis is usually enough for general context, 
    // but for sports maybe 5-10 is better. Live API supports high rates.
    // Let's go with 2FPS to save bandwidth in this demo unless specific action occurs.
    // Actually, Live API handles streaming well. Let's do 500ms (2fps).
    frameIntervalRef.current = window.setInterval(sendFrame, 500);
  };

  // --- Play Audio Response ---
  const playAudioResponse = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    const arrayBuffer = base64ToUint8Array(base64Audio);
    const audioBuffer = await decodeAudioData(arrayBuffer, audioContextRef.current);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    
    const outputNode = audioContextRef.current.createGain();
    outputNode.gain.value = 1.0; 
    
    source.connect(outputNode);
    outputNode.connect(audioContextRef.current.destination);

    // Schedule playback
    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    
    source.onended = () => {
        sourcesRef.current.delete(source);
    };
    sourcesRef.current.add(source);
  };

  // --- Deep Analysis (Gemini 3 Pro) ---
  const handleDeepAnalysis = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsAnalysing(true);
    addLog("Capturing snapshot for Deep Analysis (Gemini 3 Pro)...", "info");

    try {
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx?.drawImage(videoRef.current, 0, 0);
        
        const blob = await new Promise<Blob | null>(r => canvasRef.current!.toBlob(r, 'image/jpeg', 0.8));
        if(!blob) throw new Error("Failed to capture frame");

        const base64 = await blobToBase64(blob as any);
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Using generateContent with image for Gemini 3 Pro
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                    { text: "Analyze this basketball scene carefully. What is the current formation? Are there any visible fouls or significant player positions? Estimate the energy level of the game." }
                ]
            }
        });

        addLog("Deep Analysis Result:", "analysis");
        addLog(response.text.slice(0, 150) + "...", "info"); // Truncate for log

    } catch (e) {
        console.error(e);
        addLog("Deep analysis failed.", "info");
    } finally {
        setIsAnalysing(false);
    }
  };

  // --- Game Management ---
  const saveGame = (silent = false) => {
    try {
        localStorage.setItem('courtside_game_state', JSON.stringify(gameState));
        if (!silent) {
            addLog("Game saved to local storage!", "info");
            showFeedback('save', 'Saved!');
        } else {
             // Silent log just to keep track
             console.log("Auto-save successful");
        }
    } catch (e) {
        console.error("Failed to save", e);
        addLog("Failed to save game.", "info");
    }
  };

  const loadGame = () => {
    try {
      const savedState = localStorage.getItem('courtside_game_state');
      if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            // Basic check to ensure it looks like valid state
            if (parsedState.home && parsedState.guest) {
               setGameState(parsedState);
               addLog("Game loaded from local storage!", "info");
               showFeedback('load', 'Loaded!');
            } else {
               alert("Invalid save file found.");
            }
        } catch (parseError) {
             alert("Corrupt save file.");
        }
      } else {
        alert("No saved game found!");
      }
    } catch (e) {
      console.error("Failed to load", e);
      addLog("Failed to load game.", "info");
    }
  };

  const startNewGame = () => {
    if(window.confirm("Are you sure you want to start a new game? Any unsaved progress will be lost.")) {
        stopSession();
        setGameState({
            status: GameStatus.IDLE,
            quarter: 1,
            gameClock: '12:00',
            home: { 
                name: 'HOME', 
                score: 0, 
                fouls: 0, 
                timeouts: 3, 
                players: createFreshPlayers('Home') 
            },
            guest: { 
                name: 'GUEST', 
                score: 0, 
                fouls: 0, 
                timeouts: 3, 
                players: createFreshPlayers('Guest') 
            },
            lastUpdate: 'New Game',
            lastActivePlayerId: null
        });
        setLogs([]);
        addLog("New Game Started. Scoreboard reset.", "info");
    }
  };

  // --- Download Source Code ---
  const downloadSource = async () => {
      try {
        const zip = new JSZip();
        Object.entries(PROJECT_FILES).forEach(([path, content]) => {
            zip.file(path, content);
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "courtside-ai-source.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog("Source code downloaded successfully.", "info");
      } catch (error) {
          console.error("Download failed", error);
          addLog("Failed to generate zip file.", "info");
      }
  };

  return (
    <div className="min-h-screen bg-court-900 text-white font-sans selection:bg-court-accent selection:text-white pb-20">
      {/* Header */}
      <header className="bg-court-900/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-court-accent rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
                <h1 className="font-bold text-xl tracking-tight">CourtSide<span className="text-court-accent">AI</span></h1>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Game Management Buttons */}
               <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
                  <button 
                    onClick={startNewGame}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs font-mono font-bold uppercase tracking-wider px-2 py-1"
                    title="Start New Game (Reset)"
                  >
                    <RefreshCw size={14} />
                    <span className="hidden sm:inline">New Game</span>
                  </button>
                  <button 
                    onClick={() => saveGame(false)}
                    className="flex items-center gap-2 text-gray-400 hover:text-court-accent transition-colors text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 min-w-[70px]"
                    title="Save Game to Local Storage"
                  >
                    {buttonFeedback['save'] ? <Check size={14} className="text-green-500" /> : <Save size={14} />}
                    {buttonFeedback['save'] || <span className="hidden sm:inline">Save</span>}
                  </button>
                  <button 
                    onClick={loadGame}
                    className="flex items-center gap-2 text-gray-400 hover:text-court-accent transition-colors text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 min-w-[70px]"
                    title="Load Game from Local Storage"
                  >
                    {buttonFeedback['load'] ? <Check size={14} className="text-green-500" /> : <FolderOpen size={14} />}
                    {buttonFeedback['load'] || <span className="hidden sm:inline">Load</span>}
                  </button>
               </div>

               <button 
                  onClick={downloadSource}
                  className="flex items-center gap-2 bg-court-800 hover:bg-court-700 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono transition-all"
               >
                  <Download size={14} />
                  SOURCE
               </button>
               <div className="hidden md:flex items-center gap-2 text-xs font-mono text-gray-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  SYSTEM READY
               </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-6 gap-6 grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Column: Vision/Camera */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-video shadow-2xl border border-white/10 group">
             <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                muted 
                playsInline 
             />
             <canvas ref={canvasRef} className="hidden" />
             
             {/* Overlay UI */}
             {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                   <div className="p-4 bg-white/5 rounded-full mb-4">
                      {videoSource === 'screen' ? <Monitor size={48} className="text-gray-400" /> : <Camera size={48} className="text-gray-400" />}
                   </div>
                   <h2 className="text-xl font-medium text-gray-300">
                       {videoSource === 'screen' ? 'Ready to Share Screen' : 'Camera Offline'}
                   </h2>
                   <p className="text-sm text-gray-500 mt-2">
                       {videoSource === 'screen' ? 'Click "Start Live Tracking" to select a window' : 'Start live tracking to activate vision'}
                   </p>
                </div>
             )}
             
             {/* Live Indicators */}
             {isStreaming && (
                <>
                <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                        {videoSource === 'screen' ? 'SCREEN LIVE' : 'LIVE CAM'}
                    </span>
                    <span className="bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider font-mono">
                        GEMINI 2.5 LIVE
                    </span>
                </div>
                
                {/* Active Modality Status Indicators */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <div className={\`flex items-center gap-1.5 px-2 py-1 rounded-md border backdrop-blur-md transition-all \${
                        audioVolume > 0.01 
                        ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                        : 'bg-black/40 border-white/10 text-gray-400'
                    }\`}>
                        <Mic size={12} className={audioVolume > 0.01 ? 'animate-pulse' : ''} />
                        <span className="text-[10px] font-mono font-bold uppercase">Audio</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-blue-500/20 border-blue-500/50 text-blue-400 backdrop-blur-md">
                        <Eye size={12} />
                        <span className="text-[10px] font-mono font-bold uppercase">Vision</span>
                    </div>
                </div>
                </>
             )}
          </div>

          <ControlPanel 
            isStreaming={isStreaming} 
            onToggleStream={isStreaming ? stopSession : startSession}
            onAnalyzeSnapshot={handleDeepAnalysis}
            isAnalysing={isAnalysing}
            volume={audioVolume}
            videoSource={videoSource}
            onSourceChange={setVideoSource}
          />
        </div>

        {/* Right Column: Data/Scoreboard */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <Scoreboard 
             gameState={gameState} 
             onUpdateTeamName={updateTeamName} 
             onUpdateScore={updateTeamScore}
             onUpdatePlayerStat={updatePlayerStat}
             onUpdatePlayer={updatePlayer}
             onToggleClock={toggleClock}
             onResetClock={resetClock}
             onAdvanceQuarter={advanceQuarter}
           />
           
           <LiveLog logs={logs} />
           
           {/* Instructions / Tips */}
           <div className="bg-court-800/50 rounded-2xl p-5 border border-white/5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Voice Commands</h4>
              <div className="space-y-2">
                 {["What's the score?", "Who committed that foul?", "Reset the home score", "Analyze the defense"].map((cmd, i) => (
                    <div key={i} className="text-sm text-gray-300 bg-white/5 px-3 py-2 rounded-lg hover:bg-white/10 transition cursor-default">
                       "{cmd}"
                    </div>
                 ))}
              </div>
           </div>
        </div>

      </main>
    </div>
  );
}`
};
