import React, { useState, useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react';

interface PaperItem {
  author: string;
  title: string;
  description: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function App() {
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  
  // Editor Styles and Customizations
  const [editorFont, setEditorFont] = useState('font-serif');
  const [editorFontSize, setEditorFontSize] = useState(18);
  const [editorAlign, setEditorAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  
  // Document Metadata State
  const [documentTitle, setDocumentTitle] = useState('Done and done. Here is a summary of what was set up.');
  const [folderName, setFolderName] = useState('Neuroplasticity');
  const [savedNoteName, setSavedNoteName] = useState('Neuroplasticity in Adult Learning');
  
  // Research Papers Data
  const [papers, setPapers] = useState<PaperItem[]>([
    {
      author: "Marzola et al. (2023)",
      title: "Exploring the Role of Neuroplasticity in Development, Aging, and Neurodegeneration",
      description: "Broad review of neuroplasticity mechanisms (synaptic remodeling, neurogenesis) across the lifespan."
    },
    {
      author: "Graybiel & Grafton (2015)",
      title: "The Striatum: Where Skills and Habits Meet",
      description: "Foundational work on striatal circuit dynamics during habit and skill acquisition. Full text available, so its passages anchor the note."
    },
    {
      author: "Cramer et al. (2011)",
      title: "Harnessing neuroplasticity for clinical applications",
      description: "NIH workshop synthesis on translating plasticity research into training-based interventions."
    },
    {
      author: "Phillips (2017)",
      title: "Lifestyle Modulators of Neuroplasticity",
      description: "Evidence for exercise, diet, and cognitive engagement driving neuroplasticity in aging adults."
    }
  ]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // AI Assistant Chat Messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: "Hello! I am your AI Research Assistant. I have indexed the 4 imported papers regarding neuroplasticity and learning. You can ask me to compile literature syntheses, summarize key trends, or format bibliographies. Click any of the source badges below to focus my response on that paper!",
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

  // Filter papers for view
  const filteredPapers = papers.filter(p => {
    const sq = searchQuery.toLowerCase();
    return p.author.toLowerCase().includes(sq) ||
           p.title.toLowerCase().includes(sq) ||
           p.description.toLowerCase().includes(sq);
  });

  const [documentContent, setDocumentContent] = useState(
    "According to Marzola et al. (2023), neuroplasticity is not restricted to early developmental windows but remains active across the human lifespan. Their comprehensive review illuminates the delicate balance of synaptic remodeling, microglia pruning, and adult neurogenesis.\n\n" +
    "Graybiel & Grafton (2015) synthesize groundbreaking evidence regarding the striatum's role in chunking actions. During the developmental cycle of any habit or motor skill, cortical representation shifts deeply into the dorsolateral striatum.\n\n" +
    "Cramer et al. (2011) provide a critical NIH workshop consensus outline for translating neuroplasticity principles into rehabilitation.\n\n" +
    "Phillips (2017) provides a meticulous analysis of exogenous lifestyle modulators. Chief among them are physical exercise, caloric restriction, and structured cognitive engagement."
  );

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

    if (lowercase.includes('marzola') || lowercase.includes('neurodegeneration') || lowercase.includes('aging')) {
      return { text: `According to **Marzola et al. (2023)**, neuroplasticity is not restricted to early developmental windows but remains active across the human lifespan. Their comprehensive review illuminates the delicate balance of synaptic remodeling, microglia pruning, and adult neurogenesis (particularly in the dentate gyrus). They suggest that targeting these latent plasticity pathways offers high-potential clinical vectors for combating neurodegenerative conditions like Alzheimer's or Parkinson's. 

Is there a specific mechanism—such as synaptic density maintenance or neurogenesis factors—you would like me to draft a more detailed synthesis on?`};
    }
    
    if (lowercase.includes('graybiel') || lowercase.includes('habit') || lowercase.includes('striatum') || lowercase.includes('skill')) {
      return { text: `**Graybiel & Grafton (2015)** synthesize groundbreaking evidence regarding the striatum's role in chunking actions. During the developmental cycle of any habit or motor skill, cortical representation shifts deeply into the dorsolateral striatum. Once deep 'chunking' occurs, the neural firing pattern changes: spiking heavily only at the direct onset and termination of the sequence. This explains why consolidated habits are so neurologically persistent and resistant to conscious suppression.

Would you like me to generate a comparative analysis paragraph relating Graybiel's habit loops to cognitive learning curves?`};
    }

    if (lowercase.includes('cramer') || lowercase.includes('clinical') || lowercase.includes('training')) {
      return { text: `**Cramer et al. (2011)** provide a critical NIH workshop consensus outline for translating neuroplasticity principles into rehabilitation. They emphasize that therapeutic intervention must rely heavily on specificity, high repetition, and high motivational engagement to drive functional axonal sprouting. Simply performing repetitive actions without task-relevance fails to alter cortical mappings.

Would you like me to map out a clinical rehabilitation outline based on Cramer's key parameters?`};
    }

    if (lowercase.includes('phillips') || lowercase.includes('lifestyle') || lowercase.includes('diet') || lowercase.includes('exercise')) {
      return { text: `**Phillips (2017)** provides a meticulous analysis of exogenous lifestyle modulators. Chief among them are physical exercise (which significantly elevates brain-derived neurotrophic factor, or **BDNF**), caloric restriction or healthy nutrition, and structured cognitive engagement. These factors cumulatively enhance cellular resilient states, bolster dendritic branching, and protect the aging cortex from metabolic decline.

I can write a draft detailing how exercise synergizes with cognitive training for you. Should I append that directly?` };
    }

    return { text: `I have parsed your query against our imported neuroplasticity collection. 

We can look at:
1. **Marzola et al. (2023)** — Lifespan neuroplasticity & disease.
2. **Graybiel & Grafton (2015)** — Striatum, habit acquisition & chunking.
3. **Cramer et al. (2011)** — NIH clinical rehabilitation principles.
4. **Phillips (2017)** — Exercise, BDNF, and healthy aging buffers.

Let me know if you would like me to draft new sections directly into the document, modify existing content, or provide comparative analysis.`};
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
          timestamp: Date.now()
        }
      ]);

      // If Gemini returned structured citations or outline drafts, we can handle them!
      if (data.suggestion) {
        if (data.suggestion.type === 'citations' && data.suggestion.citations) {
          const newPapers: PaperItem[] = data.suggestion.citations.map((c: any) => ({
            author: `${c.authors} (${c.year})`,
            title: c.title,
            description: c.quoteSnippet || `${c.authors} review on ${c.source}`
          }));
          setPapers(prev => [...prev, ...newPapers]);
        } else if (data.suggestion.type === 'edit_document') {
          if (data.suggestion.title) setDocumentTitle(data.suggestion.title);
          if (data.suggestion.appendContent) setDocumentContent(prev => prev + data.suggestion.appendContent);
          if (data.suggestion.replaceContent) setDocumentContent(data.suggestion.replaceContent);
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
          if (fallbackPayload.suggestion.appendContent) setDocumentContent(prev => prev + fallbackPayload.suggestion.appendContent);
          if (fallbackPayload.suggestion.replaceContent) setDocumentContent(fallbackPayload.suggestion.replaceContent);
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
    <div className="h-screen bg-[#070707] text-[#e4e4e7] font-sans flex gap-[2px] p-[2px] selection:bg-[#262626] overflow-hidden">
      
      {/* Left Column (Header + Editor) */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Bar */}
        <header className="h-[34px] flex items-center justify-between shrink-0 mb-[2px] bg-[#070707] pl-1 pr-1">
          <button className="text-[#52525b] hover:text-[#e4e4e7] transition-colors duration-200 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
            </svg>
          </button>

          {/* Search Input Filter */}
          <div className="flex-1 max-w-[500px] relative mx-4">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-[15px] h-[15px] text-[#52525b]" />
            </div>
            <input 
              type="text" 
              placeholder="Filter research, citations, or summaries..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111111] border border-[#27272a] rounded-[10px] py-[7px] pl-9 pr-9 text-[13px] text-[#e4e4e7] placeholder-[#52525b] focus:outline-none focus:border-[#52525b] transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-[#52525b] hover:text-[#e4e4e7] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Header Navigation & Panel Controls */}
          <div className="flex items-center gap-3">
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
          
          {/* Floating Pill Formatting Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#161616]/95 backdrop-blur-md border border-[#2d2d30] rounded-full px-4 h-[44px] flex items-center gap-3 shadow-2xl text-[12px] text-[#a1a1aa] whitespace-nowrap select-none">
            
            {/* Font Selector */}
            <div className="flex items-center">
              <select 
                value={editorFont}
                onChange={(e) => setEditorFont(e.target.value)}
                className="bg-transparent border-none text-[#e4e4e7] focus:outline-none pr-1 cursor-pointer font-medium text-[11px]"
              >
                <option value="font-serif" className="bg-[#121212] text-white">Lora (Serif)</option>
                <option value="font-sans" className="bg-[#121212] text-white">Inter (Sans)</option>
                <option value="font-mono" className="bg-[#121212] text-white">JetBrains Mono</option>
              </select>
            </div>

            <div className="h-4 w-[1px] bg-[#2d2d30]" />

            {/* Font Size Adjusters */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setEditorFontSize(Math.max(12, editorFontSize - 1))}
                className="hover:bg-[#2c2c2e] hover:text-white rounded-full transition-colors text-[11px] font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
                title="Decrease Font Size"
              >
                -
              </button>
              <span className="text-[11.5px] font-mono w-6 text-center text-[#e4e4e7]">{editorFontSize}px</span>
              <button 
                onClick={() => setEditorFontSize(Math.min(32, editorFontSize + 1))}
                className="hover:bg-[#2c2c2e] hover:text-white rounded-full transition-colors text-[11px] font-bold w-5 h-5 flex items-center justify-center cursor-pointer"
                title="Increase Font Size"
              >
                +
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[#2d2d30]" />

            {/* Text Alignment Picker */}
            <div className="flex items-center gap-0.5">
              <button 
                onClick={() => setEditorAlign('left')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'left' ? 'text-[#38bdf8] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                title="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setEditorAlign('center')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'center' ? 'text-[#38bdf8] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                title="Align Center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setEditorAlign('right')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'right' ? 'text-[#38bdf8] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                title="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setEditorAlign('justify')}
                className={`p-1 rounded-md transition-colors cursor-pointer ${editorAlign === 'justify' ? 'text-[#38bdf8] bg-[#2c2c2e]' : 'hover:text-white hover:bg-[#202022]'}`}
                title="Align Justify"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[#2d2d30]" />

          </div>

          {/* Independent Scrollable Document Surface */}
          <div className="flex-1 overflow-y-auto p-8 pb-24 md:p-14 md:pb-28 lg:p-20 lg:pb-32 focus:outline-none scroll-smooth">
            <div className={`max-w-[720px] mx-auto xl:mx-0 space-y-[2.2rem] ${editorFont} text-[#d4d4d8]`} style={{ fontSize: `${editorFontSize}px`, textAlign: editorAlign }}>
              
              {/* Main Document Title */}
              <TextareaAutosize 
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="w-full bg-transparent text-[#f4f4f5] tracking-tight font-normal pb-2 resize-none outline-none leading-[1.25] text-[2.2rem] md:text-[2.6rem]"
              />
              
              {/* Folder Location Meta */}
              <div className="space-y-2 border-l-2 border-[#242426] pl-4 flex flex-col group/meta">
                <div className="text-[1.35rem] md:text-[1.5rem] text-[#e4e4e7] font-normal flex items-center gap-2">
                  <span className="text-[#52525b] text-[12px] font-mono select-none">FOLDER</span>
                  <input 
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    className="bg-transparent text-[#38bdf8] outline-none max-w-[200px]"
                  />
                </div>
                <div className="text-[1.05rem] text-[#a1a1aa] font-sans flex items-center">
                  <span className="select-none">Auto-saved inside path:&nbsp;</span>
                  <span className="text-[#e4e4e7] flex items-center">
                    <span className="cursor-default">{folderName}/</span>
                    <input 
                      type="text"
                      value={savedNoteName}
                      onChange={(e) => setSavedNoteName(e.target.value)}
                      className="bg-transparent underline underline-offset-4 outline-none w-auto max-w-[250px]"
                    />
                  </span>
                </div>
              </div>
              
              {/* Research Bibliographies Header */}
              {papers.length > 0 && (
                <div className="pt-4 flex items-center justify-between border-t border-[#262626]">
                  <h3 className="text-[1.25rem] md:text-[1.35rem] text-[#f4f4f5] font-normal">
                    Papers Imported ({papers.length}):
                  </h3>
                  {searchQuery && (
                    <span className="text-xs bg-[#242426] border border-[#27272a] px-2.5 py-1 rounded-full text-[#38bdf8] font-sans">
                      Filtered {filteredPapers.length} of {papers.length}
                    </span>
                  )}
                </div>
              )}
              
              {/* Main Document Content Area */}
              <div className="min-h-[400px]">
                <TextareaAutosize 
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  placeholder="Start writing your research document here..."
                  className="w-full bg-transparent text-inherit outline-none resize-none leading-relaxed min-h-[400px]"
                />
              </div>

              {/* Concluding segment info */}
              <div className="pt-8 border-t border-[#262626] flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-[1.125rem] text-[#e4e4e7] font-normal leading-relaxed">
                  Note created: <span className="font-semibold text-white">{savedNoteName}</span> saved inside the <span className="text-[#38bdf8] font-semibold">{folderName}</span> folder.
                </p>
              </div>

            </div>
          </div>
          
        </div>
      </div>

      {/* Right Section - AI Assistant Window Panel */}
      {isAssistantOpen && (
          <div className="w-[320px] md:w-[350px] bg-[#121212] rounded-2xl flex flex-col h-full shrink-0 overflow-hidden shadow-2xl animate-slide-in">
            
            {/* Assistant Header */}
            <div className="h-[52px] flex items-center justify-between px-5 shrink-0 bg-[#121212]">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
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
                  className={`flex flex-col max-w-[88%] ${m.role === 'user' ? 'self-end bg-[#262626] text-white rounded-br-none' : 'self-start bg-[#161616] border border-[#242426] text-[#d4d4d8] rounded-bl-none'} p-3.5 rounded-xl text-[12.5px] leading-relaxed transition-all`}
                >
                  {/* Sender identity */}
                  <span className={`text-[10px] font-mono uppercase tracking-wider mb-1.5 ${m.role === 'user' ? 'text-[#38bdf8]' : 'text-[#a1a1aa]'}`}>
                    {m.role === 'user' ? 'Workspace Owner' : 'AI Advisor'}
                  </span>
                  
                  {/* Text message */}
                  <div className="whitespace-pre-line prose select-text break-words">
                    {m.content}
                  </div>
                  
                  {/* Message Timestamp */}
                  <span className="text-[9px] text-[#52525b] text-right mt-1.5 font-mono select-none">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Streaming loading animation state */}
              {isAiTyping && (
                <div className="self-start bg-[#161616] border border-[#242426] text-[#d4d4d8] rounded-xl rounded-bl-none p-3.5 max-w-[88%] text-[12.5px] leading-relaxed">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa] block mb-2">
                    AI Advisor is Synthesising...
                  </span>
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
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

              <div className="bg-[#222222] rounded-[10px] flex flex-col border border-transparent focus-within:border-[#38bdf8] transition-colors">
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
                        ? 'text-[#38bdf8] hover:bg-[#2d2d30] hover:text-white' 
                        : 'text-[#52525b] cursor-not-allowed'
                    }`}
                  >
                    <SendHorizontal className="w-[18px] h-[18px] -rotate-45 -mt-0.5 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>

        </div>
      )}

    </div>
  );
}
