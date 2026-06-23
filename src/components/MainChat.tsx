import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { Icon } from './SolarIcon';
import { Tab, ChatMessage, PaperItem } from '../App';
import { TypewriterMarkdown } from './TypewriterMarkdown';
import { DynamicShimmer } from './DynamicShimmer';
import { Plain2, PaperclipRounded2 } from '@solar-icons/react';
import { Plus } from 'lucide-react';

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
  thinkingLevel: 'Standard' | 'Deep' | 'Instant';
  setThinkingLevel: (val: 'Standard' | 'Deep' | 'Instant') => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (val: boolean) => void;
  attachedFile: { fileId: string; fileName: string; mimetype: string; url: string } | null;
  setAttachedFile: (val: { fileId: string; fileName: string; mimetype: string; url: string } | null) => void;
  handlePaperclipClick: () => void;
  papers?: PaperItem[];
}

export const modelsList = [
  { id: 'auto', label: 'Composition I', desc: 'Fast and versatile; great for daily homework and file analysis' },
  { id: 'hokku-iv', label: 'Hokku IV', desc: 'Deep reasoning for complex physics, math, and philosophy' },
  { id: 'mistral-large-latest', label: 'Sift II', desc: 'Advanced logic and excellent for language translation' },
  { id: 'codestral-latest', label: 'Kindle Preview', desc: 'Technical specialist for coding, math, and logic puzzles' },
  { id: 'command-a-plus-05-2026', label: 'Raisee V', desc: 'Creative partner for writing, brainstorming, and essay drafts' },
];

