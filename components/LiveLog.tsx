import React, { useRef, useEffect } from 'react';
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
              <span className={`${log.type === 'score' ? 'text-green-300' : 'text-gray-300'}`}>
                {log.message}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
