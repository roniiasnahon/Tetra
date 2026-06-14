import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { Icon } from '@iconify/react';
import { Tab, ChatMessage } from '../App';
import { TypewriterMarkdown } from './TypewriterMarkdown';

interface MainChatProps {
  tab: Tab;
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isAiTyping: boolean;
  handleSendMessage: (customText?: string, options?: { isHidden?: boolean; fromSidePanel?: boolean }) => Promise<void>;
  researchStatus: 'fetching' | 'downloading' | 'polishing' | null;
  currentUser: any;
  isOnline?: boolean;
}

const renderLinkifiedText = (text: string) => {
  if (!text) return "";
  const urlPattern = /(\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  const parts = text.split(urlPattern);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      const href = part.toLowerCase().startsWith('www.') ? `http://${part}` : part;
      return <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{part}</a>;
    }
    return part;
  });
};

export const MainChat: React.FC<MainChatProps> = ({ 
  tab, 
  messages, 
  chatInput, 
  setChatInput, 
  isAiTyping, 
  handleSendMessage, 
  researchStatus,
  currentUser,
  isOnline = true
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping, researchStatus]);

  const onSend = () => {
    if (!chatInput.trim() || isAiTyping) return;
    handleSendMessage();
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full bg-[#121212] relative">
      <div className={`flex-grow flex flex-col h-full overflow-hidden transition-all duration-300 ${!isOnline ? "blur-[6px] select-none pointer-events-none" : ""}`}>
        <div className="flex-1 flex flex-col items-center pt-2 pb-6 px-4 md:px-6 h-full overflow-y-auto custom-scrollbar-h">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl">
              <img src="/cosmi.png" alt="Cosmi Logo" className="w-48 h-48 md:w-64 md:h-64 opacity-40 select-none grayscale invert" />
            </div>
          ) : (
            <div className="w-full max-w-3xl flex flex-col gap-4 pb-8">
              {messages.filter(m => !m.isHidden).map((m) => (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${
                    m.role === 'user' 
                      ? 'items-end' 
                      : 'items-start'
                  } w-full`}
                >
                  <div className={`max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-[#1a1a1a] text-white rounded-2xl px-5 py-3.5 border border-[#27272a]' 
                      : 'w-full text-[#d4d4d8] py-2'
                  } text-[15px] leading-[1.6]`}>
                    {m.role === 'assistant' && m.thought && (
                      <div className="mb-4">
                        <details className="group [&_summary::-webkit-details-marker]:hidden">
                          <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors select-none w-fit">
                            <Icon icon="ph:brain" className="w-4 h-4" />
                            <span>Thought Process</span>
                            <Icon icon="ph:caret-right" className="w-3 h-3 group-open:rotate-90 transition-transform" />
                          </summary>
                          <div className="mt-2 pl-3.5 border-l border-zinc-800 text-[13px] text-zinc-400 font-sans leading-relaxed markdown-body">
                            <ReactMarkdown>{m.thought}</ReactMarkdown>
                          </div>
                        </details>
                      </div>
                    )}
                    <div className={`select-text break-words ${m.role === 'user' ? 'whitespace-pre-wrap' : 'markdown-body text-[#d4d4d8]'}`}>
                      {m.role === 'user' ? (
                        renderLinkifiedText(m.content)
                      ) : (
                        <TypewriterMarkdown 
                          content={m.content} 
                          timestamp={m.timestamp} 
                          isStreaming={isAiTyping && m.id === messages[messages.length - 1]?.id} 
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(isAiTyping || researchStatus) && (
                <div className="self-start py-2 max-w-full text-[14px] leading-relaxed select-none">
                  <span className="shimmer-text font-medium text-zinc-500">
                    {researchStatus === 'fetching' ? 'Fetching...' : 
                     researchStatus === 'downloading' ? 'Downloading...' :
                     researchStatus === 'polishing' ? 'Polishing...' : 
                     'Processing input...'}
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 p-6 flex flex-col items-center gap-4">
          <div className="w-full max-w-3xl bg-[#1a1a1a] border border-[#2d2d30] rounded-[28px] p-1.5 flex flex-col transition-all focus-within:border-zinc-700">
            <TextareaAutosize 
              key={`main-chat-input-${tab.id}`}
              id={`main-chat-input-${tab.id}`}
              name={`main-chat-input-${tab.id}`}
              autoComplete="off"
              placeholder="Ask about anything, / for skills, @ for context..."
              value={chatInput}
              onChange={(e) => {
                const val = e.target.value;
                setChatInput(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              className="w-full bg-transparent text-[15px] text-[#e4e4e7] placeholder-[#52525b] py-3 px-4 resize-none focus:outline-none min-h-[52px] max-h-[300px] leading-relaxed"
            />
            
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div className="flex items-center gap-1">
                <button className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-[#222222] rounded-xl transition-colors text-[13px] text-[#71717a] hover:text-[#e4e4e7] cursor-pointer">
                  <span className="font-medium">Auto</span>
                  <Icon icon="ph:caret-down" className="w-3 h-3" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={onSend}
                  disabled={!chatInput.trim() || isAiTyping}
                  className={`p-2 bg-white text-zinc-950 rounded-full transition-all flex items-center justify-center w-9 h-9 ${
                    chatInput.trim() && !isAiTyping
                      ? 'opacity-100 hover:bg-zinc-200 cursor-pointer' 
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <Icon icon="ph:arrow-up-bold" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isOnline && (
        <div className="absolute inset-0 bg-transparent z-[99] flex flex-col items-center justify-center p-6 text-center animate-fade-in pointer-events-auto">
          <div className="bg-[#1a1a1a]/95 border border-zinc-805 rounded-2xl p-6 max-w-xs flex flex-col items-center gap-3.5 shadow-xl select-none border-zinc-800">
            <div className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <Icon icon="ph:wifi-slash" className="w-[20px] h-[20px]" />
            </div>
            <div>
              <h3 className="text-white font-medium text-[13.5px] tracking-tight mb-1">
                You are currently offline
              </h3>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Connect your account to the network to chat with the AI research assistant. Local notebook features, document drafting, and data analyses remain fully available.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