const renderLinkifiedText = (text: string) => {
  if (!text) return "";
  const urlPattern = /(\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  const parts = text.split(urlPattern);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      const href = part.toLowerCase().startsWith('www.') ? `http://${part}` : part;
      return <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline decoration-dashed decoration-skip-ink underline-offset-[3px] hover:text-blue-300 transition-colors">{part}</a>;
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
  thinkingLevel,
  setThinkingLevel,
  webSearchEnabled,
  webSearchEnabled: _webSearchEnabled, // backup binding
  webSearchEnabled: webSearchVal,
  setWebSearchEnabled,
  attachedFile,
  setAttachedFile,
  handlePaperclipClick,
  handleStopGeneration,
  papers = []
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isThinkingMenuOpen, setIsThinkingMenuOpen] = useState(false);
  const [isMoreModelsOpen, setIsMoreModelsOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollPositionsRef = useRef<Record<string, number>>({});
  const lastTabIdRef = useRef<string | null>(tab.id);
  const previousMessageCountRef = useRef<number>(messages?.length || 0);

  const [mentionState, setMentionState] = useState<{
    show: boolean;
    query: string;
    startIndex: number;
    selectedIndex: number;
  }>({
    show: false,
    query: "",
    startIndex: -1,
    selectedIndex: 0,
  });

  const filteredPapers = papers.filter((p: any) => {
    if (!p.title) return false;
    return p.title.toLowerCase().includes(mentionState.query.toLowerCase());
  });

  const handleTextareaChange = (val: string, selectionStart: number) => {
    setChatInput(val);

    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAtSymbolIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbolIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtSymbolIndex + 1);
      if (!query.includes(' ') && lastAtSymbolIndex === textBeforeCursor.length - 1 - query.length) {
        setMentionState({
          show: true,
          query,
          startIndex: lastAtSymbolIndex,
          selectedIndex: 0,
        });
        return;
      }
    }
    setMentionState({ show: false, query: "", startIndex: -1, selectedIndex: 0 });
  };

  const selectPaper = (paper: any) => {
    if (!mentionState.show) return;

    const val = chatInput;
    const beforeMention = val.slice(0, mentionState.startIndex);
    const selectionStart = mainTextareaRef.current ? mainTextareaRef.current.selectionStart : val.length;
    const afterMention = val.slice(selectionStart);
    const replacement = "";
    const newValue = beforeMention + replacement + afterMention;

    localStorage.setItem('onboarding_citation_note', 'true');
    setChatInput(newValue);
    setMentionState({ show: false, query: "", startIndex: -1, selectedIndex: 0 });

    if (paper.fileId) {
      setAttachedFile({
        fileId: paper.fileId,
        fileName: paper.title,
        mimetype: paper.mimetype || 'application/pdf',
        url: paper.url || ''
      });
    }

    setTimeout(() => {
      if (mainTextareaRef.current) {
        mainTextareaRef.current.focus();
        const cursorPosition = beforeMention.length + replacement.length;
        mainTextareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 50);
  };

  const scrollToBottom = React.useCallback((instant = true) => {
    const fn = () => {
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    };
    fn();
    // Safety check sequence for asynchronous layouts/markdown parsing
    setTimeout(fn, 10);
    setTimeout(fn, 50);
    setTimeout(fn, 150);
  }, []);

  React.useLayoutEffect(() => {
    if (tab.id !== lastTabIdRef.current) {
      // Tab switched
      lastTabIdRef.current = tab.id;
      if (tab.id && chatScrollPositionsRef.current[tab.id] !== undefined) {
        if (chatScrollContainerRef.current) {
          chatScrollContainerRef.current.scrollTop = chatScrollPositionsRef.current[tab.id];
        }
      } else {
        scrollToBottom(true);
      }
    } else {
      const length = messages?.length || 0;
      if (length > previousMessageCountRef.current) {
        scrollToBottom(false);
      } else if (isAiTyping || researchStatus) {
        scrollToBottom(true);
      }
    }
    previousMessageCountRef.current = messages?.length || 0;
  }, [messages, isAiTyping, researchStatus, tab.id, scrollToBottom]);

  const onSend = () => {
    if (!chatInput.trim() || isAiTyping) return;
    handleSendMessage();
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full bg-[#121212] relative">
      <div className={`flex-grow flex flex-col h-full overflow-hidden transition-all duration-300 ${!isOnline ? "blur-[6px] select-none pointer-events-none" : ""}`}>
        <div 
          ref={chatScrollContainerRef}
          onScroll={(e) => {
            if (tab.id) {
              chatScrollPositionsRef.current[tab.id] = e.currentTarget.scrollTop;
            }
          }}
          className="flex-1 flex flex-col items-center pt-2 pb-6 px-4 md:px-6 h-full overflow-y-auto custom-scrollbar-h"
        >
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
                          <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0">
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
                        ? 'bg-[#1a1a1a] text-white rounded-full px-6 py-3 border border-[#27272a]' 
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

        <div className="shrink-0 px-6 pb-1.5 pt-1 flex flex-col items-center gap-2">
          <div className="w-full max-w-2xl bg-[#1a1a1a] rounded-[28px] p-2 flex flex-col transition-all relative">
            {/* Mention dropdown */}
            <AnimatePresence>
              {mentionState.show && filteredPapers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full left-4 mb-2 w-[320px] bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-1.5 shadow-xl z-[150] flex flex-col gap-0.5 max-h-[220px] overflow-y-auto"
                >
                  <div className="px-2 py-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-850 mb-1">
                    Your Library Documents ({filteredPapers.length})
                  </div>
                  {filteredPapers.map((p, idx) => {
                    const isSelected = idx === mentionState.selectedIndex;
                    return (
                      <button
                        key={p.fileId || p.title + idx}
                        onClick={() => selectPaper(p)}
                        onMouseEnter={() => setMentionState(prev => ({ ...prev, selectedIndex: idx }))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left ${
                          isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Icon icon="ph:file-pdf" className="w-4 h-4 text-rose-450 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-medium truncate">{p.title}</span>
                          {p.author && (
                            <span className="text-[10px] text-zinc-500 truncate">{p.author}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {attachedFile && (
              <div className="mx-2 mt-1 mb-2 animate-fade-in w-fit">
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
                      <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
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

            <div className="px-3 pt-2 pb-3">
              <TextareaAutosize 
                ref={mainTextareaRef}
                key={`main-chat-input-${tab.id}`}
                id={`main-chat-input-${tab.id}`}
                name={`main-chat-input-${tab.id}`}
                autoComplete="off"
                placeholder="Ask Cosmi..."
                value={chatInput}
                onChange={(e) => {
                  handleTextareaChange(e.target.value, e.target.selectionStart);
                }}
                onKeyDown={(e) => {
                  if (mentionState.show && filteredPapers.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setMentionState(prev => ({
                        ...prev,
                        selectedIndex: (prev.selectedIndex + 1) % filteredPapers.length
                      }));
                      return;
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setMentionState(prev => ({
                        ...prev,
                        selectedIndex: (prev.selectedIndex - 1 + filteredPapers.length) % filteredPapers.length
                      }));
                      return;
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      selectPaper(filteredPapers[mentionState.selectedIndex]);
                      return;
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setMentionState(prev => ({ ...prev, show: false }));
                      return;
                    }
                  }

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                className="w-full bg-transparent text-[14.5px] text-[#e4e4e7] placeholder-[#52525b] resize-none focus:outline-none min-h-[24px] max-h-[300px] leading-relaxed font-sans"
              />
            </div>

            <div className="flex items-center justify-between px-1">
              {/* Left Plus/Upload Icon */}
              <div className="relative shrink-0 flex items-center gap-2">
                <button 
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                    isPlusMenuOpen
                      ? "bg-[#222222] text-[#e4e4e7]"
                      : "text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#222222]"
                  }`}
                  title="Upload or Search Options"
                >
                  <Plus className={`w-5 h-5 transition-transform duration-200 ${isPlusMenuOpen ? 'rotate-45' : ''}`} />
                </button>

                {webSearchVal && (
                  <button 
                    onClick={() => setWebSearchEnabled(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252528] hover:bg-[#2a2a2d] transition-colors rounded-full text-[#e4e4e7] cursor-pointer group shrink-0"
                  >
                    <Icon icon="ph:globe" className="w-[15px] h-[15px] text-[#a1a1aa] group-hover:text-[#e4e4e7] transition-colors" />
                    <span className="text-[13px] font-normal leading-none font-jakarta">Search web</span>
                  </button>
                )}

                {isPlusMenuOpen && (
                  <>
                    {/* Transparent backdrop overlay for safe close */}
                    <div 
                      className="fixed inset-0 z-[99] bg-transparent" 
                      onClick={() => setIsPlusMenuOpen(false)}
                    />
                    
                    {/* Plus Options Menu */}
                    <div className="absolute bottom-full left-0 mb-2.5 w-[200px] bg-[#1a1a1e] rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5">
                      {/* Upload files */}
                      <button
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          handlePaperclipClick();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-zinc-350 hover:text-white hover:bg-zinc-800/40 transition-none font-jakarta cursor-pointer"
                      >
                        <PaperclipRounded2 weight="Linear" size={18} color="currentColor" />
                        <span className="text-[13px] font-normal text-zinc-300 leading-none">Upload files</span>
                      </button>

                      {/* Web Search Grounding */}
                      <button
                        onClick={() => {
                          setWebSearchEnabled(!webSearchVal);
                          setIsPlusMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left font-jakarta cursor-pointer transition-none ${
                          webSearchVal
                            ? "bg-zinc-800/30 text-zinc-100"
                            : "text-zinc-300 hover:text-white hover:bg-zinc-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon 
                            icon="ph:globe" 
                            className={`w-[18px] h-[18px] shrink-0 ${webSearchVal ? "text-zinc-400" : "text-zinc-500"}`} 
                          />
                          <span className="text-[13px] font-normal text-zinc-300 leading-none">Search web</span>
                        </div>
                        {webSearchVal && (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right Menu and Send */}
              <div className="flex items-center gap-2">
                {/* Model Choosing Dropdown Inline */}
                <div className="relative shrink-0">
                  <button
                  onClick={() => {
                    if (isModelMenuOpen) {
                      setIsThinkingMenuOpen(false);
                    }
                    setIsModelMenuOpen(!isModelMenuOpen);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-xs font-semibold cursor-pointer bg-transparent hover:bg-[#222222] font-jakarta text-[#71717a]"
                  title="Choose AI Model"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-white">
                      {modelsList.find(m => m.id === selectedModel)?.label || 'Composition I'}
                    </span>
                    {thinkingLevel !== 'Standard' && (
                      <span className="text-zinc-400 opacity-50 font-normal text-[10.5px] ml-1">
                        {thinkingLevel}
                      </span>
                    )}
                  </span>
                  <Icon icon="ph:caret-down-bold" className="w-3 h-3 text-zinc-500" />
                </button>

                {isModelMenuOpen && (
                  <>
                    {/* Transparent backdrop overlay for safe close */}
                    <div 
                      className="fixed inset-0 z-[99] bg-transparent" 
                      onClick={() => {
                        setIsModelMenuOpen(false);
                        setIsThinkingMenuOpen(false);
                        setIsMoreModelsOpen(false);
                      }}
                    />
                    {/* Dropdown Menu */}
                    <div className="absolute bottom-full right-0 mb-2 w-[280px] bg-[#1e1e22] rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5">
                      {modelsList.filter(m => !['mistral-large-latest', 'codestral-latest'].includes(m.id)).map((m) => {
                        const isSelected = selectedModel === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedModel(m.id);
                              setIsModelMenuOpen(false);
                              setIsThinkingMenuOpen(false);
                              setIsMoreModelsOpen(false);
                            }}
                            className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                              isSelected ? 'bg-zinc-800/25 text-white' : 'text-zinc-300 hover:text-white'
                            }`}
                          >
                            {/* Left check col */}
                            <div className="w-4 flex items-center justify-center shrink-0 pt-0.5">
                              {isSelected ? (
                                <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                              ) : (
                                <div className="w-3.5" />
                              )}
                            </div>
                            {/* Right aligned text block */}
                            <div className="flex flex-col gap-0.5 text-left min-w-0">
                              <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                {m.label}
                              </span>
                              <span className="text-[11.5px] text-zinc-400 font-jakarta leading-tight">
                                {m.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {/* More Models nested menu */}
                      <div 
                        onClick={() => {
                          setIsMoreModelsOpen(!isMoreModelsOpen);
                          setIsThinkingMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                          isMoreModelsOpen ? 'bg-zinc-800/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 shrink-0 flex items-center justify-center pt-0.5">
                            {['mistral-large-latest', 'codestral-latest'].includes(selectedModel) ? (
                              <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                            ) : (
                              <div className="w-3.5" />
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 text-left">
                            <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">More models</span>
                            <span className="text-[11.5px] text-zinc-400 font-jakarta leading-tight">
                              {['mistral-large-latest', 'codestral-latest'].includes(selectedModel) 
                                ? modelsList.find(m => m.id === selectedModel)?.label 
                                : 'Advanced reasoning & coding specials'}
                            </span>
                          </div>
                        </div>
                        <Icon icon="ph:caret-right-bold" className="w-3 h-3 text-zinc-500 mr-1.5 shrink-0" />
                      </div>

                      {/* Nested Flyout Menu for More Models */}
                      <AnimatePresence>
                        {isMoreModelsOpen && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute left-full bottom-8 ml-2 w-[280px] bg-[#1e1e22] rounded-2xl p-1.5 shadow-2xl z-[101] flex flex-col gap-0.5"
                          >
                            {modelsList.filter(m => ['mistral-large-latest', 'codestral-latest'].includes(m.id)).map((m) => {
                              const isSelected = selectedModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    setSelectedModel(m.id);
                                    setIsModelMenuOpen(false);
                                    setIsThinkingMenuOpen(false);
                                    setIsMoreModelsOpen(false);
                                  }}
                                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                    isSelected ? 'bg-zinc-800/25 text-white' : 'text-zinc-300 hover:text-white'
                                  }`}
                                >
                                  {/* Left check col */}
                                  <div className="w-4 flex items-center justify-center shrink-0 pt-0.5">
                                    {isSelected ? (
                                      <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                                    ) : (
                                      <div className="w-3.5" />
                                    )}
                                  </div>
                                  {/* Right aligned text block */}
                                  <div className="flex flex-col gap-0.5 text-left min-w-0">
                                    <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                      {m.label}
                                    </span>
                                    <span className="text-[11.5px] text-zinc-400 font-jakarta leading-tight">
                                      {m.desc}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Divider */}
                      <div className="border-t border-[#2d2d30]/60 my-1" />

                      {/* Thinking Level visual item exactly matching screenshot */}
                      <div 
                        onClick={() => {
                          setIsThinkingMenuOpen(!isThinkingMenuOpen);
                          setIsMoreModelsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                          isThinkingMenuOpen ? 'bg-zinc-800/30' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-4 shrink-0" />
                          <div className="flex flex-col gap-0.5 text-left">
                            <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">Thinking level</span>
                            <span className="text-[11.5px] text-zinc-400 font-jakarta leading-tight">{thinkingLevel}</span>
                          </div>
                        </div>
                        <Icon icon="ph:caret-right-bold" className="w-3 h-3 text-zinc-500 mr-1.5 shrink-0" />
                      </div>

                      {/* Nested Flyout Menu */}
                      <AnimatePresence>
                        {isThinkingMenuOpen && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute left-full bottom-0 ml-2 w-[260px] bg-[#1e1e22] rounded-2xl p-1.5 shadow-2xl z-[101] flex flex-col gap-0.5"
                          >
                            {/* Thinking Options List */}
                            {[
                              { id: 'Standard', label: 'Standard', desc: 'Balanced intelligence & speed' },
                              { id: 'Deep', label: 'Deep thinking', desc: 'Extensive reasoning for complex queries' },
                              { id: 'Instant', label: 'Instant', desc: 'Direct responses without deep reasoning' }
                            ].map((opt) => {
                              const isSelected = thinkingLevel === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => {
                                    setThinkingLevel(opt.id as any);
                                    setIsThinkingMenuOpen(false);
                                  }}
                                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                    isSelected ? 'bg-zinc-800/25 text-white' : 'text-zinc-300 hover:text-white'
                                  }`}
                                >
                                  {/* Left Check col */}
                                  <div className="w-4 flex items-center justify-center shrink-0 pt-0.5">
                                    {isSelected ? (
                                      <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                                    ) : (
                                      <div className="w-3.5" />
                                    )}
                                  </div>
                                  {/* Options text block */}
                                  <div className="flex flex-col gap-0.5 text-left min-w-0 font-jakarta">
                                    <span className="text-[13.5px] font-semibold text-zinc-100 leading-tight">
                                      {opt.label}
                                    </span>
                                    <span className="text-[11.5px] text-zinc-400 leading-tight">
                                      {opt.desc}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>

                      {/* Far right send / stop button */}
                      {isAiTyping ? (
                        <button 
                          onClick={handleStopGeneration}
                          className="bg-white text-zinc-950 hover:bg-zinc-200 rounded-full transition-all flex items-center justify-center w-8.5 h-8.5 shrink-0 cursor-pointer shadow-sm"
                          title="Stop generating"
                        >
                          <Icon icon="ph:stop-fill" className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button 
                          onClick={onSend}
                          disabled={!chatInput.trim()}
                          className={`flex items-center justify-center w-8.5 h-8.5 rounded-full transition-all shrink-0 ${
                            chatInput.trim()
                              ? 'bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer shadow-sm' 
                              : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed border border-zinc-800/10'
                          }`}
                          title="Send message"
                        >
                          <Plain2 weight="Linear" size={16} color="currentColor" />
                        </button>
                      )}
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-500 font-normal leading-none font-sans text-center select-none pt-1">
          Cosmi is AI. For guidance,{' '}
          <a 
            href="https://genlang.vercel.app/#blog-post/why-human-authorship-matters" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-zinc-400 hover:text-white transition-colors underline decoration-zinc-750 hover:decoration-zinc-400 underline-offset-2 font-medium"
          >
            learn more
          </a>
          .
        </p>
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
