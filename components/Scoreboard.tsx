import React, { useMemo, useState } from 'react';
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
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedTeam === 'home' ? 'bg-court-accent text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {gameState.home.name}
                            </button>
                            <button 
                                onClick={() => setSelectedTeam('guest')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${selectedTeam === 'guest' ? 'bg-court-accent text-white' : 'text-gray-400 hover:text-white'}`}
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
                                className={`absolute w-3 h-3 rounded-full border border-white/50 shadow-sm transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold cursor-crosshair z-10 hover:z-20 hover:scale-150 transition-transform ${shot.made ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                                style={{ 
                                    left: `${shot.x}%`, 
                                    bottom: `${shot.y}%` 
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
                                    left: `${hoveredShot.x}%`, 
                                    bottom: `${hoveredShot.y + 4}%`,
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
                                             return `${p.fg3m}-${p.fg3a}`;
                                         }
                                         return `${p.fgm - p.fg3m}-${p.fga - p.fg3a}`;
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
  <div className={`flex flex-col ${align === 'right' ? 'items-end' : 'items-start'} space-y-1`}>
    <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2">
      {label}
    </h3>
    <div className="relative group">
      <input
        type="text"
        value={team.name}
        onChange={(e) => onNameChange(e.target.value)}
        className={`text-xl md:text-2xl font-black text-white bg-transparent border-b-2 border-transparent hover:border-white/20 focus:border-court-accent focus:outline-none w-[120px] md:w-[160px] truncate transition-all ${align === 'right' ? 'text-right' : 'text-left'}`}
        placeholder="Team Name"
      />
      <Edit2 size={12} className={`absolute top-1/2 -translate-y-1/2 text-gray-500 transition-opacity pointer-events-none ${align === 'right' ? '-left-4' : '-right-4'}`} />
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
                                className={`group transition-all duration-500 ${
                                    isActive 
                                        ? 'bg-court-accent/20 border-l-2 border-court-accent' 
                                        : 'hover:bg-white/5 border-l-2 border-transparent'
                                } ${!p.isCourt ? 'opacity-50' : ''}`}
                              >
                                  <td className="py-1 pl-1">
                                      <input 
                                        type="number"
                                        value={p.number}
                                        onChange={(e) => onStatChange(p.id, 'number', e.target.value)}
                                        className={`w-6 bg-transparent text-xs font-mono focus:outline-none focus:text-white ${isActive ? 'text-white font-bold' : 'text-gray-400'}`}
                                      />
                                  </td>
                                  <td 
                                    className={`py-1 pr-2 cursor-pointer ${isActive ? 'text-white' : 'text-gray-300'}`}
                                    onClick={() => onEditPlayer(p)}
                                    title="Click to edit player details"
                                  >
                                      <div className="flex flex-col justify-center h-full max-w-[80px]">
                                          <span className="truncate font-medium text-xs hover:text-court-accent hover:underline decoration-court-accent/50">{p.name}</span>
                                          {/* Stamina Bar */}
                                          <div className="w-full h-[2px] bg-white/10 mt-0.5 rounded-full overflow-hidden" title={`Est. Stamina: ${Math.round(staminaPct)}%`}>
                                              <div className={`h-full ${staminaColor} transition-all duration-1000`} style={{ width: `${staminaPct}%` }} />
                                          </div>
                                      </div>
                                  </td>
                                  <td className={`py-1 font-mono text-right font-bold ${isActive ? 'text-white scale-110' : 'text-court-accent'}`}>
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
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            selectedTeam === 'home' 
                                ? 'bg-court-accent text-white shadow-md' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {gameState.home.name}
                    </button>
                    <button
                        onClick={() => setSelectedTeam('guest')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            selectedTeam === 'guest' 
                                ? 'bg-court-accent text-white shadow-md' 
                                : 'text-gray-400 hover:text-white'
                        }`}
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
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                            activeTab === tab 
                                ? 'bg-court-accent text-white shadow-lg shadow-court-accent/25' 
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
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
                                    <td key={col} className={`py-1 text-right pr-2 ${calculateStat(p, col) === "NA" ? "text-gray-600" : "text-gray-300"}`}>
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
                <span className={`text-2xl md:text-3xl font-mono font-bold tracking-wider ${gameState.status === GameStatus.LIVE ? 'text-red-500' : 'text-gray-400'}`}>
                  {gameState.gameClock}
                </span>
              </div>
              
              {/* Clock Controls */}
              <div className="flex items-center gap-2">
                 <button 
                   onClick={onToggleClock}
                   className={`p-1.5 rounded-full transition-all ${gameState.status === GameStatus.LIVE ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
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
         <span className={`flex items-center gap-2 ${gameState.status === 'LIVE' ? 'text-red-500' : 'text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${gameState.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
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
};