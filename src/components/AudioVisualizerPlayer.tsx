import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

interface AudioVisualizerPlayerProps {
  src: string;
}

export const AudioVisualizerPlayer: React.FC<AudioVisualizerPlayerProps> = ({ src }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#3f3f46', // zinc-600
      progressColor: '#a1a1aa', // zinc-400
      cursorColor: '#f4f4f5', // zinc-100
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1.5,
      barRadius: 2,
      height: 48,
      normalize: true,
      url: src,
    });

    waveSurferRef.current = ws;

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    
    const formatTime = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    ws.on('ready', () => {
      setDuration(formatTime(ws.getDuration()));
    });

    ws.on('audioprocess', () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    ws.on('click', () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    return () => {
      ws.destroy();
    };
  }, [src]);

  const togglePlay = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
    }
  };

  return (
    <div className="flex flex-col gap-2.5 bg-[#18181b] p-3 rounded-xl border border-zinc-800/40 overflow-hidden text-[13px]">
      {/* Waveform Visualization Container */}
      <div 
        ref={containerRef} 
        className="w-full bg-zinc-950/40 rounded-lg p-1.5" 
      />

      {/* Control Actions Row (No Glows!) */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <button
          onClick={togglePlay}
          className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded-lg transition-colors cursor-pointer select-none"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current text-zinc-100" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current text-zinc-100 ml-0.5" />
          )}
        </button>

        <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
          <span>{currentTime}</span>
          <span className="text-zinc-700">/</span>
          <span>{duration}</span>
        </div>
      </div>
    </div>
  );
};
