import React, { useRef, useEffect, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { Icon } from '@iconify/react';
import { Tab, ChatMessage } from '../App';
import { TypewriterMarkdown } from './TypewriterMarkdown';
import { DynamicShimmer } from './DynamicShimmer';

interface MainChatProps {
  tab: Tab;
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isAiTyping: boolean;
  handleSendMessage: (customText?: string, options?: { isHidden?: boolean; fromSidePanel?: boolean }) => Promise<void>;
  handleStopGeneration: () => void;
  researchStatus: 'fetching' | 'downloading' | 'polishing' | 'editor_agent' | null;
  currentUser: any;
  isOnline?: boolean;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (val: boolean) => void;
  attachedFile: { fileId: string; fileName: string; mimetype: string; url: string } | null;
  setAttachedFile: (val: { fileId: string; fileName: string; mimetype: string; url: string } | null) => void;
  handlePaperclipClick: () => void;
}

const modelsList = [
  { id: 'auto', label: 'Auto (Gemini)' },
  { id: 'mistral-large-latest', label: 'Mistral Large' },
  { id: 'ministral-8b-latest', label: 'Ministral 8B Edge' },
  { id: 'codestral-latest', label: 'Codestral Code' },
];

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
  isOnline = true,
  selectedModel,
  setSelectedModel,
  webSearchEnabled,
  webSearchEnabled: _webSearchEnabled, // backup binding
  webSearchEnabled: webSearchVal,
  setWebSearchEnabled,
  attachedFile,
  setAttachedFile,
  handlePaperclipClick,
  handleStopGeneration
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping, researchStatus]);

  const onSend = () => {
    if (!chatInput.trim() || isAiTyping) return;
    handleSendMessage();
  };

  const getSelectedModelLabel = () => {
    const found = modelsList.find(m => m.id === selectedModel);
    return found ? found.label : 'Auto (Gemini)';
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
                  {/* Separate Attachment Bubble */}
                  {m.role === 'user' && m.attachment && (
                    <div className="mb-2 w-fit self-end">
                      {m.attachment.mimetype?.startsWith("image/") ? (
                        <img 
                          src={m.attachment.url} 
                          alt="attachment" 
                          className="w-48 h-auto max-h-64 object-cover rounded-xl border border-zinc-800 cursor-zoom-in hover:border-zinc-500 transition-all pointer-events-auto"
                          onClick={() => window.open(m.attachment!.url, "_blank")}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="max-w-[85%] bg-[#1a1a1a] rounded-2xl p-2.5 border border-[#27272a] flex items-center gap-3 w-fit">
                          <div className="w-10 h-10 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                            <Icon icon="ph:file-text" className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-semibold text-zinc-200 truncate pr-2 max-w-[150px]">{m.attachment.fileName}</p>
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide mt-0.5">
                              DOCUMENT FILE
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  {(!m.attachment || (m.content && m.content.trim().length > 0) || m.role !== 'user') && (
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
                  )}
                </div>
              ))}
              {(isAiTyping || researchStatus) && !(messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content?.trim() && !researchStatus) && (
                <div className="self-start py-2 max-w-full text-[14px] leading-relaxed select-none text-zinc-500">
                  <DynamicShimmer
                    isAiTyping={isAiTyping}
                    researchStatus={researchStatus}
                    messages={messages}
                    webSearchEnabled={webSearchEnabled}
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 p-6 flex flex-col items-center gap-4">
          <div className="w-full max-w-3xl bg-[#1a1a1a] border border-[#2d2d30] rounded-[28px] p-1.5 flex flex-col transition-all focus-within:border-zinc-700">
            {attachedFile && (
              <div className="mx-3 mt-3 animate-fade-in w-fit">
                {attachedFile.mimetype?.startsWith("image/") ? (
                  <div className="relative group w-fit">
                    <img 
                      src={attachedFile.url} 
                      alt="attachment preview" 
                      className="w-16 h-16 object-cover rounded-xl border border-zinc-700"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="absolute -top-2 -right-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md hover:bg-zinc-700 cursor-pointer"
                      title="Remove image"
                    >
                      <Icon icon="ph:x" className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1c] border border-[#2d2d30] rounded-2xl px-3 py-2 flex items-center justify-between gap-3 shadow-sm max-w-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
                        <Icon icon="ph:file-text" className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="text-[13px] font-semibold text-zinc-200 truncate pr-2">{attachedFile.fileName}</p>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                          DOCUMENT FILE
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setAttachedFile(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 hover:bg-zinc-800 rounded-lg shrink-0 cursor-pointer border border-transparent hover:border-zinc-700"
                      title="Remove attachment"
                    >
                      <Icon icon="ph:x" className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

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
            
            <div className="flex items-center justify-between px-2 pb-2 pt-1 relative">
              <div className="flex items-center gap-2">
                {/* Attachment / Upload Trigger */}
                <button 
                  onClick={handlePaperclipClick}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-[#27272a] text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#222222] transition-colors cursor-pointer shrink-0"
                  title="Upload File or Photo"
                >
                  <Icon icon="ph:plus-bold" className="w-[16px] h-[16px]" />
                </button>

                {/* Web Search Grounding Toggle */}
                <button 
                  onClick={() => setWebSearchEnabled(!webSearchVal)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-xs font-semibold cursor-pointer border ${
                    webSearchVal 
                      ? 'bg-zinc-800 border-zinc-600 text-white' 
                      : 'border-[#27272a] text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#222222]'
                  }`}
                >
                  <Icon icon={webSearchVal ? "ph:globe-hemisphere-east-fill" : "ph:globe"} className="w-3.5 h-3.5" />
                  <span>Web</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                {isAiTyping ? (
                  <button 
                    onClick={handleStopGeneration}
                    className="bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-full transition-all flex items-center justify-center w-9 h-9 cursor-pointer relative ease-out duration-150"
                  >
                    <Icon icon="ph:spinner-gap" className="w-6 h-6 animate-spin absolute" />
                    <Icon icon="ph:stop-fill" className="w-3 h-3" />
                  </button>
                ) : (
                  <button 
                    onClick={onSend}
                    disabled={!chatInput.trim()}
                    className={`p-2 bg-white text-zinc-950 rounded-full transition-all flex items-center justify-center w-9 h-9 ${
                      chatInput.trim()
                        ? 'opacity-100 hover:bg-zinc-200 cursor-pointer' 
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Icon icon="ph:arrow-up-bold" className="w-5 h-5" />
                  </button>
                )}
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
