import React, { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ScanLine, 
  X, 
  SendHorizontal, 
  Paperclip, 
  PanelRightClose, 
  PanelRightOpen,
  Sparkles,
  Plus,
  Trash2,
  FileText,
  Check,
  AlertCircle,
  HelpCircle,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Minus,
  Eraser,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Subscript,
  Superscript,
  Highlighter,
  Palette,
  PanelLeft,
  Home,
  FileSignature,
  ChevronDown,
  Folder
} from 'lucide-react';

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

const TypewriterMarkdown = ({ content, timestamp }: { content: string, timestamp: number }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const shouldAnimate = useRef(Date.now() - timestamp < 2000);

  useEffect(() => {
    if (!shouldAnimate.current) {
      setDisplayedContent(content);
      return;
    }

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex += 5; // characters per tick
      if (currentIndex >= content.length) {
        clearInterval(interval);
        setDisplayedContent(content);
      } else {
        setDisplayedContent(content.substring(0, currentIndex));
      }
    }, 15);

    return () => clearInterval(interval);
  }, [content]);

  return <ReactMarkdown>{displayedContent}</ReactMarkdown>;
};

export default function App() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
    }
  };
  
  // Document Metadata State
  const [documentTitle, setDocumentTitle] = useState('');
  const [folderName, setFolderName] = useState('');
  const [savedNoteName, setSavedNoteName] = useState('');
  
  // Research Papers Data
  const [papers, setPapers] = useState<PaperItem[]>([]);

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
    try {
      // Use marked to parse, but clean it up to avoid top-level double paragraphs etc if needed
      return marked.parse(markdown, { gfm: true, breaks: true }) as string;
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

      const data = await response.json();
      
      // Append answer
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: data.content || "I have analyzed your workspace papers and summarized the response.",
          thought: data.thought,
          timestamp: Date.now()
        }
      ]);

      // If Gemini/Mistral returned structured citations or outline drafts, we can handle them!
      if (data.suggestion) {
        // Automatically switch to document view if AI is editing/suggesting content
        const docTab = tabs.find(t => t.type === 'document');
        if (docTab) {
          setActiveTabId(docTab.id);
        }

        // Robust check: even if type isn't 'edit_document', if we have content blocks, we should process them
        const isEditAction = data.suggestion.type === 'edit_document' || 
                           data.suggestion.replaceContent || 
                           data.suggestion.appendContent || 
                           data.suggestion.title;

        if (data.suggestion.type === 'citations' && data.suggestion.citations) {
          const newPapers: PaperItem[] = data.suggestion.citations.map((c: any) => ({
            author: `${c.authors} (${c.year})`,
            title: c.title,
            description: c.quoteSnippet || `${c.authors} review on ${c.source}`
          }));
          setPapers(prev => [...prev, ...newPapers]);
        } else if (isEditAction) {
          if (data.suggestion.title) setDocumentTitle(data.suggestion.title);
          if (data.suggestion.appendContent) {
            const htmlContent = markdownToHtml(data.suggestion.appendContent);
            setDocumentContent(prev => prev + htmlContent);
          }
          if (data.suggestion.replaceContent) {
            const htmlContent = markdownToHtml(data.suggestion.replaceContent);
            setDocumentContent(htmlContent);
          }
        }
      }

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
            <div className="p-3 mb-1">
              <button className="w-full flex items-center gap-2.5 text-[#f4f4f5] text-[12px] hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-colors group">
                <div className="w-6 h-6 rounded-full bg-[#27272a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3f3f46]">
                   <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ron" alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <span className="truncate font-medium flex-1 text-left">Asnahon, Ron Niño Miguel L....</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] shrink-0" />
              </button>
            </div>
            
            {/* Primary Navigation Grid */}
            <nav className="px-3 grid grid-cols-4 gap-2 mb-6">
              {[
                { icon: FileSignature, label: 'Create' },
                { icon: Home, label: 'Home', active: true },
                { icon: List, label: 'Library' },
                { icon: Search, label: 'Search' }
              ].map((item) => (
                <button 
                  key={item.label} 
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg transition-colors ${
                    item.active 
                      ? 'bg-[#1a1a1a] text-[#f4f4f5]' 
                      : 'text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Files/Chats Toggle Tabs */}
            <div className="mx-3 mb-4 p-1 bg-[#111111] rounded-lg flex items-center gap-1">
              <button className="flex-1 py-1 text-[#f4f4f5] text-[11px] font-medium bg-[#27272a] rounded-[6px] shadow-sm transition-all">
                Files
              </button>
              <button className="flex-1 py-1 text-[#71717a] text-[11px] font-medium hover:text-[#a1a1aa] transition-colors">
                Chats
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-3">
              {/* Folder List */}
              <div className="space-y-0.5">
                 <button className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#1a1a1a] transition-all group">
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                       <Folder className="w-4 h-4 text-[#71717a] group-hover:text-[#f4f4f5]" />
                    </div>
                    <span className="text-[#a1a1aa] text-[12.5px] font-medium truncate group-hover:text-[#f4f4f5]">My Research</span>
                 </button>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="mt-auto p-3">
              <button className="w-full flex items-center gap-2 px-2 py-2 text-[#71717a] hover:text-[#a1a1aa] text-[12px] font-medium transition-colors">
                <HelpCircle className="w-3.5 h-3.5" />
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
              <PanelLeft className="w-[18px] h-[18px]" />
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
          <Home className="w-3.5 h-3.5" />
        ) : (
          <FileSignature className="w-3.5 h-3.5" />
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
            <X className="w-3 h-3" />
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
      <Plus className="w-4 h-4" />
    </div>
  </div>

          <div className="flex-1" />

          {/* Right Header Navigation & Panel Controls */}
          <div className="flex items-center gap-3 h-full pb-1.5 pt-1.5">
            {!isAssistantOpen && (
              <button 
                onClick={() => setIsAssistantOpen(true)}
                className="text-[#52525b] hover:text-[#e4e4e7] relative transition-colors cursor-pointer rounded-md"
                title="Open Assistant Sidebar"
              >
                <PanelRightOpen className="w-[18px] h-[18px]" />
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
                      }
                    }}
                    className="flex items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-colors rounded-xl text-left cursor-pointer group"
                  >
                    <div className="w-10 h-10 bg-[#27272a] rounded-lg flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                      <FileSignature className="w-5 h-5 text-[#f4f4f5]" />
                    </div>
                    <div>
                      <h3 className="text-[#e4e4e7] font-medium text-sm">Resume Document</h3>
                      <p className="text-[#a1a1aa] text-xs mt-0.5 truncate max-w-[200px]">{documentTitle || 'Untitled Document'}</p>
                    </div>
                  </button>
                  
                  <button className="flex items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-colors rounded-xl text-left cursor-pointer group">
                    <div className="w-10 h-10 bg-[#27272a] rounded-lg flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                      <Plus className="w-5 h-5 text-[#e4e4e7]" />
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
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#161616]/95 backdrop-blur-md border border-[#2d2d30] rounded-full px-4 h-[44px] flex items-center gap-3 shadow-2xl text-[12px] text-[#a1a1aa] whitespace-nowrap select-none max-w-[calc(100%-2rem)] overflow-x-auto no-scrollbar">
                
                {/* Font Selector */}
                <div className="flex items-center relative gap-1">
                  <select 
                    value={editorFont}
                    onChange={(e) => setEditorFont(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 outline-none text-[#e4e4e7] pr-4 cursor-pointer font-medium text-[11px] appearance-none"
                  >
                    <option value="font-jakarta" className="bg-[#121212] text-white">Plus Jakarta</option>
                    <option value="font-serif" className="bg-[#121212] text-white">Lora (Serif)</option>
                    <option value="font-sans" className="bg-[#121212] text-white">Inter (Sans)</option>
                    <option value="font-mono" className="bg-[#121212] text-white">JetBrains Mono</option>
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-0 pointer-events-none text-[#52525b]" />
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                {/* Font Size Adjusters */}
                <div className="flex items-center gap-1.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => changeSelectedFontSize(false)}
                    className="hover:bg-[#2c2c2e] hover:text-white rounded-full transition-colors text-[11px] font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
                    title="Decrease Selection Font Size"
                  >
                    -
                  </button>
                  <span className="text-[11.5px] font-mono w-6 text-center text-[#e4e4e7]">{currentSelectionSize}px</span>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => changeSelectedFontSize(true)}
                    className="hover:bg-[#2c2c2e] hover:text-white rounded-full transition-colors text-[11px] font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
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
                    <Undo className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('redo')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Redo"
                  >
                    <Redo className="w-3.5 h-3.5" />
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
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('italic')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Italic Selection"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('underline')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Underline Selection"
                  >
                    <UnderlineIcon className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('strikethrough')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Strikethrough Selection"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('subscript')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Subscript"
                  >
                    <Subscript className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('superscript')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Superscript"
                  >
                    <Superscript className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('hiliteColor')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Highlight Selection"
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('foreColor')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Change Text Color"
                  >
                    <Palette className="w-3.5 h-3.5" />
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
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('insertOrderedList')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Numbered List"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('insertHorizontalRule')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Horizontal Rule"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFormat('removeFormat')}
                    className="p-1 rounded-md transition-colors cursor-pointer hover:text-white hover:bg-[#202022]"
                    title="Clear Formatting"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2d2d30]" />

                {/* Text Alignment Picker */}
                <div className="flex items-center gap-0.5">
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setEditorAlign('left')}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'left' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Left"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setEditorAlign('center')}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'center' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Center"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setEditorAlign('right')}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'right' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Right"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setEditorAlign('justify')}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'justify' ? 'text-[#f4f4f5] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                    title="Align Justify"
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
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
                <PanelRightClose className="w-4 h-4" />
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
                      <TypewriterMarkdown content={m.content} timestamp={m.timestamp} />
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
                    <X className="w-3.5 h-3.5" />
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
                    <Paperclip className="w-[18px] h-[18px]" />
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
                    <SendHorizontal className="w-[18px] h-[18px] -rotate-45 -mt-0.5 ml-0.5" />
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
