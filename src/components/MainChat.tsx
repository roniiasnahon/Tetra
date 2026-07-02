import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import TextareaAutosize from "react-textarea-autosize";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Icon } from "./SolarIcon";
import { Tab, ChatMessage, PaperItem } from "../App";
import { TypewriterMarkdown, preprocessLaTeX } from "./TypewriterMarkdown";
import { DynamicShimmer } from "./DynamicShimmer";
import { Plain2, PaperclipRounded2, Like, Dislike, ChatSquareArrow, Copy } from "@solar-icons/react";
import { Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { showToast } from "./Toast";
import { auth } from "../firebase";

interface MainChatProps {
  tab: Tab;
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isAiTyping: boolean;
  handleSendMessage: (
    customText?: string,
    options?: { isHidden?: boolean; fromSidePanel?: boolean },
  ) => Promise<void>;
  handleStopGeneration: () => void;
  researchStatus:
    | "fetching"
    | "downloading"
    | "polishing"
    | "editor_agent"
    | null;
  currentUser: any;
  isOnline?: boolean;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  thinkingLevel: "Standard" | "Deep" | "Instant";
  setThinkingLevel: (val: "Standard" | "Deep" | "Instant") => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (val: boolean) => void;
  attachedFile: {
    fileId: string;
    fileName: string;
    mimetype: string;
    url: string;
  } | null;
  setAttachedFile: (
    val: {
      fileId: string;
      fileName: string;
      mimetype: string;
      url: string;
    } | null,
  ) => void;
  handlePaperclipClick: () => void;
  papers?: PaperItem[];
  handleEditLastPrompt?: (newContent: string) => Promise<void>;
}

export const modelsList = [
  {
    id: "auto",
    label: "Villanelle Post",
    desc: "Lightning-fast, multimodal intelligence",
  },
  {
    id: "hokku-iv",
    label: "Hokku IV",
    desc: "Deep reasoning for complex physics, math, and philosophy",
  },
  {
    id: "mistral-large-latest",
    label: "Sestina",
    desc: "Advanced logic and excellent for language translation",
  },
  {
    id: "codestral-latest",
    label: "Prose Preview",
    desc: "Technical specialist for coding, math, and logic puzzles",
  },
  {
    id: "command-a-plus-05-2026",
    label: "Ericka V",
    desc: "Creative partner for writing, brainstorming, and essay drafts",
  },
  {
    id: "solar-pro2",
    label: "Pantoum",
    desc: "High-performance reasoning and rapid analysis",
  },
  {
    id: "reka-flash",
    label: "Flamenca",
    desc: "Lightning-fast, multimodal intelligence",
  },
  {
    id: "mercury-2",
    label: "Cinquain Lite",
    desc: "Advanced intelligent assistant for complex tasks",
  },
  {
    id: "mimo-v2.5-pro",
    label: "Triolett II",
    desc: "High-performance multimodal processing",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Terzanelle",
    desc: "High-speed conversational assistance",
  },
];

const renderGroundingSources = (groundingMetadata: any) => {
  if (!groundingMetadata) return null;
  const chunks = groundingMetadata.groundingChunks || [];
  if (!chunks || chunks.length === 0) return null;

  // Extract sources safely
  const sources: Array<{ uri: string; title: string }> = [];
  const seenUrls = new Set<string>();

  chunks.forEach((chunk: any) => {
    let uri = "";
    let title = "";

    if (chunk.web) {
      uri = chunk.web.uri || "";
      title = chunk.web.title || "";
    } else {
      uri = chunk.uri || "";
      title = chunk.title || "";
    }

    if (uri && !seenUrls.has(uri)) {
      seenUrls.add(uri);
      sources.push({ uri, title: title || new URL(uri).hostname });
    }
  });

  if (sources.length === 0) return null;

  const queries: string[] = groundingMetadata.webSearchQueries || [];

  return (
    <div className="mt-4 pt-3.5 border-t border-zinc-850/80 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-400 select-none">
        <Icon icon="ph:globe" className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>Sources</span>
        {queries && queries.length > 0 && (
          <span className="text-zinc-500 font-normal truncate max-w-[300px]">
            for "{queries.join(", ")}"
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((src, idx) => {
          let domain = "";
          try {
            domain = new URL(src.uri).hostname.replace("www.", "");
          } catch {
            domain = "web";
          }
          return (
            <a
              key={idx}
              href={src.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#1c1c1f] hover:bg-[#27272a] border border-zinc-800/80 rounded-full text-xs text-zinc-300 hover:text-white transition-all duration-150"
              id={`source-link-${idx}`}
            >
              <img
                src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
                alt=""
                className="w-3.5 h-3.5 rounded-sm object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span className="max-w-[180px] truncate font-medium">{src.title}</span>
              <span className="text-zinc-500 text-[10px] truncate">({domain})</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};

const renderLinkifiedText = (text: string) => {
  if (!text) return "";
  const urlPattern =
    /(\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  const parts = text.split(urlPattern);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      const href = part.toLowerCase().startsWith("www.")
        ? `http://${part}`
        : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline decoration-dashed decoration-skip-ink underline-offset-[3px] hover:text-blue-300 transition-colors"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

interface TruncatedMessageWrapperProps {
  content: string;
  children: React.ReactNode;
  disableTruncation?: boolean;
}

const TruncatedMessageWrapper: React.FC<TruncatedMessageWrapperProps> = ({
  content,
  children,
  disableTruncation = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canTruncate, setCanTruncate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsExpanded(false);
  }, [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disableTruncation) {
      setCanTruncate(false);
      return;
    }

    if (isExpanded) {
      setCanTruncate(true);
      return;
    }

    const timer = setTimeout(() => {
      const hasOverflow = el.scrollHeight > el.clientHeight;
      setCanTruncate(prev => (prev !== hasOverflow ? hasOverflow : prev));
    }, 50);

    return () => clearTimeout(timer);
  }, [content, isExpanded, disableTruncation]);

  const shouldClamp = !isExpanded && !disableTruncation;

  return (
    <div className="flex flex-col w-full relative">
      <div
        ref={containerRef}
        className={`w-full ${shouldClamp ? "line-clamp-4" : ""}`}
        style={
          shouldClamp
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {children}
      </div>
      {!disableTruncation && (canTruncate || isExpanded) && (
        <div className="flex justify-start mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors select-none cursor-pointer border-none shadow-none focus:outline-none"
            title={isExpanded ? "Show less" : "Show more"}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      )}
    </div>
  );
};

const GREETINGS = [
  (name: string) => name ? `${name}, let's go?` : "Let's go?",
  (name: string) => name ? `What's on your mind, ${name}?` : "What's on your mind?",
  (name: string) => name ? `How can I help you today, ${name}?` : "How can I help you today?",
  (name: string) => name ? `What shall we create today, ${name}?` : "What shall we create today?",
  (name: string) => name ? `${name}, what are we working on?` : "What are we working on?",
  (name: string) => name ? `Where should we start, ${name}?` : "Where should we start?",
  (name: string) => name ? `${name}, ready to dive in?` : "Ready to dive in?",
  (name: string) => name ? `What can I draft for you, ${name}?` : "What can I draft for you?",
  (name: string) => name ? `${name}, what's the plan?` : "What's the plan?",
  (name: string) => name ? `Let's make something great, ${name}.` : "Let's make something great.",
  (name: string) => name ? `${name}, how can I support you?` : "How can I support you?",
  (name: string) => name ? `What are we researching today, ${name}?` : "What are we researching today?",
  (name: string) => name ? `Let's build something, ${name}.` : "Let's build something.",
  (name: string) => name ? `${name}, what can I write for you?` : "What can I write for you?",
  (name: string) => name ? `Let's solve some problems, ${name}.` : "Let's solve some problems.",
  (name: string) => name ? `What are we exploring next, ${name}?` : "What are we exploring next?"
];

const getStableGreetingIndex = (tabId: string) => {
  let hash = 0;
  if (!tabId) return 0;
  for (let i = 0; i < tabId.length; i++) {
    hash = tabId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % GREETINGS.length;
};

const getSuggestionsForTab = (tabId: string, papersList?: PaperItem[]) => {
  if (papersList && papersList.length > 0) {
    // We have contents in the library! Make the suggestions related to the library papers.
    const suggestions: string[] = [];
    
    let hash = 0;
    for (let i = 0; i < tabId.length; i++) {
      hash = tabId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const seed = Math.abs(hash);
    
    // Deterministic shuffle of papers based on tabId seed
    const shuffledPapers = [...papersList].sort((a, b) => {
      const aHash = (a.title || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const bHash = (b.title || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return ((aHash + seed) % 5) - ((bHash + seed) % 5);
    });
    
    const paper1 = shuffledPapers[0];
    const paper2 = shuffledPapers[1];
    const paper3 = shuffledPapers[2];
    
    if (paper1) {
      suggestions.push(`Summarize "${paper1.title}"`);
      suggestions.push(`What are the key findings in "${paper1.title}"?`);
    }
    if (paper2) {
      suggestions.push(`Analyze the methodology of "${paper2.title}"`);
      suggestions.push(`What are the limitations of "${paper2.title}"?`);
    } else if (paper1) {
      suggestions.push(`Explain the main concepts in "${paper1.title}" to a beginner`);
    }
    
    if (paper3) {
      suggestions.push(`Provide a critical review of "${paper3.title}"`);
    } else if (paper1 && paper2) {
      suggestions.push(`Compare the approaches of "${paper1.title}" and "${paper2.title}"`);
    } else if (paper1) {
      suggestions.push(`Draft a research proposal extending "${paper1.title}"`);
    }
    
    const backupLibraryPrompts = [
      "Review the latest literature in my library",
      "Suggest a research question based on my documents",
      "Draft a synthesis of the saved papers",
      "Find common themes across my library files",
      "Organize my library into main key categories"
    ];
    
    let padIdx = 0;
    while (suggestions.length < 5 && padIdx < backupLibraryPrompts.length) {
      const p = backupLibraryPrompts[(seed + padIdx) % backupLibraryPrompts.length];
      if (!suggestions.includes(p)) {
        suggestions.push(p);
      }
      padIdx++;
    }
    
    return suggestions.slice(0, 5);
  } else {
    // Default suggestions when library is empty
    const defaultPool = [
      "Draft an abstract for a computer science paper",
      "Explain quantum computing in simple terms",
      "Generate 5 project ideas for machine learning",
      "How do I structure a literature review?",
      "Draft a professional email proposing a collaboration",
      "Explain the difference between SQL and NoSQL",
      "What are some best practices for API design?",
      "Help me brainstorm titles for a tech blog post",
      "Analyze the impact of artificial intelligence on design",
      "Give me tips for writing a persuasive essay",
      "Draft a polite response to a reviewer's comments",
      "Outline a presentation about sustainable energy",
      "Suggest a reading list for deep learning beginners",
      "What is the best way to handle asynchronous code in JS?",
      "Draft a short story about a time traveler",
      "Explain blockchain technology using an analogy",
      "What are the core concepts of clean architecture?",
      "Suggest some ways to improve website performance",
      "Explain the significance of the Turing test",
      "Draft a summary of the latest web development trends"
    ];
    
    let hash = 0;
    for (let i = 0; i < tabId.length; i++) {
      hash = tabId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const seed = Math.abs(hash);
    
    const selected: string[] = [];
    const poolCopy = [...defaultPool];
    
    for (let i = 0; i < 5; i++) {
      const index = (seed + i * 7) % poolCopy.length;
      selected.push(poolCopy[index]);
      poolCopy.splice(index, 1);
    }
    
    return selected;
  }
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
  papers = [],
  handleEditLastPrompt,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  
  const suggestions = useMemo(() => {
    return getSuggestionsForTab(tab.id, papers);
  }, [tab.id, papers]);

  const suggestionsScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const updateScrollIndicators = () => {
    if (suggestionsScrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = suggestionsScrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const el = suggestionsScrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", updateScrollIndicators);
      updateScrollIndicators();
      window.addEventListener("resize", updateScrollIndicators);
      
      const timer = setTimeout(updateScrollIndicators, 150);
      return () => {
        el.removeEventListener("scroll", updateScrollIndicators);
        window.removeEventListener("resize", updateScrollIndicators);
        clearTimeout(timer);
      };
    }
  }, [suggestions]);

  const handleScrollLeft = () => {
    if (suggestionsScrollContainerRef.current) {
      suggestionsScrollContainerRef.current.scrollBy({ left: -220, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (suggestionsScrollContainerRef.current) {
      suggestionsScrollContainerRef.current.scrollBy({ left: 220, behavior: "smooth" });
    }
  };
  const [isThinkingMenuOpen, setIsThinkingMenuOpen] = useState(false);
  const [isMoreModelsOpen, setIsMoreModelsOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollPositionsRef = useRef<Record<string, number>>({});
  const lastTabIdRef = useRef<string | null>(tab.id);
  const previousMessageCountRef = useRef<number>(messages?.length || 0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

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
  };

  const selectPaper = (paper: any) => {
    if (!mentionState.show) return;

    const val = chatInput;
    const beforeMention = val.slice(0, mentionState.startIndex);
    const selectionStart = mainTextareaRef.current
      ? mainTextareaRef.current.selectionStart
      : val.length;
    const afterMention = val.slice(selectionStart);
    const replacement = "";
    const newValue = beforeMention + replacement + afterMention;

    const uid = auth.currentUser?.uid;
    const key = uid ? `onboarding_citation_note_${uid}` : "onboarding_citation_note";
    localStorage.setItem(key, "true");
    setChatInput(newValue);
    setMentionState({
      show: false,
      query: "",
      startIndex: -1,
      selectedIndex: 0,
    });

    if (paper.fileId) {
      setAttachedFile({
        fileId: paper.fileId,
        fileName: paper.title,
        mimetype: paper.mimetype || "application/pdf",
        url: paper.url || "",
      });
    }

    setTimeout(() => {
      if (mainTextareaRef.current) {
        mainTextareaRef.current.focus();
        const cursorPosition = beforeMention.length + replacement.length;
        mainTextareaRef.current.setSelectionRange(
          cursorPosition,
          cursorPosition,
        );
      }
    }, 50);
  };

  const scrollToBottom = React.useCallback((instant = true) => {
    const fn = () => {
      if (chatScrollContainerRef.current) {
        chatScrollContainerRef.current.scrollTop =
          chatScrollContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? "auto" : "smooth",
      });
      setShowScrollBottom(false);
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
      setShowScrollBottom(false);
      if (tab.id && chatScrollPositionsRef.current[tab.id] !== undefined) {
        if (chatScrollContainerRef.current) {
          chatScrollContainerRef.current.scrollTop =
            chatScrollPositionsRef.current[tab.id];
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

  const customFullName = localStorage.getItem(
    `cosmi_settings_full_name_${currentUser?.uid || "guest"}`
  );
  const preferredName =
    customFullName
      ? customFullName.trim().split(" ")[0]
      : currentUser?.displayName
        ? currentUser.displayName.split(" ")[0]
        : "";

  const renderChatInput = () => {
    return (
      <div className="w-full max-w-2xl bg-[#1a1a1a] border border-zinc-800 rounded-[28px] p-2 flex flex-col transition-all relative">
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
                    key={p.fileId ? `${p.fileId}-${idx}` : `${p.title}-${idx}`}
                    onClick={() => selectPaper(p)}
                    onMouseEnter={() =>
                      setMentionState((prev) => ({
                        ...prev,
                        selectedIndex: idx,
                      }))
                    }
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left ${
                      isSelected
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon
                      icon="ph:file-pdf"
                      className="w-4 h-4 text-rose-450 shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium truncate">
                        {p.title}
                      </span>
                      {p.author && (
                        <span className="text-[10px] text-zinc-500 truncate">
                          {p.author}
                        </span>
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
                  className="absolute -top-2 -right-2 bg-zinc-800 border border-zinc-700 text-zinc-350 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md hover:bg-zinc-750 cursor-pointer"
                  title="Remove image"
                >
                  <Icon icon="ph:x" className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="bg-[#1a1a1c] border border-[#2d2d30] rounded-2xl px-3 py-2 flex items-center justify-between gap-3 shadow-sm max-w-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-450 shrink-0 shadow-inner">
                    <Icon icon="ph:file-text" className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 pr-2">
                    <p className="text-[13px] font-semibold text-zinc-200 truncate pr-2">
                      {attachedFile.fileName}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider mt-0.5">
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
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionState((prev) => ({
                    ...prev,
                    selectedIndex:
                      (prev.selectedIndex + 1) % filteredPapers.length,
                  }));
                  return;
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionState((prev) => ({
                    ...prev,
                    selectedIndex:
                      (prev.selectedIndex - 1 + filteredPapers.length) %
                      filteredPapers.length,
                  }));
                  return;
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  selectPaper(filteredPapers[mentionState.selectedIndex]);
                  return;
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionState((prev) => ({ ...prev, show: false }));
                  return;
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            className="w-full bg-transparent text-[14.5px] text-[#e4e4e7] placeholder-[#52525b] resize-none focus:outline-none min-h-[24px] max-h-[300px] leading-relaxed font-sans"
          />
        </div>

        <div className="flex items-center justify-between px-1">
          {/* Left Plus/Upload Icon */}
          <div className="relative shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                isPlusMenuOpen
                  ? "bg-[#222222] text-[#e4e4e7]"
                  : "text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#222222]"
              }`}
              title="Upload or Search Options"
              id="plus-menu-btn-primary"
            >
              <Plus
                className={`w-5 h-5 transition-transform duration-200 ${isPlusMenuOpen ? "rotate-45" : ""}`}
              />
            </button>

            {webSearchEnabled && (
              <button
                type="button"
                onClick={() => setWebSearchEnabled(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252528] hover:bg-[#2a2a2d] transition-colors rounded-full text-[#e4e4e7] cursor-pointer group shrink-0"
              >
                <Icon
                  icon="ph:globe"
                  className="w-[15px] h-[15px] text-[#a1a1aa] group-hover:text-[#e4e4e7] transition-colors"
                />
                <span className="text-[13px] font-normal leading-none font-sans">
                  Search web
                </span>
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
                <div className="absolute bottom-full left-0 mb-2.5 w-[220px] bg-[#1a1a1e] border border-zinc-800 rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5">
                  {/* Upload files */}
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      handlePaperclipClick();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-zinc-350 hover:text-white hover:bg-zinc-800/40 transition-none font-jakarta cursor-pointer"
                  >
                    <PaperclipRounded2
                      weight="Linear"
                      size={18}
                      color="currentColor"
                    />
                    <span className="text-[13px] font-normal text-zinc-300 leading-none">
                      Upload files
                    </span>
                  </button>

                  {/* Web Search Grounding */}
                  <button
                    type="button"
                    onClick={() => {
                      setWebSearchEnabled(!webSearchEnabled);
                      setIsPlusMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left font-sans cursor-pointer transition-none ${
                      webSearchEnabled
                        ? "bg-zinc-800/30 text-zinc-100"
                        : "text-zinc-300 hover:text-white hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        icon="ph:globe"
                        className={`w-[18px] h-[18px] shrink-0 ${webSearchEnabled ? "text-zinc-400" : "text-zinc-500"}`}
                      />
                      <span className="text-[13px] font-normal text-zinc-300 leading-none">
                        Search web
                      </span>
                    </div>
                    {webSearchEnabled && (
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
                    {modelsList.find((m) => m.id === selectedModel)
                      ?.label || "Ode I"}
                  </span>
                  {thinkingLevel !== "Standard" && (
                    <span className="text-zinc-400 opacity-50 font-normal text-[10.5px] ml-1">
                      {thinkingLevel}
                    </span>
                  )}
                </span>
                <Icon icon="ph:caret-down" className="w-3 h-3 text-[#71717a]" />
              </button>

              <AnimatePresence>
                {isModelMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[99] bg-transparent"
                      onClick={() => {
                        setIsModelMenuOpen(false);
                        setIsThinkingMenuOpen(false);
                        setIsMoreModelsOpen(false);
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute bottom-full right-0 mb-2.5 w-[200px] bg-[#1a1a1e] border border-zinc-800/80 rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5"
                    >
                      {modelsList
                        .filter(
                          (m) =>
                            ![
                              "auto",
                              "codestral-latest",
                              "solar-pro2",
                              "reka-flash",
                              "mimo-v2.5-pro",
                            ].includes(m.id),
                        )
                        .map((m) => {
                          const isSelected = m.id === selectedModel;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedModel(m.id);
                                setIsModelMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors font-jakarta cursor-pointer ${
                                isSelected
                                  ? "bg-zinc-800/60 text-white font-medium"
                                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/20"
                              }`}
                            >
                              <span className="text-[12.5px] leading-tight font-medium">
                                {m.label}
                              </span>
                              {isSelected && (
                                <Icon
                                  icon="ph:check"
                                  className="w-3.5 h-3.5 text-zinc-300"
                                />
                              )}
                            </button>
                          );
                        })}

                      <div className="h-[1px] bg-zinc-850/60 my-1 mx-2 shrink-0" />

                      {/* More Models nested menu */}
                      <div className="relative shrink-0">
                        <button
                          onClick={() => {
                            setIsMoreModelsOpen(!isMoreModelsOpen);
                            setIsThinkingMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-jakarta cursor-pointer transition-colors ${
                            isMoreModelsOpen
                              ? "bg-zinc-800/40 text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          <span className="text-[12.5px] font-semibold leading-none">
                            More models
                          </span>
                          <Icon
                            icon="ph:caret-right"
                            className={`w-3 h-3 text-[#71717a] transition-transform ${
                              isMoreModelsOpen ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isMoreModelsOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              transition={{ duration: 0.1 }}
                              className="absolute left-full bottom-0 ml-2.5 w-[180px] bg-[#1a1a1e] border border-zinc-800/80 rounded-xl p-1 shadow-2xl z-[110] flex flex-col gap-0.5"
                            >
                              {modelsList
                                .filter((m) =>
                                  [
                                    "auto",
                                    "codestral-latest",
                                    "solar-pro2",
                                    "reka-flash",
                                    "mimo-v2.5-pro",
                                  ].includes(m.id),
                                )
                                .map((m) => {
                                  const isSelected = m.id === selectedModel;
                                  return (
                                    <button
                                      key={m.id}
                                      onClick={() => {
                                        setSelectedModel(m.id);
                                        setIsMoreModelsOpen(false);
                                        setIsModelMenuOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors font-jakarta cursor-pointer ${
                                        isSelected
                                          ? "bg-zinc-800/60 text-white font-medium"
                                          : "text-zinc-400 hover:text-white hover:bg-zinc-800/20"
                                      }`}
                                    >
                                      <span className="text-[12.5px] leading-tight font-medium">
                                        {m.label}
                                      </span>
                                      {isSelected && (
                                        <Icon
                                          icon="ph:check"
                                          className="w-3.5 h-3.5 text-zinc-300"
                                        />
                                      )}
                                    </button>
                                  );
                                })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="h-[1px] bg-zinc-850/60 my-1 mx-2 shrink-0" />

                      <div className="relative shrink-0">
                        <button
                          onClick={() => {
                            setIsThinkingMenuOpen(!isThinkingMenuOpen);
                            setIsMoreModelsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-jakarta cursor-pointer transition-colors ${
                            isThinkingMenuOpen
                              ? "bg-zinc-800/40 text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          <span className="text-[12.5px] font-semibold leading-none">
                            Thinking level
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10.5px] text-zinc-500 font-normal">
                              {thinkingLevel}
                            </span>
                            <Icon
                              icon="ph:caret-right"
                              className={`w-3 h-3 text-[#71717a] transition-transform ${
                                isThinkingMenuOpen ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </button>

                        <AnimatePresence>
                          {isThinkingMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              transition={{ duration: 0.1 }}
                              className="absolute left-full bottom-0 ml-2.5 w-[180px] bg-[#1a1a1e] border border-zinc-800/80 rounded-xl p-1 shadow-2xl z-[110] flex flex-col gap-0.5"
                            >
                              {[
                                {
                                  id: "Instant",
                                  label: "Standard response",
                                  desc: "Speed first",
                                },
                                {
                                  id: "Standard",
                                  label: "Balanced reasoning",
                                  desc: "Smart defaults",
                                },
                                {
                                  id: "Deep",
                                  label: "Intense evaluation",
                                  desc: "Ultra precision",
                                },
                              ].map((opt) => {
                                const isSelected = opt.id === thinkingLevel;
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => {
                                      setThinkingLevel(
                                        opt.id as
                                          | "Standard"
                                          | "Deep"
                                          | "Instant",
                                      );
                                      setIsThinkingMenuOpen(false);
                                      setIsModelMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors font-jakarta cursor-pointer ${
                                      isSelected
                                        ? "bg-zinc-800/60 text-white font-medium"
                                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/20"
                                    }`}
                                  >
                                    <div className="flex flex-col gap-0.5 text-left min-w-0 font-jakarta">
                                      <span className="text-[12.5px] font-semibold text-zinc-100 leading-tight">
                                        {opt.label}
                                      </span>
                                      <span className="text-[10px] text-zinc-400 leading-tight">
                                        {opt.desc}
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <Icon
                                        icon="ph:check"
                                        className="w-3.5 h-3.5 text-zinc-300"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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
                    ? "bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer shadow-sm"
                    : "bg-zinc-800/40 text-zinc-600 cursor-not-allowed border border-zinc-800/10"
                }`}
                title="Send message"
              >
                <Plain2 weight="Linear" size={16} color="currentColor" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full bg-[#121212] relative">
      <div
        className={`flex-grow flex flex-col h-full overflow-hidden transition-all duration-300 ${!isOnline ? "blur-[6px] select-none pointer-events-none" : ""}`}
      >
        <div
          ref={chatScrollContainerRef}
          onScroll={(e) => {
            if (tab.id) {
              chatScrollPositionsRef.current[tab.id] =
                e.currentTarget.scrollTop;
            }
            const container = e.currentTarget;
            const threshold = 150; // pixels from the bottom
            const isAtBottom =
              container.scrollHeight -
                container.scrollTop -
                container.clientHeight <
              threshold;
            setShowScrollBottom(
              !isAtBottom && container.scrollHeight > container.clientHeight,
            );
          }}
          className="flex-1 flex flex-col items-center pt-[70px] pb-6 px-4 md:px-6 h-full overflow-y-auto custom-scrollbar-h"
        >
          {messages.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center w-full max-w-2xl px-4 py-8 my-auto -translate-y-10">
              {/* Header: Dynamic Random Greeting */}
              <h1 className="text-2xl md:text-3xl text-[#f4f4f5] font-light tracking-tight mb-8 text-center font-jakarta select-none">
                {GREETINGS[getStableGreetingIndex(tab.id)](preferredName)}
              </h1>

              {/* Centered Chat Input Box */}
              {renderChatInput()}

              {/* Pill Short Prompt Suggestions Row */}
              <div className="mt-5 relative w-full max-w-xl select-none flex items-center group px-6">
                {/* Left Fade Overlay */}
                <div 
                  className="absolute left-6 top-0 bottom-0 w-8 bg-gradient-to-r from-[#121212] via-[#121212]/80 to-transparent pointer-events-none z-10 transition-opacity duration-200" 
                  style={{ opacity: showLeftArrow ? 1 : 0 }}
                />

                {/* Left Slide Button */}
                {showLeftArrow && (
                  <button
                    onClick={handleScrollLeft}
                    className="absolute left-0 z-20 text-zinc-400 hover:text-zinc-100 active:scale-90 transition-all duration-150 cursor-pointer flex items-center justify-center w-8 h-8"
                    title="Slide left"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                {/* Scrollable Container */}
                <div
                  ref={suggestionsScrollContainerRef}
                  className="w-full flex flex-row items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1"
                >
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setChatInput("");
                        handleSendMessage(sug);
                      }}
                      className="px-4 py-2 text-sm text-zinc-200 hover:text-white bg-[#161618] border border-zinc-800/80 hover:bg-zinc-800/40 rounded-full transition-colors duration-150 cursor-pointer shrink-0 select-none"
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Right Fade Overlay */}
                <div 
                  className="absolute right-6 top-0 bottom-0 w-8 bg-gradient-to-l from-[#121212] via-[#121212]/80 to-transparent pointer-events-none z-10 transition-opacity duration-200" 
                  style={{ opacity: showRightArrow ? 1 : 0 }}
                />

                {/* Right Slide Button */}
                {showRightArrow && (
                  <button
                    onClick={handleScrollRight}
                    className="absolute right-0 z-20 text-zinc-400 hover:text-zinc-100 active:scale-90 transition-all duration-150 cursor-pointer flex items-center justify-center w-8 h-8"
                    title="Slide right"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl flex flex-col gap-4 pb-8">
              {messages
                .filter((m) => !m.isHidden)
                .reduce((acc: ChatMessage[], m) => {
                  if (!acc.some((x) => x.id === m.id)) {
                    acc.push(m);
                  }
                  return acc;
                }, [])
                .map((m, _, array) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === "user" ? "items-end" : "items-start"
                    } w-full group/message`}
                  >
                    {/* Separate Attachment Bubble */}
                    {m.role === "user" && m.attachment && (
                      <div className="mb-2 w-fit self-end">
                        {m.attachment.mimetype?.startsWith("image/") ? (
                          <img
                            src={m.attachment.url}
                            alt="attachment"
                            className="w-48 h-auto max-h-64 object-cover rounded-xl border border-zinc-800 cursor-zoom-in hover:border-zinc-500 transition-all pointer-events-auto"
                            onClick={() =>
                              window.open(m.attachment!.url, "_blank")
                            }
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="max-w-[85%] bg-[#1a1a1a] rounded-2xl p-2.5 border border-[#27272a] flex items-center gap-3 w-fit">
                            <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0">
                              <Icon icon="ph:file-text" className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-xs font-semibold text-zinc-200 truncate pr-2 max-w-[150px]">
                                {m.attachment.fileName}
                              </p>
                              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide mt-0.5">
                                DOCUMENT FILE
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    {(!m.attachment ||
                      (m.content && m.content.trim().length > 0) ||
                      m.role !== "user") && (
                      <div
                        className={`relative ${
                          m.role === "user"
                            ? editingMsgId === m.id
                              ? "max-w-[100%] md:max-w-[85%] w-full text-white"
                              : "max-w-[85%] bg-[#1a1a1a] text-white rounded-[22px] px-6 py-3.5"
                            : "w-full text-[#d4d4d8] py-2"
                        } text-[16.5px] leading-[1.6]`}
                      >
                        {m.role === "assistant" && m.thought && (
                          <div className="mb-4">
                            <details className="group [&_summary::-webkit-details-marker]:hidden">
                              <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors select-none w-fit">
                                <Icon icon="ph:brain" className="w-4 h-4" />
                                <span>Thought Process</span>
                                <Icon
                                  icon="ph:caret-right"
                                  className="w-3 h-3 group-open:rotate-90 transition-transform"
                                />
                              </summary>
                              <div className="mt-2 pl-3.5 border-l border-zinc-800 text-[13.5px] text-zinc-400 font-sans leading-relaxed markdown-body">
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {preprocessLaTeX(m.thought)}
                                </ReactMarkdown>
                              </div>
                            </details>
                          </div>
                        )}

                        <div
                          className={`select-text break-words ${m.role === "user" && editingMsgId !== m.id ? "whitespace-pre-wrap" : "markdown-body text-[#d4d4d8]"}`}
                        >
                          {editingMsgId === m.id ? (
                            <div className="flex flex-col gap-3 w-full min-w-[250px] md:min-w-[400px]">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full bg-[#1a1a1a] text-white text-[15px] leading-relaxed border border-zinc-700 rounded-[24px] px-5 py-3 focus:outline-none focus:border-zinc-500 resize-y"
                                rows={Math.max(
                                  1,
                                  editingText.split("\n").length,
                                )}
                                autoFocus
                              />
                              <div className="flex justify-end items-center gap-3">
                                <button
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-4 py-2 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[14px] font-medium"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!editingText.trim()) return;
                                    setEditingMsgId(null);
                                    if (handleEditLastPrompt) {
                                      await handleEditLastPrompt(editingText);
                                    }
                                  }}
                                  className="px-5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-full transition-colors font-medium cursor-pointer text-[14px]"
                                >
                                  Update
                                </button>
                              </div>
                            </div>
                          ) : (
                            <TruncatedMessageWrapper
                              content={m.content}
                              disableTruncation={m.role === "assistant"}
                            >
                              {m.role === "user" ? (
                                renderLinkifiedText(m.content)
                              ) : (
                                <>
                                  <TypewriterMarkdown
                                    content={m.content}
                                    timestamp={m.timestamp}
                                    isStreaming={
                                      isAiTyping &&
                                      m.id === messages[messages.length - 1]?.id
                                    }
                                    isBig={true}
                                  />
                                  {m.groundingMetadata && renderGroundingSources(m.groundingMetadata)}
                                </>
                              )}
                            </TruncatedMessageWrapper>
                          )}
                        </div>

                        {m.role === "user" && editingMsgId !== m.id && (
                          <div className="absolute -bottom-9 right-2 flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity z-10 pointer-events-auto">
                            {m.id ===
                              array.filter((x) => x.role === "user").pop()
                                ?.id && (
                              <button
                                onClick={() => {
                                  setEditingMsgId(m.id);
                                  setEditingText(m.content);
                                }}
                                className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                                title="Edit prompt"
                              >
                                <Icon
                                  icon="ph:pencil-simple"
                                  className="w-[18px] h-[18px]"
                                />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(m.content);
                                showToast(
                                  "Prompt copied to clipboard",
                                  "success",
                                  4000,
                                  undefined,
                                  {
                                    label: "New chat",
                                    onClick: () => {
                                      window.dispatchEvent(
                                        new CustomEvent("request-new-chat"),
                                      );
                                    },
                                  },
                                );
                              }}
                              className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                              title="Copy prompt"
                            >
                              <Copy
                                weight="BoldDuotone"
                                size={18}
                                color="currentColor"
                              />
                            </button>
                          </div>
                        )}

                        {m.role === "assistant" && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity z-10 pointer-events-auto mt-2 -ml-1">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(m.content);
                                showToast("Copied to clipboard", "success");
                              }}
                              className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                              title="Copy response"
                            >
                              <Copy weight="BoldDuotone" size={18} color="currentColor" />
                            </button>
                            <button
                              onClick={() => {
                                showToast("Feedback submitted", "success");
                              }}
                              className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                              title="Good response"
                            >
                              <Like weight="BoldDuotone" size={18} color="currentColor" />
                            </button>
                            <button
                              onClick={() => {
                                showToast("Feedback submitted", "success");
                              }}
                              className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                              title="Bad response"
                            >
                              <Dislike weight="BoldDuotone" size={18} color="currentColor" />
                            </button>
                            {m.id === array.filter((x) => x.role === "assistant").pop()?.id && (
                              <button
                                onClick={async () => {
                                  const mIdx = array.findIndex(x => x.id === m.id);
                                  let prevUserMsg = "";
                                  for(let i = mIdx - 1; i >= 0; i--) {
                                    if (array[i].role === "user") {
                                      prevUserMsg = array[i].content;
                                      break;
                                    }
                                  }
                                  if (prevUserMsg && handleEditLastPrompt) {
                                    await handleEditLastPrompt(prevUserMsg);
                                  }
                                }}
                                className="p-1.5 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
                                title="Retry"
                              >
                                <ChatSquareArrow weight="BoldDuotone" size={18} color="currentColor" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              {(isAiTyping || researchStatus) &&
                !(
                  messages[messages.length - 1]?.role === "assistant" &&
                  messages[messages.length - 1]?.content?.trim() &&
                  !researchStatus
                ) && (
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

        {messages.length > 0 && (
          <div className="shrink-0 px-6 pb-1.5 pt-1 flex flex-col items-center gap-2 relative">
            <AnimatePresence>
              {showScrollBottom && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
                  {isAiTyping || researchStatus ? (
                    <motion.button
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      onClick={() => scrollToBottom(false)}
                      className="h-[38px] flex items-center justify-center gap-1.5 px-4 bg-[#1a1a1a]/95 hover:bg-zinc-800 border border-zinc-800 rounded-full shadow-xl transition-all cursor-pointer hover:border-zinc-700"
                      title="Scroll to bottom"
                    >
                      <motion.span
                        animate={{ y: [0, -3.5, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "easeInOut",
                          delay: 0,
                        }}
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                      />
                      <motion.span
                        animate={{ y: [0, -3.5, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "easeInOut",
                          delay: 0.15,
                        }}
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                      />
                      <motion.span
                        animate={{ y: [0, -3.5, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "easeInOut",
                          delay: 0.3,
                        }}
                        className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                      />
                    </motion.button>
                  ) : (
                    <motion.button
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      onClick={() => scrollToBottom(false)}
                      className="flex items-center justify-center bg-[#1a1a1a]/95 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-full w-[38px] h-[38px] shadow-xl transition-all cursor-pointer hover:border-zinc-700"
                      title="Scroll to bottom"
                    >
                      <Icon icon="ph:arrow-down" className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              )}
            </AnimatePresence>

            {renderChatInput()}

            <p className="text-xs text-zinc-500 font-normal leading-none font-sans text-center select-none pt-1">
              Cosmi is AI. For guidance,{" "}
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
        )}

        <div className="hidden">
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
                        key={p.fileId ? `${p.fileId}-${idx}` : `${p.title}-${idx}`}
                        onClick={() => selectPaper(p)}
                        onMouseEnter={() =>
                          setMentionState((prev) => ({
                            ...prev,
                            selectedIndex: idx,
                          }))
                        }
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left ${
                          isSelected
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Icon
                          icon="ph:file-pdf"
                          className="w-4 h-4 text-rose-450 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-medium truncate">
                            {p.title}
                          </span>
                          {p.author && (
                            <span className="text-[10px] text-zinc-500 truncate">
                              {p.author}
                            </span>
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
                        <p className="text-[13px] font-semibold text-zinc-200 truncate pr-2">
                          {attachedFile.fileName}
                        </p>
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
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionState((prev) => ({
                        ...prev,
                        selectedIndex:
                          (prev.selectedIndex + 1) % filteredPapers.length,
                      }));
                      return;
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionState((prev) => ({
                        ...prev,
                        selectedIndex:
                          (prev.selectedIndex - 1 + filteredPapers.length) %
                          filteredPapers.length,
                      }));
                      return;
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      selectPaper(filteredPapers[mentionState.selectedIndex]);
                      return;
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setMentionState((prev) => ({ ...prev, show: false }));
                      return;
                    }
                  }

                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                className="w-full bg-transparent text-[14.5px] text-[#e4e4e7] placeholder-[#52525b] resize-none focus:outline-none min-h-[24px] max-h-[300px] leading-relaxed font-sans"
              />
            </div>

            <div className="flex items-center justify-between px-1">
              {/* Left Plus/Upload Icon */}
              <div className="relative shrink-0 flex items-center gap-1.5">
                <button
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                    isPlusMenuOpen
                      ? "bg-[#222222] text-[#e4e4e7]"
                      : "text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#222222]"
                  }`}
                  title="Upload or Search Options"
                  id="plus-menu-btn-secondary"
                >
                  <Plus
                    className={`w-5 h-5 transition-transform duration-200 ${isPlusMenuOpen ? "rotate-45" : ""}`}
                  />
                </button>

                {webSearchEnabled && (
                  <button
                    type="button"
                    onClick={() => setWebSearchEnabled(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252528] hover:bg-[#2a2a2d] transition-colors rounded-full text-[#e4e4e7] cursor-pointer group shrink-0"
                  >
                    <Icon
                      icon="ph:globe"
                      className="w-[15px] h-[15px] text-[#a1a1aa] group-hover:text-[#e4e4e7] transition-colors"
                    />
                    <span className="text-[13px] font-normal leading-none font-sans">
                      Search web
                    </span>
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
                    <div className="absolute bottom-full left-0 mb-2.5 w-[220px] bg-[#1a1a1e] border border-zinc-800 rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5">
                      {/* Upload files */}
                      <button
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          handlePaperclipClick();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-zinc-350 hover:text-white hover:bg-zinc-800/40 transition-none font-jakarta cursor-pointer"
                      >
                        <PaperclipRounded2
                          weight="Linear"
                          size={18}
                          color="currentColor"
                        />
                        <span className="text-[13px] font-normal text-zinc-300 leading-none">
                          Upload files
                        </span>
                      </button>

                      {/* Web Search Grounding */}
                      <button
                        type="button"
                        onClick={() => {
                          setWebSearchEnabled(!webSearchEnabled);
                          setIsPlusMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left font-sans cursor-pointer transition-none ${
                          webSearchEnabled
                            ? "bg-zinc-800/30 text-zinc-100"
                            : "text-zinc-300 hover:text-white hover:bg-zinc-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            icon="ph:globe"
                            className={`w-[18px] h-[18px] shrink-0 ${webSearchEnabled ? "text-zinc-400" : "text-zinc-500"}`}
                          />
                          <span className="text-[13px] font-normal text-zinc-300 leading-none">
                            Search web
                          </span>
                        </div>
                        {webSearchEnabled && (
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
                        {modelsList.find((m) => m.id === selectedModel)
                          ?.label || "Ode I"}
                      </span>
                      {thinkingLevel !== "Standard" && (
                        <span className="text-zinc-400 opacity-50 font-normal text-[10.5px] ml-1">
                          {thinkingLevel}
                        </span>
                      )}
                    </span>
                    <Icon
                      icon="ph:caret-down-bold"
                      className="w-3 h-3 text-zinc-500"
                    />
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
                      <div className="absolute bottom-full right-0 mb-2 w-[180px] bg-[#1e1e22] rounded-xl p-0.5 shadow-2xl z-[100] flex flex-col gap-0">
                        {modelsList
                          .filter(
                            (m) =>
                              ![
                                "auto",
                                "reka-flash",
                                "solar-pro2",
                                "codestral-latest",
                                "mimo-v2.5-pro",
                              ].includes(m.id),
                          )
                          .map((m) => {
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
                                className={`relative group w-full flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                  isSelected
                                    ? "bg-zinc-800/25 text-white"
                                    : "text-zinc-300 hover:text-white"
                                }`}
                              >
                                {/* Left check col */}
                                <div className="w-4 flex items-center justify-center shrink-0">
                                  {isSelected ? (
                                    <Icon
                                      icon="ph:check"
                                      className="w-3 h-3 text-zinc-100 font-bold"
                                    />
                                  ) : (
                                    <div className="w-3" />
                                  )}
                                </div>
                                {/* Right aligned text block */}
                                <div className="text-left min-w-0">
                                  <span className="text-[12px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                    {m.label}
                                  </span>
                                </div>
                                {/* Tooltip */}
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2.5 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible bg-[#1a1a1e] border border-zinc-800/80 text-zinc-300 text-[11px] rounded-lg p-2 shadow-xl pointer-events-none z-[110] leading-normal font-normal transition-all duration-150">
                                  {m.desc}
                                  {/* Sharp Arrow Pointer */}
                                  <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%-4px)] w-2 h-2 rotate-45 bg-[#1a1a1e] border-r border-t border-zinc-800/80 pointer-events-none" />
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
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                            isMoreModelsOpen ? "bg-zinc-800/30" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 shrink-0 flex items-center justify-center">
                              {[
                                "auto",
                                "reka-flash",
                                "solar-pro2",
                                "codestral-latest",
                                "mimo-v2.5-pro",
                              ].includes(selectedModel) ? (
                                <Icon
                                  icon="ph:check"
                                  className="w-3 h-3 text-zinc-100 font-bold"
                                />
                              ) : (
                                <div className="w-3" />
                              )}
                            </div>
                            <span className="text-[12px] font-semibold text-zinc-100 font-jakarta leading-tight">
                              More models
                            </span>
                          </div>
                          <Icon
                            icon="ph:caret-right-bold"
                            className="w-3 h-3 text-zinc-500 mr-1 shrink-0"
                          />
                        </div>

                        {/* Nested Flyout Menu for More Models */}
                        <AnimatePresence>
                          {isMoreModelsOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: -10, scale: 0.95 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -10, scale: 0.95 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                              className="absolute left-full bottom-8 ml-2 w-[180px] bg-[#1e1e22] rounded-xl p-0.5 shadow-2xl z-[101] flex flex-col gap-0"
                            >
                              {modelsList
                                .filter((m) =>
                                  [
                                    "auto",
                                    "reka-flash",
                                    "solar-pro2",
                                    "codestral-latest",
                                    "mimo-v2.5-pro",
                                  ].includes(m.id),
                                )
                                .map((m) => {
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
                                      className={`relative group w-full flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                        isSelected
                                          ? "bg-zinc-800/25 text-white"
                                          : "text-zinc-300 hover:text-white"
                                      }`}
                                    >
                                      {/* Left check col */}
                                      <div className="w-4 flex items-center justify-center shrink-0">
                                        {isSelected ? (
                                          <Icon
                                            icon="ph:check"
                                            className="w-3 h-3 text-zinc-100 font-bold"
                                          />
                                        ) : (
                                          <div className="w-3" />
                                        )}
                                      </div>
                                      {/* Right aligned text block */}
                                      <div className="text-left min-w-0">
                                        <span className="text-[12px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                          {m.label}
                                        </span>
                                      </div>
                                      {/* Tooltip */}
                                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2.5 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible bg-[#1a1a1e] border border-zinc-800/80 text-zinc-300 text-[11px] rounded-lg p-2 shadow-xl pointer-events-none z-[110] leading-normal font-normal transition-all duration-150">
                                        {m.desc}
                                        {/* Sharp Arrow Pointer */}
                                        <div className="absolute top-1/2 -translate-y-1/2 left-[calc(100%-4px)] w-2 h-2 rotate-45 bg-[#1a1a1e] border-r border-t border-zinc-800/80 pointer-events-none" />
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
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                            isThinkingMenuOpen ? "bg-zinc-800/30" : ""
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <div className="w-4 shrink-0" />
                            <div className="flex flex-col gap-0 text-left">
                              <span className="text-[12px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                Thinking level
                              </span>
                              <span className="text-[10px] text-zinc-400 font-jakarta leading-tight">
                                {thinkingLevel}
                              </span>
                            </div>
                          </div>
                          <Icon
                            icon="ph:caret-right-bold"
                            className="w-3 h-3 text-zinc-500 mr-1 shrink-0"
                          />
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
                                {
                                  id: "Standard",
                                  label: "Standard",
                                  desc: "Balanced intelligence & speed",
                                },
                                {
                                  id: "Deep",
                                  label: "Deep thinking",
                                  desc: "Extensive reasoning for complex queries",
                                },
                                {
                                  id: "Instant",
                                  label: "Instant",
                                  desc: "Direct responses without deep reasoning",
                                },
                              ].map((opt) => {
                                const isSelected = thinkingLevel === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => {
                                      setThinkingLevel(opt.id as any);
                                      setIsThinkingMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                      isSelected
                                        ? "bg-zinc-800/25 text-white"
                                        : "text-zinc-300 hover:text-white"
                                    }`}
                                  >
                                    {/* Options text block */}
                                    <div className="flex flex-col gap-0.5 text-left min-w-0 font-jakarta">
                                      <span className="text-[13.5px] font-semibold text-zinc-100 leading-tight">
                                        {opt.label}
                                      </span>
                                      <span className="text-[11.5px] text-zinc-400 leading-tight">
                                        {opt.desc}
                                      </span>
                                    </div>
                                    {/* Right Check col */}
                                    <div className="w-5 flex items-center justify-center shrink-0">
                                      {isSelected ? (
                                        <Icon
                                          icon="ph:check"
                                          className="w-3.5 h-3.5 text-zinc-100 font-bold"
                                        />
                                      ) : null}
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
                        ? "bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer shadow-sm"
                        : "bg-zinc-800/40 text-zinc-600 cursor-not-allowed border border-zinc-800/10"
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
            Cosmi is AI. For guidance,{" "}
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
                Connect your account to the network to chat with the AI research
                assistant. Local notebook features, document drafting, and data
                analyses remain fully available.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
