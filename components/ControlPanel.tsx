import React from 'react';
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
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                isStreaming 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
                : 'bg-court-accent text-white hover:bg-court-accent/80 shadow-lg shadow-court-accent/20'
            }`}
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
                            style={{ width: `${Math.min(volume * 100 * 3, 100)}%` }}
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
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          videoSource === 'camera' 
                              ? 'bg-court-700 text-white shadow-sm' 
                              : 'text-gray-400 hover:text-white'
                      }`}
                  >
                      <Smartphone size={14} />
                      Camera
                  </button>
                  <button
                      onClick={() => onSourceChange('screen')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          videoSource === 'screen' 
                              ? 'bg-court-700 text-white shadow-sm' 
                              : 'text-gray-400 hover:text-white'
                      }`}
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
};