import React, { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from '@iconify/react';

interface PaperItem {
  author: string;
  title: string;
  description: string;
}

interface Tab {
  id: string;
  type: 'home' | 'document';
  title: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: number;
}

const TypewriterMarkdown = ({ content, timestamp, isStreaming }: { content: string, timestamp: number, isStreaming?: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const contentRef = useRef(content);
  const shouldAnimate = useRef(Date.now() - timestamp < 2000);

  useEffect(() => {
    contentRef.current = content;
    if (!shouldAnimate.current) {
       setDisplayedContent(content);
    }
  }, [content]);

  useEffect(() => {
    if (!shouldAnimate.current) {
      setDisplayedContent(contentRef.current);
      return;
    }

    const interval = setInterval(() => {
      setDisplayedContent(prev => {
        const target = contentRef.current;
        if (prev.length < target.length) {
          return target.substring(0, prev.length + 5);
        }
        
        // If we caught up, and no longer streaming overall, we can stop the interval
        if (prev.length >= target.length && !isStreaming) {
          clearInterval(interval);
          return target;
        }

        return prev;
      });
    }, 15);

    return () => clearInterval(interval);
  }, [timestamp, isStreaming]);

  return <ReactMarkdown>{displayedContent}</ReactMarkdown>;
};

const parseAssistantResponse = (text: string) => {
  let thought = "";
  let chat = "";
  let title = "";
  let replaceContent = "";

  const lowerText = text.toLowerCase();

  const thoughtStartTagIdx = lowerText.indexOf("<thought>");
  let thoughtStartIdx = thoughtStartTagIdx !== -1 ? thoughtStartTagIdx + 9 : -1;
  if (thoughtStartIdx === -1 && lowerText.trim().length > 0) {
    const firstTagIdx = Math.min(
      lowerText.indexOf("<chat>") !== -1 ? lowerText.indexOf("<chat>") : Infinity,
      lowerText.indexOf("<title>") !== -1 ? lowerText.indexOf("<title>") : Infinity,
      lowerText.indexOf("<replacecontent>") !== -1 ? lowerText.indexOf("<replacecontent>") : Infinity
    );
    if (firstTagIdx > 0 && firstTagIdx !== Infinity) {
      thoughtStartIdx = 0;
    } else if (firstTagIdx === Infinity) {
      thoughtStartIdx = 0;
    }
  }

  let thoughtEndIdx = -1;
  let chatStartSearchIdx = 0;

  if (thoughtStartIdx !== -1) {
    const thoughtEndTagIdx = lowerText.indexOf("</thought>", thoughtStartIdx);
    if (thoughtEndTagIdx !== -1) {
      thoughtEndIdx = thoughtEndTagIdx;
      chatStartSearchIdx = thoughtEndTagIdx + 10;
    } else {
      const chatTagIdx = lowerText.indexOf("<chat>", thoughtStartIdx);
      if (chatTagIdx !== -1) {
        thoughtEndIdx = chatTagIdx;
        chatStartSearchIdx = chatTagIdx;
      }
    }

    if (thoughtEndIdx !== -1) {
      thought = text.substring(thoughtStartIdx, thoughtEndIdx).trim();
    } else {
      thought = text.substring(thoughtStartIdx).trim();
    }
  }

  const chatStartTagIdx = lowerText.indexOf("<chat>", chatStartSearchIdx);
  let chatStartIdx = chatStartTagIdx !== -1 ? chatStartTagIdx + 6 : -1;

  if (chatStartIdx === -1 && chatStartSearchIdx > 0) {
    const nextTagIdx = Math.min(
      lowerText.indexOf("<title>", chatStartSearchIdx) !== -1 ? lowerText.indexOf("<title>", chatStartSearchIdx) : Infinity,
      lowerText.indexOf("<replacecontent>", chatStartSearchIdx) !== -1 ? lowerText.indexOf("<replacecontent>", chatStartSearchIdx) : Infinity
    );
    if (nextTagIdx !== Infinity && nextTagIdx > chatStartSearchIdx) {
      chatStartIdx = chatStartSearchIdx;
    } else if (nextTagIdx === Infinity) {
      chatStartIdx = chatStartSearchIdx;
    }
  }

  let chatEndIdx = -1;
  let titleStartSearchIdx = chatStartSearchIdx;

  if (chatStartIdx !== -1) {
    const chatEndTagIdx = lowerText.indexOf("</chat>", chatStartIdx);
    if (chatEndTagIdx !== -1) {
      chatEndIdx = chatEndTagIdx;
      titleStartSearchIdx = chatEndTagIdx + 7;
    } else {
      const nextStructuralTagIdx = Math.min(
        lowerText.indexOf("<title>", chatStartIdx) !== -1 ? lowerText.indexOf("<title>", chatStartIdx) : Infinity,
        lowerText.indexOf("<replacecontent>", chatStartIdx) !== -1 ? lowerText.indexOf("<replacecontent>", chatStartIdx) : Infinity
      );
      if (nextStructuralTagIdx !== Infinity) {
        chatEndIdx = nextStructuralTagIdx;
        titleStartSearchIdx = nextStructuralTagIdx;
      }
    }

    if (chatEndIdx !== -1) {
      chat = text.substring(chatStartIdx, chatEndIdx).trim();
    } else {
      chat = text.substring(chatStartIdx).trim();
    }
  }

  const titleStartTagIdx = lowerText.indexOf("<title>", titleStartSearchIdx);
  const titleStartIdx = titleStartTagIdx !== -1 ? titleStartTagIdx + 7 : -1;
  
  let titleEndIdx = -1;
  let contentStartSearchIdx = titleStartSearchIdx;

  if (titleStartIdx !== -1) {
    const titleEndTagIdx = lowerText.indexOf("</title>", titleStartIdx);
    if (titleEndTagIdx !== -1) {
      titleEndIdx = titleEndTagIdx;
      contentStartSearchIdx = titleEndTagIdx + 8;
    } else {
      const contentTagIdx = lowerText.indexOf("<replacecontent>", titleStartIdx);
      if (contentTagIdx !== -1) {
        titleEndIdx = contentTagIdx;
        contentStartSearchIdx = contentTagIdx;
      }
    }

    if (titleEndIdx !== -1) {
      title = text.substring(titleStartIdx, titleEndIdx).trim();
    } else {
      title = text.substring(titleStartIdx).trim();
    }
  }

  const contentStartTagIdx = lowerText.indexOf("<replacecontent>", contentStartSearchIdx);
  const contentStartIdx = contentStartTagIdx !== -1 ? contentStartTagIdx + 16 : -1;
  if (contentStartIdx !== -1) {
    const contentEndTagIdx = lowerText.indexOf("</replacecontent>", contentStartIdx);
    if (contentEndTagIdx !== -1) {
      replaceContent = text.substring(contentStartIdx, contentEndTagIdx).trim();
    } else {
      replaceContent = text.substring(contentStartIdx).trim();
    }
  }

  return { thought, chat, title, replaceContent };
};

export default function App() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<'files' | 'chats' | 'search' | 'library'>('files');
  
  // Tab Management
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'initial-home', type: 'home', title: 'Home' },
    { id: 'initial-doc', type: 'document', title: 'Untitled' }
  ]);
  const [activeTabId, setActiveTabId] = useState('initial-doc');

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  
  // Editor Styles and Customizations
  const [editorFont, setEditorFont] = useState('font-jakarta');
  const [editorFontSize, setEditorFontSize] = useState(18);
  const [currentSelectionSize, setCurrentSelectionSize] = useState(18);
  const [editorAlign, setEditorAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef('');

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const parentNode = range.commonAncestorContainer.parentElement;
        
        if (parentNode) {
          const parentStyle = window.getComputedStyle(parentNode);
          const sizeStr = parentStyle.fontSize;
          if (sizeStr) {
            const parsed = parseInt(sizeStr);
            if (!isNaN(parsed)) {
              setCurrentSelectionSize(parsed);
              return;
            }
          }
        }
      }
      setCurrentSelectionSize(editorFontSize);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [editorFontSize]);

  const changeSelectedFontSize = (increase: boolean) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    if (selection.isCollapsed) {
      setEditorFontSize(prev => {
        const next = increase ? prev + 1 : prev - 1;
        const clamped = Math.min(72, Math.max(12, next));
        setCurrentSelectionSize(clamped);
        return clamped;
      });
      return;
    }

    const currentSize = currentSelectionSize;
    const nextSize = increase ? currentSize + 1 : currentSize - 1;
    const clampedSize = Math.max(12, Math.min(72, nextSize));

    try {
      document.execCommand('styleWithCSS', false, 'true');
      const tempFontName = `___fs_${Date.now()}___`;
      document.execCommand('fontName', false, tempFontName);

      const editor = editorRef.current;
      if (editor) {
        const selector = `font[face="${tempFontName}"], span[style*="font-family: ${tempFontName}"], span[style*='font-family: "${tempFontName}"']`;
        const targets = editor.querySelectorAll(selector);
        
        targets.forEach(el => {
          const element = el as HTMLElement;
          element.style.fontFamily = "";
          element.removeAttribute("face");
          element.style.fontSize = `${clampedSize}px`;
          // ensure normal line height to prevent shifts
          element.style.lineHeight = "normal";
        });
      }
      
      setCurrentSelectionSize(clampedSize);
    } catch (e) {
      console.error("Font resize failed:", e);
      setEditorFontSize(prev => increase ? prev + 1 : prev - 1);
    }

    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
    }
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.textAlign = editorAlign;
    }
  }, [editorAlign]);
  
  // Document Metadata State
  const [documentTitle, setDocumentTitle] = useState('');
  const [folderName, setFolderName] = useState('');
  const [savedNoteName, setSavedNoteName] = useState('');
  
  // Research Papers Data
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleSearchPapers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSynthesis(null);
    try {
      const resp = await fetch(`/api/research/papers?q=${encodeURIComponent(searchQuery)}`);
      const data = await resp.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSynthesize = async () => {
    if (searchResults.length === 0) return;
    setIsSynthesizing(true);
    try {
      const resp = await fetch('/api/research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: searchResults, userQuery: searchQuery })
      });
      const data = await resp.json();
      setSynthesis(data.synthesis);
    } catch (err) {
      console.error("Synthesis failed:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const addPaperToLibrary = (paper: any) => {
    const authors = paper.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author';
    const newPaper: PaperItem = {
      author: `${authors} (${paper.year || 'N/A'})`,
      title: paper.title,
      description: paper.abstract || `Paper from ${paper.venue || 'Academic Repository'}`
    };
    setPapers(prev => [...prev, newPaper]);
  };

  // AI Assistant Chat Messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: "Hello! I am your AI Student Success Mentor. I'm here to help you research, draft, and polish your academic work. You can upload PDFs as sources, ask me to summarize complex topics, or help you structure your next big essay. What are we working on today?",
      timestamp: Date.now() - 60000
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto Scroll Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // Word count helper
  const wordCount = (() => {
    const rawText = `${documentTitle} ${folderName} ${savedNoteName} ` + 
      papers.map(p => `${p.author} ${p.title} ${p.description}`).join(' ');
    const cleaned = rawText.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    return cleaned.split(/\s+/).filter(Boolean).length;
  })();

  const [documentContent, setDocumentContent] = useState(() => {
    return "";
  });

  useEffect(() => {
    // If activeTab is document, make sure initial content is populated
    if (activeTab.type === 'document' && editorRef.current) {
      if (editorRef.current.innerHTML !== documentContent) {
        editorRef.current.innerHTML = documentContent;
        lastContentRef.current = documentContent;
      }
    }
  }, [activeTab]);

  useEffect(() => {
    // Keep editor sync if external changes occur (like AI editing)
    if (editorRef.current && documentContent !== lastContentRef.current) {
      editorRef.current.innerHTML = documentContent;
      lastContentRef.current = documentContent;
    }
  }, [documentContent]);

  // Helper to convert Markdown to HTML for the editor
  const markdownToHtml = (markdown: string) => {
    if (!markdown) return "";
    try {
      // Trim outer whitespace so that heading tags (like ## Introduction) 
      // placed at the start/ends are parsed as actual headings, not inline text.
      const trimmedMarkdown = markdown.trim();
      return marked.parse(trimmedMarkdown, { gfm: true, breaks: true }) as string;
    } catch (e) {
      console.error("Markdown conversion failed", e);
      return markdown;
    }
  };

  // Intel fallback response generator for offline or key-missing states
  const getFallbackResponse = (query: string): { text: string; suggestion?: any } => {
    const lowercase = query.toLowerCase();
    
    // Check for inline edits from the user
    if (lowercase.includes('rename') || lowercase.includes('change title')) {
      const newTitleMatch = query.match(/(?:rename|change title|title to) ["']?(.+?)["']?$/i);
      const title = newTitleMatch ? newTitleMatch[1] : `Updated Title - ${new Date().toLocaleTimeString()}`;
      return {
        text: `I have updated the document title to "${title}" as you requested.`,
        suggestion: { type: 'edit_document', title: title }
      };
    }

    if (lowercase.includes('remove') || lowercase.includes('delete') || lowercase.includes('clear')) {
      return {
        text: `I've cleared out the requested section as directed.`,
        suggestion: { type: 'edit_document', replaceContent: "Cleared workspace..." }
      };
    }

    if (lowercase.includes('add') || lowercase.includes('draft') || lowercase.includes('write')) {
       return {
        text: `I have drafted and inserted a new academic synthesis section directly into your document.`,
        suggestion: {
          type: 'edit_document',
          appendContent: "\n\nScholarly consensus indicates that cognitive consolidation is a highly physical, lifestyle-dependent adaptation. It requires both cortical neurodevelopmental responsiveness and striatal automation pathways, which are actively catalyzed by aerobic and cognitive stressors."
        }
      };
    }

    if (lowercase.includes('hi') || lowercase.includes('hello') || lowercase.includes('hey') || lowercase.includes('help') || lowercase.includes('greet')) {
      return {
        text: `I'm ready to help you crush your research! If you have any source material (like PDFs or notes), click the paperclip icon inside the chat box or use the "Plus" button in the Workspace sidebar to add them. 

I can help you:
1. **Analyze Sources**: Pull out key arguments and data points from your papers.
2. **Draft Content**: Write high-quality, long-form academic text.
3. **Structure Outlines**: Organize your thoughts into a logical flow.

What's on your mind?`
      };
    }

    return { text: `I'm all set to help you with your project!

You haven't added any sources to this workspace yet. Feel free to upload your research papers or drop some notes in the "Notes" section. 

Once you have content, I can help you draft sections, summarize findings, or format your bibliography in APA, MLA, or Chicago style.`};
  };

  // Sending chat messages
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customText) {
      setChatInput('');
    }
    
    setIsAiTyping(true);

    try {
      // Try hitting our real server-side Gemini research chat endpoint!
      const response = await fetch('/api/research/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          context: {
            notes: [`Document Title: ${documentTitle}`, `Saved under folder: ${folderName}`, `Note context: ${savedNoteName}`],
            citations: papers.map(p => ({
              title: p.title,
              authors: p.author,
              source: "Academic Import Database",
              year: p.author.match(/\d{4}/)?.[0] || '2023',
              format: 'APA'
            })),
            outline: [{
              id: "sec-main",
              level: 1,
              title: documentTitle,
              points: [folderName, savedNoteName],
              draftContent: documentContent,
              linkedCitations: []
            }]
          }
        })
      });

      if (!response.ok) {
        throw new Error('API server returned status ' + response.status);
      }

      const assistantMessageId = String(Date.now() + 1);
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          thought: '',
          timestamp: Date.now()
        }
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let hasSwitchedToDoc = false;
      let streamBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          // Keep the last incomplete line in the buffer
          streamBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (trimmedLine.startsWith('data: ')) {
               const data = trimmedLine.slice(6).trim();
               if (data === '[DONE]') break;
               try {
                 const parsed = JSON.parse(data);
                 if (parsed.text) {
                   accumulatedText += parsed.text;

                   // Extract <chat>
                   const { thought, chat, title: parsedTitle, replaceContent: parsedContent } = parseAssistantResponse(accumulatedText);

                   if (chat !== undefined) {
                     setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: chat } : m));
                   }

                   if (thought !== undefined) {
                     setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, thought: thought } : m));
                   }

                   if (parsedTitle) {
                     setDocumentTitle(parsedTitle);
                   }

                   if (parsedContent) {
                      if (!hasSwitchedToDoc) {
                        hasSwitchedToDoc = true;
                        setTabs(prev => {
                          const docTab = prev.find(t => t.type === 'document');
                          if (docTab) setActiveTabId(docTab.id);
                          return prev;
                        });
                      }
                      let rawContent = parsedContent;

                      // Strip conversational prologue before the first markdown header
                      const headingIndex = rawContent.indexOf('## ');
                      const h1Index = rawContent.indexOf('# ');
                      let firstValidIndex = -1;
                      if (headingIndex !== -1 && h1Index !== -1) firstValidIndex = Math.min(headingIndex, h1Index);
                      else firstValidIndex = Math.max(headingIndex, h1Index);
                      
                      if (firstValidIndex > 0) {
                        const introPart = rawContent.substring(0, firstValidIndex);
                        if (/((?:Awesome)|(?:Sure)|(?:I've)|(?:I’ve)|(?:I’ll)|(?:I'll)|(?:Here)|(?:Got it)|(?:chat message))/i.test(introPart)) {
                          rawContent = rawContent.substring(firstValidIndex);
                        }
                      }

                      rawContent = rawContent.trim();
                      const htmlContent = markdownToHtml(rawContent);
                      setDocumentContent(htmlContent);
                   }
                 }
               } catch (e) {
                 // ignore partial JSON parse errors just in case
               }
            }
          }
        }
      }

      setIsAiTyping(false);

    } catch (e) {
      console.warn("Express server Gemini API failed, using deep local simulation rules:", e);
      // Fallback safely to our local academic intelligence
      const fallbackPayload = getFallbackResponse(textToSend);
      const simulatedAnswer = fallbackPayload.text;
      
      if (fallbackPayload.suggestion) {
        if (fallbackPayload.suggestion.type === 'edit_document') {
          if (fallbackPayload.suggestion.title) setDocumentTitle(fallbackPayload.suggestion.title);
          if (fallbackPayload.suggestion.appendContent) {
            const htmlContent = markdownToHtml(fallbackPayload.suggestion.appendContent);
            setDocumentContent(prev => prev + htmlContent);
          }
          if (fallbackPayload.suggestion.replaceContent) {
            const htmlContent = markdownToHtml(fallbackPayload.suggestion.replaceContent);
            setDocumentContent(htmlContent);
          }
        }
      }

      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: simulatedAnswer,
            timestamp: Date.now()
          }
        ]);
        setIsAiTyping(false);
      }, 1000);
      return;
    } finally {
      setIsAiTyping(false);
    }
  };

  // Paperclip mock file trigger
  const handlePaperclipClick = () => {
    const fileLabel = prompt("Enter the name of a research PDF or text file to upload as a source (e.g. 'Sapolsky et al. (2018).pdf'):");
    if (fileLabel && fileLabel.trim()) {
      setSelectedFileLabel(fileLabel.trim());
      // Prompt user option
      const importOption = confirm(`Would you like to import '${fileLabel}' into your sources database automatically?`);
      if (importOption) {
        const titlePlaceholder = fileLabel.replace(/\.[^/.]+$/, "");
        setPapers(prev => [
          ...prev,
          {
            author: fileLabel.includes("(") ? fileLabel.substring(0, fileLabel.indexOf(")") + 1) : "Unknown Author (2025)",
            title: titlePlaceholder,
            description: `Imported research document. Click 'Edit Mode' to supplement detailed finding summaries.`
          }
        ]);
        
        // Let AI acknowledge
        setIsAiTyping(true);
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              id: String(Date.now()),
              role: 'assistant',
              content: `Successfully uploaded and ingested scientific reference: **${fileLabel}**. I have appended it directly to your sources workspace. Feel free to ask me questions specifically about its claims!`,
              timestamp: Date.now()
            }
          ]);
          setIsAiTyping(false);
          setSelectedFileLabel(null);
        }, 1100);
      }
    }
  };

  return (
    <div className="h-screen bg-[#070707] text-[#e4e4e7] font-sans flex selection:bg-[#262626] overflow-hidden">
      
      {/* Left Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex flex-col h-full shrink-0 overflow-hidden bg-[#070707] font-jakarta"
          >
            {/* User Profile Header */}
            <div className="p-3 mb-1 relative">
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-full flex items-center gap-2.5 text-[#f4f4f5] text-[12px] hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-colors group cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#27272a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3f3f46]">
                   <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ron" alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <span className="truncate font-medium flex-1 text-left">Asnahon, Ron Niño Miguel L....</span>
                <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] shrink-0 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsProfileDropdownOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-3 right-3 top-full mt-1 z-40 bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 shadow-2xl overflow-hidden"
                    >
                      <div className="px-3 py-2 border-bottom border-[#2d2d30] mb-1">
                        <p className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider">Account</p>
                        <p className="text-[12px] text-[#e4e4e7] truncate">asnahonron@gmail.com</p>
                      </div>
                      <button className="w-full text-left px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#e4e4e7] transition-colors flex items-center gap-2">
                        <Icon icon="ph:user" className="w-3.5 h-3.5" />
                        Settings
                      </button>
                      <button className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-950/20 transition-colors flex items-center gap-2">
                        <Icon icon="ph:sign-out" className="w-3.5 h-3.5" />
                        Log out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {/* Primary Navigation Grid */}
            <nav className="px-3 grid grid-cols-4 gap-2 mb-6">
              {[
                { icon: 'ph:pencil-line', label: 'Create', onClick: () => {
                  const newId = `doc-${Date.now()}`;
                  setTabs([...tabs, { id: newId, type: 'document', title: 'Untitled' }]);
                  setActiveTabId(newId);
                  setSidebarView('files');
                }},
                { icon: 'ph:house', label: 'Home', onClick: () => {
                  const homeTab = tabs.find(t => t.type === 'home');
                  if (homeTab) setActiveTabId(homeTab.id);
                  setSidebarView('files');
                }, active: activeTab.type === 'home' && sidebarView === 'files' },
                { icon: 'ph:books', label: 'Library', onClick: () => setSidebarView('library'), active: sidebarView === 'library' },
                { icon: 'ph:magnifying-glass', label: 'Search', onClick: () => setSidebarView('search'), active: sidebarView === 'search' }
              ].map((item) => (
                <button 
                  key={item.label} 
                  onClick={item.onClick}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all duration-300 cursor-pointer ${
                    item.active 
                      ? 'text-[#f4f4f5] scale-105' 
                      : 'text-[#3f3f46] hover:text-[#a1a1aa]'
                  }`}
                >
                  <Icon icon={item.icon} className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Files/Chats Toggle Tabs (Only shown when in files/chats mode) */}
            {(sidebarView === 'files' || sidebarView === 'chats') && (
              <div className="mx-3 mb-4 p-1 bg-[#111111] rounded-lg flex items-center gap-1">
                <button 
                  onClick={() => setSidebarView('files')}
                  className={`flex-1 py-1 text-[11px] font-medium rounded-[6px] transition-all ${sidebarView === 'files' ? 'text-[#f4f4f5] bg-[#27272a] shadow-sm' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
                >
                  Files
                </button>
                <button 
                  onClick={() => setSidebarView('chats')}
                  className={`flex-1 py-1 text-[11px] font-medium rounded-[6px] transition-all ${sidebarView === 'chats' ? 'text-[#f4f4f5] bg-[#27272a] shadow-sm' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
                >
                  Chats
                </button>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto px-3">
              {sidebarView === 'files' && (
                <div className="space-y-0.5">
                   <button className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#1a1a1a] transition-all group">
                      <div className="w-4 h-4 flex items-center justify-center shrink-0">
                         <Icon icon="ph:folder" className="w-4 h-4 text-[#71717a] group-hover:text-[#f4f4f5]" />
                      </div>
                      <span className="text-[#a1a1aa] text-[12.5px] font-medium truncate group-hover:text-[#f4f4f5]">My Research</span>
                   </button>
                </div>
              )}

              {sidebarView === 'chats' && (
                <div className="text-center py-10">
                  <Icon icon="ph:chat-circle-dots" className="w-8 h-8 text-[#27272a] mx-auto mb-2" />
                  <p className="text-[11px] text-[#52525b]">No recent chats</p>
                </div>
              )}

              {sidebarView === 'library' && (
                <div className="space-y-3">
                  <h3 className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider px-2">Citations ({papers.length})</h3>
                  {papers.length === 0 ? (
                    <div className="px-2 py-4 border border-dashed border-[#27272a] rounded-xl text-center">
                      <p className="text-[11px] text-[#52525b]">Library is empty</p>
                    </div>
                  ) : (
                    papers.map((paper, idx) => (
                      <div key={idx} className="p-2.5 bg-[#161616] border border-[#27272a] rounded-xl hover:border-[#3f3f46] transition-colors group">
                        <p className="text-[11.5px] text-[#f4f4f5] font-medium leading-tight mb-1">{paper.title}</p>
                        <p className="text-[10px] text-[#71717a] truncate mb-1.5">{paper.author}</p>
                        <button 
                          onClick={() => {
                            const citation = `\n\n> *Citation: ${paper.title} - ${paper.author}*`;
                            setDocumentContent(prev => prev + citation);
                          }}
                          className="text-[9px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                        >
                          Cite this paper
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {sidebarView === 'search' && (
                <div className="space-y-4">
                  <form onSubmit={handleSearchPapers} className="relative">
                    <input 
                      autoFocus
                      placeholder="Search Semantic Scholar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#161616] border border-[#27272a] focus:border-blue-500 rounded-xl px-9 py-2 text-[12px] text-[#f4f4f5] placeholder-[#52525b] outline-none transition-all"
                    />
                    <Icon icon="ph:magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525b]" />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Icon icon="svg-spinners:ring-resize" className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                  </form>

                  {searchResults.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider">Results</h3>
                        <button 
                          onClick={handleSynthesize}
                          disabled={isSynthesizing}
                          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                        >
                          {isSynthesizing ? (
                             <Icon icon="svg-spinners:ring-resize" className="w-3 h-3" />
                          ) : (
                             <Icon icon="ph:sparkle" className="w-3 h-3" />
                          )}
                          Synthesize
                        </button>
                      </div>

                      {synthesis && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl mb-4"
                        >
                          <p className="text-[10px] text-blue-400 font-bold mb-1.5 uppercase flex items-center gap-1">
                            <Icon icon="ph:brain" className="w-3 h-3" />
                            LLM Synthesis
                          </p>
                          <div className="text-[11px] text-[#e4e4e7] leading-relaxed italic prose prose-invert">
                            <ReactMarkdown>{synthesis}</ReactMarkdown>
                          </div>
                        </motion.div>
                      )}
                      
                      <div className="space-y-2">
                        {searchResults.map((paper, idx) => (
                          <div key={idx} className="p-2.5 bg-[#161616] border border-[#27272a] rounded-xl group hover:border-[#3f3f46] transition-all">
                            <p className="text-[11px] text-[#f4f4f5] font-medium leading-tight mb-1">{paper.title}</p>
                            <p className="text-[9.5px] text-[#71717a] mb-2">
                              {paper.authors?.slice(0, 2).map((a: any) => a.name).join(', ')}
                              {paper.authors?.length > 2 ? ' et al.' : ''} 
                              {paper.year ? ` • ${paper.year}` : ''}
                            </p>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => addPaperToLibrary(paper)}
                                className="px-2 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-[9.5px] font-medium text-[#e4e4e7] rounded-md transition-colors"
                              >
                                Save to Library
                              </button>
                              {paper.url && (
                                <a 
                                  href={paper.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-[9.5px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                                >
                                  View Source
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Section */}
            <div className="mt-auto p-3">
              <button className="w-full flex items-center gap-2 px-2 py-2 text-[#71717a] hover:text-[#a1a1aa] text-[12px] font-medium transition-colors">
                <Icon icon="ph:question" className="w-3.5 h-3.5" />
                <span>Support</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content (Editor Column) */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Bar */}
        <header className="h-[38px] flex items-end shrink-0 bg-[#070707] px-2">
          
          <div className="flex items-center gap-3 h-full pb-1.5 pt-1.5 group">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`transition-all duration-300 cursor-pointer p-1 rounded-md ${isSidebarOpen ? 'opacity-0 group-hover:opacity-100 bg-[#1a1a1a] text-[#f4f4f5]' : 'text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#1a1a1a]'}`}
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <Icon icon="ph:sidebar-simple" className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Tabs Container */}
          <div className="flex items-end h-full ml-3 gap-[2px] overflow-x-auto no-scrollbar min-w-0">
    {tabs.map((tab) => (
      <div 
        key={tab.id}
        onClick={() => setActiveTabId(tab.id)}
        className={`flex items-center gap-2 px-4 h-[32px] rounded-t-[10px] transition-colors cursor-pointer text-[13px] ${
          activeTabId === tab.id 
            ? 'bg-[#121212] text-[#e4e4e7]' 
            : 'bg-[#1a1a1a]/40 hover:bg-[#1a1a1a]/80 text-[#a1a1aa]'
        }`}
      >
        {tab.type === 'home' ? (
          <Icon icon="ph:house" className="w-3.5 h-3.5" />
        ) : (
          <Icon icon="ph:pencil-line" className="w-3.5 h-3.5" />
        )}
        <span className="truncate max-w-[130px]">
          {tab.type === 'home' ? 'Home' : (documentTitle || 'Untitled')}
        </span>
        {tabs.length > 1 && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const newTabs = tabs.filter(t => t.id !== tab.id);
              setTabs(newTabs);
              if (activeTabId === tab.id) {
                setActiveTabId(newTabs[0].id);
              }
            }}
            className="ml-2 hover:text-white p-0.5 rounded-sm hover:bg-white/10"
          >
            <Icon icon="ph:x" className="w-3 h-3" />
          </button>
        )}
      </div>
    ))}

    {/* Add Tab Button */}
    <div 
      onClick={() => {
        const newId = `home-${Date.now()}`;
        setTabs([...tabs, { id: newId, type: 'home', title: 'Home' }]);
        setActiveTabId(newId);
      }}
      className="flex items-center justify-center p-2 mb-0.5 ml-1 rounded-md hover:bg-[#1a1a1a] text-[#86868b] hover:text-[#e4e4e7] transition-colors cursor-pointer"
    >
      <Icon icon="ph:plus-circle" className="w-4 h-4" />
    </div>
  </div>

          <div className="flex-1" />

          {/* Right Header Navigation & Panel Controls */}
          <div className="flex items-center gap-3 h-full pb-1.5 pt-1.5">
            {!isAssistantOpen && (
              <button 
                onClick={() => setIsAssistantOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#222222] hover:border-[#3f3f46] transition-all cursor-pointer text-[12px] font-medium font-jakarta active:scale-[0.98]"
                title="Open Assistant Sidebar"
              >
                <Icon icon="ph:sparkle" className="w-3.5 h-3.5" />
                <span>Agent</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Editor Component Container */}
        <div className="relative flex-1 bg-[#121212] rounded-2xl flex flex-col overflow-hidden min-w-0">
          
          {activeTab.type === 'home' ? (
            <div className="flex-1 overflow-y-auto focus:outline-none scroll-smooth">
              <div className="max-w-[800px] mx-auto w-full p-8 md:p-14 lg:p-20 flex flex-col justify-center min-h-full">
                <h1 className="text-3xl md:text-4xl text-[#f4f4f5] font-medium tracking-tight mb-8">Good afternoon.</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  <button 
                    onClick={() => {
                      const docTab = tabs.find(t => t.type === 'document');
                      if (docTab) {
                        setActiveTabId(docTab.id);
                      } else {
                        const newId = `doc-${Date.now()}`;
                        setTabs([...tabs, { id: newId, type: 'document', title: 'Untitled' }]);
                        setActiveTabId(newId);
                      }
                    }}
                    className="flex items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-colors rounded-3xl text-left cursor-pointer group"
                  >
                    <div className="mr-5 group-hover:scale-110 transition-transform duration-300">
                      <Icon icon="ph:pencil-line" className="w-7 h-7 text-[#f4f4f5]" />
                    </div>
                    <div>
                      <h3 className="text-[#e4e4e7] font-medium text-sm">Resume Document</h3>
                      <p className="text-[#a1a1aa] text-xs mt-0.5 truncate max-w-[200px]">{documentTitle || 'Untitled Document'}</p>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => {
                      const newId = `doc-${Date.now()}`;
                      setTabs([...tabs, { id: newId, type: 'document', title: 'Untitled' }]);
                      setActiveTabId(newId);
                    }}
                    className="flex items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-colors rounded-3xl text-left cursor-pointer group"
                  >
                    <div className="mr-5 group-hover:scale-110 transition-transform duration-300">
                      <Icon icon="ph:plus-circle" className="w-7 h-7 text-[#e4e4e7]" />
                    </div>
                    <div>
                      <h3 className="text-[#e4e4e7] font-medium text-sm">Create New</h3>
                      <p className="text-[#a1a1aa] text-xs mt-0.5">Start a blank hypothesis</p>
                    </div>
                  </button>
                </div>

                <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wider mb-4">Recent Folders</h2>
                <div className="space-y-2">
                  {[folderName || 'My Research', 'Semester Projects', 'Workshops', 'Archived Drafts'].map((folder, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 px-4 rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-pointer border border-transparent hover:border-[#27272a]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#18181b] flex items-center justify-center">
                          <span className="text-[#52525b] text-[10px] font-mono select-none">DIR</span>
                        </div>
                        <span className="text-[#e4e4e7] text-sm">{folder}</span>
                      </div>
                      <span className="text-[#52525b] text-xs font-mono">{idx === 0 ? 'Active' : 'Last week'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Floating Pill Formatting Bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#161616]/95 backdrop-blur-md border border-[#2d2d30] rounded-full px-4 h-[44px] flex items-center gap-3 shadow-2xl text-[12px] text-[#a1a1aa] whitespace-nowrap select-none">
                
                {/* Font Selector */}
                <div className="flex items-center relative h-full">
                  <button 
                    onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                    className="flex items-center gap-1.5 px-2.5 h-8 hover:bg-[#2c2c2e] transition-colors rounded-lg text-[#e4e4e7] cursor-pointer"
                  >
                    <span className="font-medium text-[11px] min-w-[70px] text-left">
                      {editorFont === 'font-jakarta' ? 'Plus Jakarta' : 
                       editorFont === 'font-serif' ? 'Lora (Serif)' :
                       editorFont === 'font-sans' ? 'Inter (Sans)' : 'JetBrains Mono'}
                    </span>
                    <Icon icon="ph:caret-down" className={`w-3 h-3 text-[#71717a] transition-transform duration-200 ${isFontDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isFontDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: -8, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute left-0 bottom-full mb-2 z-50 bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 shadow-2xl min-w-[140px] overflow-hidden"
                      >
                        {[
                          { value: 'font-jakarta', label: 'Plus Jakarta' },
                          { value: 'font-serif', label: 'Lora (Serif)' },
                          { value: 'font-sans', label: 'Inter (Sans)' },
                          { value: 'font-mono', label: 'JetBrains Mono' }
                        ].map((font) => (
                          <button
                            key={font.value}
                            onClick={() => {
                              setEditorFont(font.value);
                              setIsFontDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center justify-between group cursor-pointer ${
                              editorFont === font.value 
                                ? 'bg-[#2c2c2e] text-[#f4f4f5]' 
                                : 'text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#e4e4e7]'
                            }`}
                          >
                            <span className={font.value}>{font.label}</span>
                            {editorFont === font.value && (
                              <Icon icon="ph:check" className="w-3 h-3 text-blue-400" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                {/* Font Size Adjusters */}
                <div className="flex items-center gap-1.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => changeSelectedFontSize(false)}
                    className="hover:bg-[#2c2c2e] hover:text-white rounded-lg transition-colors text-[13px] font-medium w-7 h-7 flex items-center justify-center cursor-pointer"
                    title="Decrease Selection Font Size"
                  >
                    -
                  </button>
                  <span className="text-[11.5px] font-mono w-8 text-center text-[#e4e4e7]">{currentSelectionSize}px</span>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => changeSelectedFontSize(true)}
                    className="hover:bg-[#2c2c2e] hover:text-white rounded-lg transition-colors text-[13px] font-medium w-7 h-7 flex items-center justify-center cursor-pointer"
                    title="Increase Selection Font Size"
                  >
                    +
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                {/* Formatting controls */}
                <div className="flex items-center gap-0.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('undo')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Undo"
                  >
                    <Icon icon="ph:arrow-u-up-left" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('redo')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Redo"
                  >
                    <Icon icon="ph:arrow-u-up-right" className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                <div className="flex items-center gap-0.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('bold')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Bold Selection"
                  >
                    <Icon icon="ph:text-b" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('italic')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Italic Selection"
                  >
                    <Icon icon="ph:text-italic" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('underline')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Underline Selection"
                  >
                    <Icon icon="ph:text-underline" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('strikethrough')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Strikethrough Selection"
                  >
                    <Icon icon="ph:text-strikethrough" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('subscript')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Subscript"
                  >
                    <Icon icon="ph:text-subscript" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('superscript')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Superscript"
                  >
                    <Icon icon="ph:text-superscript" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const color = prompt('Enter color (e.g. yellow, #ff0000):', 'yellow');
                      if (color) handleFormat('hiliteColor', color);
                    }}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Highlight Selection"
                  >
                    <Icon icon="ph:highlighter" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const color = prompt('Enter text color (e.g. blue, red):', '#ffffff');
                      if (color) handleFormat('foreColor', color);
                    }}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Change Text Color"
                  >
                    <Icon icon="ph:palette" className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                {/* Lists */}
                <div className="flex items-center gap-0.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('insertUnorderedList')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Bullet List"
                  >
                    <Icon icon="ph:list-bullets" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('insertOrderedList')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Numbered List"
                  >
                    <Icon icon="ph:list-numbers" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('insertHorizontalRule')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Horizontal Rule"
                  >
                    <Icon icon="ph:minus" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('removeFormat')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Clear Formatting"
                  >
                    <Icon icon="ph:eraser" className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                {/* Text Alignment Picker */}
                <div className="flex items-center gap-0.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEditorAlign('left');
                      handleFormat('justifyLeft');
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'left' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Left"
                  >
                    <Icon icon="ph:text-align-left" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEditorAlign('center');
                      handleFormat('justifyCenter');
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'center' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Center"
                  >
                    <Icon icon="ph:text-align-center" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEditorAlign('right');
                      handleFormat('justifyRight');
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'right' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Right"
                  >
                    <Icon icon="ph:text-align-right" className="w-4 h-4" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEditorAlign('justify');
                      handleFormat('justifyFull');
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'justify' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Justify"
                  >
                    <Icon icon="ph:text-align-justify" className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

              </div>

              {/* Independent Scrollable Document Surface */}
              <div className="flex-1 overflow-y-auto p-8 pb-24 md:p-14 md:pb-28 lg:p-20 lg:pb-32 focus:outline-none scroll-smooth">
                <div className={`max-w-[720px] mx-auto space-y-[1.5rem] ${editorFont} text-[#d4d4d8]`} style={{ fontSize: `${editorFontSize}px`, textAlign: editorAlign }}>
                  
                  {/* Main Document Title */}
                  <TextareaAutosize 
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="Untitled"
                    className="w-full bg-transparent text-[#f4f4f5] tracking-tight font-normal pb-2 resize-none outline-none leading-[1.25] text-[2.2rem] md:text-[2.6rem] placeholder:text-[#3f3f46] font-jakarta"
                  />
                  
                  {/* Main Document Content Area */}
                  <div className="min-h-[400px]">
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Start writing..."
                      onInput={(e) => {
                        const html = e.currentTarget.innerHTML;
                        lastContentRef.current = html;
                        setDocumentContent(html);
                      }}
                      onBlur={() => {
                        if (editorRef.current) {
                          const html = editorRef.current.innerHTML;
                          lastContentRef.current = html;
                          setDocumentContent(html);
                        }
                      }}
                      className="w-full bg-transparent text-inherit outline-none min-h-[400px] leading-relaxed focus:outline-none markdown-body"
                    />
                  </div>



                </div>
              </div>
            </>
          )}
          
        </div>
      </div>

      {/* Right Section - AI Assistant Window Panel */}
      {isAssistantOpen && (
        <div className="p-[4px] flex h-full"> 
          <div className="w-[360px] md:w-[420px] bg-[#121212] rounded-2xl flex flex-col h-full shrink-0 overflow-hidden shadow-2xl animate-slide-in">
            
            {/* Assistant Header */}
            <div className="h-[52px] flex items-center justify-between px-5 shrink-0 bg-[#121212]">
              <div className="flex items-center gap-2">
                <h2 className="text-[#e4e4e7] font-medium text-[13.5px]">AI Research Assistant</h2>
              </div>
              <button 
                onClick={() => setIsAssistantOpen(false)}
                className="text-[#52525b] hover:text-[#e4e4e7] transition-colors p-[4px] rounded-md hover:bg-[#1c1c1e] cursor-pointer" 
                aria-label="Close Assistant"
                title="Collapse Panel"
              >
                <Icon icon="ph:caret-double-right" className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Conversation Stream Pane (Scrollable completely independently from Left Editor view) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121212] flex flex-col min-h-0">
              
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${
                    m.role === 'user' 
                      ? 'self-end max-w-[88%] bg-[#262626] text-white rounded-xl rounded-br-none p-3.5' 
                      : 'self-start max-w-full bg-transparent text-[#d4d4d8] py-2'
                  } text-[13px] leading-relaxed transition-all`}
                >
                  {/* Reasoning Process */}
                  {m.role === 'assistant' && m.thought && (
                    <details className="mb-2 group">
                      <summary className="text-[11px] font-medium text-[#71717a] hover:text-[#a1a1aa] cursor-pointer transition-colors list-none outline-none inline-flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-[#71717a] group-hover:bg-[#a1a1aa] transition-colors" />
                        Thought
                      </summary>
                      <div className="mt-1.5 text-[12px] text-[#71717a] pb-2 leading-relaxed max-w-[95%]">
                        {m.thought}
                      </div>
                    </details>
                  )}

                  {/* Text message */}
                  <div className={`select-text break-words ${m.role === 'user' ? 'whitespace-pre-wrap' : 'markdown-body text-[#d4d4d8]'}`}>
                    {m.role === 'user' ? (
                      m.content
                    ) : (
                      <TypewriterMarkdown 
                        content={m.content} 
                        timestamp={m.timestamp} 
                        isStreaming={isAiTyping && m.id === messages[messages.length - 1]?.id} 
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming loading animation state */}
              {isAiTyping && (
                <div className="self-start bg-transparent py-2 max-w-full text-[13px] leading-relaxed select-none">
                  <span className="shimmer-text font-jakarta font-medium">Thinking...</span>
                </div>
              )}

              {/* Dummy Anchor for list focus */}
              <div ref={messagesEndRef} />
            </div>

            {/* Workspace Assistant Prompt Input Bar (Fixed at layout bottom) */}
            <div className="p-3.5 shrink-0 bg-[#121212]">
              {selectedFileLabel && (
                <div className="bg-[#18181b] border border-[#27272a] rounded px-2.5 py-1.5 text-xs text-[#a1a1aa] mb-2 flex items-center justify-between animate-fade-in">
                  <span className="truncate">Attaching: {selectedFileLabel}</span>
                  <button onClick={() => setSelectedFileLabel(null)} className="text-red-400 hover:text-red-300">
                    <Icon icon="ph:x" className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="bg-[#222222] rounded-[10px] flex flex-col border border-transparent transition-colors">
                <textarea 
                  placeholder="Ask about your research, sources, or draft content..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full bg-transparent text-[13.5px] text-[#e4e4e7] placeholder-[#71717a] py-3 px-3.5 resize-none focus:outline-none min-h-[70px] leading-relaxed"
                />
                
                {/* Actions and Paper attachment triggers inside input frame */}
                <div className="flex justify-between items-center px-2 pb-2">
                  <button 
                    onClick={handlePaperclipClick}
                    className="text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#2d2d30] transition-colors p-[6px] rounded-md cursor-pointer"
                    title="Upload Academic Reference PDF / Text Note"
                  >
                    <Icon icon="ph:paperclip" className="w-[18px] h-[18px]" />
                  </button>

                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={!chatInput.trim()}
                    className={`transition-colors p-[6px] rounded-md cursor-pointer ${
                      chatInput.trim() 
                        ? 'text-[#f4f4f5] hover:bg-[#2d2d30]' 
                        : 'text-[#52525b] cursor-not-allowed'
                    }`}
                  >
                    <Icon icon="ph:paper-plane-right" className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
