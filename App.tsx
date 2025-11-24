import React, { useState, useRef, useEffect, useCallback } from 'react';
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
      id: `${prefix}-${i}`,
      number: (i + 1) * 10 + Math.floor(Math.random() * 9),
      name: `${prefix} Player ${i + 1}`,
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
    id: `${prefix}-${i}`,
    number: (i + 1) * 10 + Math.floor(Math.random() * 9),
    name: `${prefix} Player ${i + 1}`,
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
const syncScoreboardTool: FunctionDeclaration = {
  name: 'sync_scoreboard',
  description: 'Synchronize the app scoreboard with the visible on-screen scoreboard overlay. Use this when you first connect or whenever you see the broadcast scoreboard. This SETS the absolute score values.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      home_score: { type: Type.NUMBER, description: 'The HOME team\'s current score shown on the visible scoreboard.' },
      guest_score: { type: Type.NUMBER, description: 'The GUEST/AWAY team\'s current score shown on the visible scoreboard.' },
      home_team_name: { type: Type.STRING, description: 'The HOME team name if visible (e.g., "TULANE").' },
      guest_team_name: { type: Type.STRING, description: 'The GUEST team name if visible (e.g., "BOSTON COLLEGE").' },
    },
    required: ['home_score', 'guest_score']
  }
};

const updateScoreTool: FunctionDeclaration = {
  name: 'update_score',
  description: 'Update the score for a specific team when a basket is made or points are awarded. This ADDS points.',
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

const tools = [{ functionDeclarations: [syncScoreboardTool, updateScoreTool, updateFoulsTool, updateClockTool, logActionTool] }];

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

      if (name === 'sync_scoreboard') {
        // Sync with visible on-screen scoreboard
        const homeScore = Number(args.home_score);
        const guestScore = Number(args.guest_score);
        const homeTeamName = args.home_team_name;
        const guestTeamName = args.guest_team_name;

        setGameState(prev => ({
          ...prev,
          home: {
            ...prev.home,
            score: homeScore,
            name: homeTeamName || prev.home.name
          },
          guest: {
            ...prev.guest,
            score: guestScore,
            name: guestTeamName || prev.guest.name
          },
          lastUpdate: new Date().toLocaleTimeString(),
          status: GameStatus.LIVE
        }));

        const teamNames = homeTeamName && guestTeamName
          ? `${homeTeamName} ${homeScore} - ${guestScore} ${guestTeamName}`
          : `${homeScore} - ${guestScore}`;
        addLog(`📊 Synced with broadcast scoreboard: ${teamNames}`, 'info');
      } else if (name === 'update_score') {
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
        addLog(`${args.team} scores ${points}! (${shotType || 'Pts'}) ${args.reason}`, 'score');
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
        addLog(`Foul on ${args.team}: ${args.type}`, 'foul');
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
        const typeStr = is_free_throw ? `FT ${action_type}` : action_type;
        const playerStr = player_number ? ` (#${player_number})` : '';
        addLog(`[${typeStr}] ${description}${playerStr}`, 'analysis');
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
          systemInstruction: `You are an expert basketball scorekeeper and commentator AI called "CourtSide".

          === CRITICAL PRIORITY #1: SCOREBOARD SYNCHRONIZATION ===
          IMMEDIATELY when you first connect and see the video:
          1. Look for ANY scoreboard overlay or graphic in the video (usually at top or bottom of screen)
          2. Read the current score, team names, and game clock from the scoreboard
          3. IMMEDIATELY call "sync_scoreboard" to SET the absolute scores and team names
          4. IMMEDIATELY call "update_game_clock" to SET the clock time and period
          5. Continue to monitor the scoreboard EVERY FEW FRAMES
          6. Whenever the scoreboard changes, call "sync_scoreboard" again to stay in lockstep
          7. The visible scoreboard is the GROUND TRUTH - always trust it over your tracking

          SCOREBOARD READING INSTRUCTIONS:
          - Look for score graphics (e.g., "TEAM A: 92" or just large numbers)
          - Look for team names (e.g., "TULANE", "BOSTON COLLEGE")
          - Look for time displays (e.g., "11.9", "2:34", "12:00")
          - Look for period/quarter indicators (e.g., "OT", "Q4", "2nd")

          TOOL USAGE FOR SYNCING:
          - Use "sync_scoreboard" to SET absolute score values from the broadcast overlay
          - Use "update_game_clock" to SET the clock time and period
          - Use "sync_scoreboard" EVERY time the broadcast score changes
          - This keeps the app in perfect lockstep with the broadcast

          === YOUR OTHER JOBS ===
          1. Provide excited, real-time commentary on the action.
          2. Track individual player stats and shots.

          3. VISUAL ANALYSIS GUIDELINES:
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

          5. MOVEMENT & ACTION LOGGING:
             - Actively analyze player movements such as Dribbling (driving to hoop), Passing (assists, cross-court), and Shooting mechanics.
             - Use the "log_action" tool to record significant events that don't immediately change the score.

          REMEMBER: The on-screen scoreboard is ALWAYS correct. Sync with it constantly. Call tools frequently.`,
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

    // For real-time basketball tracking, we need faster frame rate
    // 5 FPS gives good responsiveness for scoreboard sync and action tracking
    // Live API handles this well and we need it to catch score changes quickly
    frameIntervalRef.current = window.setInterval(sendFrame, 200); // 5 FPS
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
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border backdrop-blur-md transition-all ${
                        audioVolume > 0.01 
                        ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                        : 'bg-black/40 border-white/10 text-gray-400'
                    }`}>
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
}