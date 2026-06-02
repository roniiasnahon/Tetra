import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ScanLine, 
  Bell, 
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
  const [isEditMode, setIsEditMode] = useState(false);
  
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

  // Intel fallback response generator for offline or key-missing states
  const getFallbackResponse = (query: string): string => {
    const lowercase = query.toLowerCase();
    
    if (lowercase.includes('marzola') || lowercase.includes('neurodegeneration') || lowercase.includes('aging')) {
      return `According to **Marzola et al. (2023)**, neuroplasticity is not restricted to early developmental windows but remains active across the human lifespan. Their comprehensive review illuminates the delicate balance of synaptic remodeling, microglia pruning, and adult neurogenesis (particularly in the dentate gyrus). They suggest that targeting these latent plasticity pathways offers high-potential clinical vectors for combating neurodegenerative conditions like Alzheimer's or Parkinson's. 

Is there a specific mechanism—such as synaptic density maintenance or neurogenesis factors—you would like me to draft a more detailed synthesis on?`;
    }
    
    if (lowercase.includes('graybiel') || lowercase.includes('habit') || lowercase.includes('striatum') || lowercase.includes('skill')) {
      return `**Graybiel & Grafton (2015)** synthesize groundbreaking evidence regarding the striatum's role in chunking actions. During the developmental cycle of any habit or motor skill, cortical representation shifts deeply into the dorsolateral striatum. Once deep 'chunking' occurs, the neural firing pattern changes: spiking heavily only at the direct onset and termination of the sequence. This explains why consolidated habits are so neurologically persistent and resistant to conscious suppression.

Would you like me to generate a comparative analysis paragraph relating Graybiel's habit loops to cognitive learning curves?`;
    }

    if (lowercase.includes('cramer') || lowercase.includes('clinical') || lowercase.includes('training')) {
      return `**Cramer et al. (2011)** provide a critical NIH workshop consensus outline for translating neuroplasticity principles into rehabilitation. They emphasize that therapeutic intervention must rely heavily on specificity, high repetition, and high motivational engagement to drive functional axonal sprouting. Simply performing repetitive actions without task-relevance fails to alter cortical mappings.

Would you like me to map out a clinical rehabilitation outline based on Cramer's key parameters?`;
    }

    if (lowercase.includes('phillips') || lowercase.includes('lifestyle') || lowercase.includes('diet') || lowercase.includes('exercise')) {
      return `**Phillips (2017)** provides a meticulous analysis of exogenous lifestyle modulators. Chief among them are physical exercise (which significantly elevates brain-derived neurotrophic factor, or **BDNF**), caloric restriction or healthy nutrition, and structured cognitive engagement. These factors cumulatively enhance cellular resilient states, bolster dendritic branching, and protect the aging cortex from metabolic decline.

I can write a draft detailing how exercise synergizes with cognitive training for you. Should I append that directly?`;
    }

    if (lowercase.includes('draft') || lowercase.includes('write') || lowercase.includes('summary') || lowercase.includes('synthesis')) {
      return `I would be glad to draft a academic synthesis for you. Based on your active workspace papers (**Marzola et al., 2023** on neurobiology, **Graybiel & Grafton, 2015** on striatal execution, and **Phillips, 2017** on BDNF upregulation), we can frame learning as a multi-tier network remodel. 

Here is a drafted sentence you can add:
> *"Scholarly consensus indicates that cognitive consolidation is a highly physical, lifestyle-dependent adaptation. It requires both cortical neurodevelopmental responsiveness (Marzola et al., 2023) and striatal automation pathways (Graybiel & Grafton, 2015), which are actively catalyzed by aerobic and cognitive lifestyle stressors (Phillips, 2017)."*

Feel free to copy this or ask me to expand further!`;
    }

    return `I have parsed your query against our imported neuroplasticity collection. 

We can look at:
1. **Marzola et al. (2023)** — Lifespan neuroplasticity & disease.
2. **Graybiel & Grafton (2015)** — Striatum, habit acquisition & chunking.
3. **Cramer et al. (2011)** — NIH clinical rehabilitation principles.
4. **Phillips (2017)** — Exercise, BDNF, and healthy aging buffers.

Let me know if you would like a comparative literature review, APA referencing, or structured drafted sections!`;
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
              draftContent: papers.map(p => `${p.author}: ${p.description}`).join('\n\n'),
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
        }
      }

    } catch (e) {
      console.warn("Express server Gemini API failed, using deep local simulation rules:", e);
      // Fallback safely to our local academic intelligence
      const simulatedAnswer = getFallbackResponse(textToSend);
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
    <div className="h-screen bg-[#070707] text-[#e4e4e7] font-sans flex flex-col selection:bg-[#262626] overflow-hidden">
      
      {/* Header Bar */}
      <header className="h-[60px] flex items-center justify-between px-4 shrink-0 border-b border-[#1c1c1e] bg-[#070707]">
        <button className="text-[#52525b] hover:text-[#e4e4e7] p-2 transition-colors duration-200 cursor-pointer">
          {/* Custom Folder Icon that is outlined and minimal */}
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
          <button 
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className={`text-[#52525b] hover:text-[#e4e4e7] relative p-2 transition-colors cursor-pointer rounded-md ${
              isAssistantOpen ? 'text-[#38bdf8] bg-[#18181b]' : ''
            }`}
            title="Toggle Assistant Sidebar"
          >
            {isAssistantOpen ? <PanelRightClose className="w-[18px] h-[18px]" /> : <PanelRightOpen className="w-[18px] h-[18px]" />}
          </button>
          
          <div className="w-[30px] h-[30px] rounded-full bg-zinc-800 overflow-hidden border border-[#27272a] flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-gradient-to-tr from-zinc-700 to-zinc-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner select-none">U</div>
          </div>
          
          <button className="text-[#52525b] hover:text-[#e4e4e7] relative p-2 transition-colors cursor-pointer rounded-md">
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-[9px] right-[9px] w-[5px] h-[5px] bg-[#a1a1aa] rounded-full border border-[#070707]"></span>
          </button>
        </div>
      </header>

      {/* Main Splitted Content */}
      <main className="flex-1 flex gap-3 p-3 pt-0 overflow-hidden min-h-0">
        
        {/* Left Section - Editor View Component Container */}
        <div className="flex-1 bg-[#121212] border border-[#262626] rounded-xl flex flex-col overflow-hidden min-w-0 h-full">
          
          {/* Google Docs Academic Editor Toolbar */}
          <div className="h-[48px] shrink-0 border-b border-[#262626] bg-[#161616] rounded-t-xl flex items-center justify-between px-4 text-[12px] text-[#a1a1aa] gap-3 overflow-x-auto scrollbar-none select-none">
            
            {/* Toolbar Formatting Options */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Font Selector */}
              <select 
                value={editorFont}
                onChange={(e) => setEditorFont(e.target.value)}
                className="bg-[#242426] border border-[#2a2a2c] text-white rounded px-2.5 py-1 outline-none text-[12px] cursor-pointer"
              >
                <option value="font-serif">Lora (Serif)</option>
                <option value="font-sans">Inter (Sans)</option>
                <option value="font-mono">JetBrains Mono</option>
              </select>

              <div className="h-4 w-[1px] bg-[#2d2d30]" />

              {/* Font Size Adjusters */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setEditorFontSize(Math.max(12, editorFontSize - 1))}
                  className="p-1 hover:bg-[#2c2c2e] hover:text-white rounded-md transition-colors text-[11px] font-bold w-6 h-6 flex items-center justify-center"
                  title="Decrease Font Size"
                >
                  -
                </button>
                <span className="text-[11.5px] font-mono px-1 w-8 text-center text-[#e4e4e7]">{editorFontSize}px</span>
                <button 
                  onClick={() => setEditorFontSize(Math.min(32, editorFontSize + 1))}
                  className="p-1 hover:bg-[#2c2c2e] hover:text-white rounded-md transition-colors text-[11px] font-bold w-6 h-6 flex items-center justify-center"
                  title="Increase Font Size"
                >
                  +
                </button>
              </div>

              <div className="h-4 w-[1px] bg-[#2d2d30]" />

              {/* Text Alignment Picker */}
              <div className="flex items-center gap-0.5 bg-[#1a1a1c] p-0.5 rounded-lg border border-[#2a2a2c]">
                <button 
                  onClick={() => setEditorAlign('left')}
                  className={`p-1 rounded-md transition-colors ${editorAlign === 'left' ? 'bg-[#2c2c2e] text-[#38bdf8]' : 'hover:text-white hover:bg-[#202022]'}`}
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setEditorAlign('center')}
                  className={`p-1 rounded-md transition-colors ${editorAlign === 'center' ? 'bg-[#2c2c2e] text-[#38bdf8]' : 'hover:text-white hover:bg-[#202022]'}`}
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setEditorAlign('right')}
                  className={`p-1 rounded-md transition-colors ${editorAlign === 'right' ? 'bg-[#2c2c2e] text-[#38bdf8]' : 'hover:text-white hover:bg-[#202022]'}`}
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setEditorAlign('justify')}
                  className={`p-1 rounded-md transition-colors ${editorAlign === 'justify' ? 'bg-[#2c2c2e] text-[#38bdf8]' : 'hover:text-white hover:bg-[#202022]'}`}
                  title="Align Justify"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-4 w-[1px] bg-[#2d2d30]" />

              {/* Helpful instructions tooltip */}
              <div className="hidden lg:flex items-center gap-1.5 text-[#52525b]">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[11px]">Academic Document Template</span>
              </div>

            </div>

            {/* Document States / Read and Edit Modes */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-[#71717a] font-mono whitespace-nowrap">
                {wordCount} words
              </span>
              <span className="h-4 w-[1px] bg-[#2d2d30]" />
              
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors duration-200 border cursor-pointer ${
                  isEditMode 
                    ? 'bg-[#e4e4e7] text-black border-transparent hover:bg-white font-semibold' 
                    : 'bg-transparent border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#262626]'
                }`}
                title="Toggle Google Doc Edit Mode"
              >
                {isEditMode ? '✓ Editing Mode' : '✎ Edit Document'}
              </button>
            </div>

          </div>

          {/* Independent Scrollable Document Surface */}
          <div className="flex-1 overflow-y-auto p-8 md:p-14 lg:p-20 focus:outline-none scroll-smooth">
            <div className={`max-w-[720px] mx-auto xl:mx-0 space-y-[2.2rem] ${editorFont} text-[#d4d4d8]`} style={{ fontSize: `${editorFontSize}px`, textAlign: editorAlign }}>
              
              {/* Main Document Title */}
              {isEditMode ? (
                <div className="space-y-1 text-left">
                  <label className="text-[11px] text-[#52525b] uppercase font-mono block">Document Title</label>
                  <textarea 
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="w-full bg-[#18181b] text-[#f4f4f5] border border-[#27272a] rounded-lg p-3 text-[1.8rem] md:text-[2.2rem] leading-[1.3] font-normal focus:outline-none focus:border-[#38bdf8] transition-colors resize-none filter-none"
                    rows={2}
                  />
                </div>
              ) : (
                <h1 className="text-[2.2rem] md:text-[2.6rem] leading-[1.25] text-[#f4f4f5] tracking-tight font-normal pb-2 animate-fade-in">
                  {documentTitle}
                </h1>
              )}
              
              {/* Folder Location Meta */}
              {isEditMode ? (
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#52525b] uppercase font-mono block">Workspace Folder</label>
                    <input 
                      type="text"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      className="w-full bg-[#18181b] text-white border border-[#27272a] rounded-lg px-3 py-1.5 text-[13.5px] focus:outline-none focus:border-[#38bdf8] transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#52525b] uppercase font-mono block">Note Descriptor</label>
                    <input 
                      type="text"
                      value={savedNoteName}
                      onChange={(e) => setSavedNoteName(e.target.value)}
                      className="w-full bg-[#18181b] text-white border border-[#27272a] rounded-lg px-3 py-1.5 text-[13.5px] focus:outline-none focus:border-[#38bdf8] transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 border-l-2 border-[#242426] pl-4">
                  <h2 className="text-[1.35rem] md:text-[1.5rem] text-[#e4e4e7] font-normal flex items-center gap-2">
                    <span className="text-[#52525b] text-[12px] font-mono">FOLDER</span>
                    <span className="text-[#38bdf8]">{folderName}</span>
                  </h2>
                  <p className="text-[1.05rem] text-[#a1a1aa] font-sans">
                    Auto-saved inside path: <span className="text-[#e4e4e7] underline underline-offset-4 cursor-pointer">{folderName}/{savedNoteName}</span>
                  </p>
                </div>
              )}
              
              {/* Research Bibliographies Header */}
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
              
              {/* Scrollable list inside left workspace content */}
              <ul className="space-y-[1.8rem] text-[1.05rem] md:text-[1.125rem]">
                {isEditMode ? (
                  // Edit Mode Items view
                  <div className="space-y-4 font-sans text-left">
                    {filteredPapers.map((p, idx) => (
                      <div key={idx} className="bg-[#18181b] border border-[#27272a] p-4.5 rounded-lg space-y-3.5 transition-all">
                        <div className="flex gap-2.5 items-center justify-between">
                          <input 
                            type="text"
                            value={p.author}
                            onChange={(e) => {
                              const updated = [...papers];
                              const actualIdx = papers.indexOf(p);
                              if (actualIdx !== -1) {
                                updated[actualIdx].author = e.target.value;
                                setPapers(updated);
                              }
                            }}
                            className="bg-[#242426] border border-[#27272a] rounded px-3 py-1 font-mono text-[12.5px] text-[#38bdf8] outline-none max-w-[280px]"
                            placeholder="Author (Year)"
                          />
                          <button 
                            onClick={() => {
                              const actualIdx = papers.indexOf(p);
                              if (actualIdx !== -1) {
                                const updated = papers.filter((_, i) => i !== actualIdx);
                                setPapers(updated);
                              }
                            }}
                            className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-[#2c2c2e] transition-colors"
                            title="Delete Source Citation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input 
                          type="text"
                          value={p.title}
                          onChange={(e) => {
                            const updated = [...papers];
                            const actualIdx = papers.indexOf(p);
                            if (actualIdx !== -1) {
                              updated[actualIdx].title = e.target.value;
                              setPapers(updated);
                            }
                          }}
                          className="w-full bg-[#1e1e21] border border-[#27272a] rounded-md px-3 py-1.5 text-[13.5px] outline-none focus:border-[#38bdf8]"
                          placeholder="Paper Title"
                        />
                        <textarea 
                          value={p.description}
                          onChange={(e) => {
                            const updated = [...papers];
                            const actualIdx = papers.indexOf(p);
                            if (actualIdx !== -1) {
                              updated[actualIdx].description = e.target.value;
                              setPapers(updated);
                            }
                          }}
                          className="w-full bg-[#1e1e21] border border-[#27272a] rounded-md px-3 py-1.5 text-[12.5px] outline-none resize-none h-20 text-[#a1a1aa] leading-relaxed"
                          placeholder="Summarized ideas/findings..."
                        />
                      </div>
                    ))}

                    <button 
                      onClick={() => {
                        const newPaper: PaperItem = {
                          author: "New Author et al. (2026)",
                          title: "New Neurobiology Insights",
                          description: "Enter detailed research insights, paragraphs, or citation summaries."
                        };
                        setPapers([...papers, newPaper]);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#242426] hover:bg-[#2d2d30] border border-[#2a2a2c] text-white text-[13px] rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Academic Paper Reference
                    </button>
                  </div>
                ) : (
                  // Reading Mode standard beautiful lists
                  filteredPapers.map((p, idx) => (
                    <li key={idx} className="flex gap-4 group/item animate-fade-in">
                      <span className="text-[#52525b] mt-[0.45rem] text-[0.6rem] shrink-0 select-none">●</span>
                      <div className="leading-[1.65]">
                        <span className="text-[#f4f4f5] font-semibold">{p.author}</span>
                        {" — "}
                        <span className="text-[#e4e4e7] italic inline-block mr-1">{p.title}.</span>
                        <span className="text-[#a1a1aa]">{p.description}</span>
                        
                        {/* Dynamic Suggestion Attachment Hook */}
                        <div className="mt-2 opacity-0 group-hover/item:opacity-100 transition-all flex items-center gap-3">
                          <button 
                            onClick={() => handleSendMessage(`Draft a summary about standard claims of ${p.author}`)}
                            className="text-[11px] text-[#38bdf8] hover:underline font-mono flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" /> Draft synthesis
                          </button>
                          <span className="text-[#27272a] text-xs">|</span>
                          <button 
                            onClick={() => {
                              const citationCopy = `${p.author}. "${p.title}." Academic Repository Database, 2026.`;
                              navigator.clipboard.writeText(citationCopy);
                              alert("Citation details copied to clipboard!");
                            }}
                            className="text-[11px] text-[#a1a1aa] hover:underline font-mono"
                          >
                            Copy APA bibliography
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
                {filteredPapers.length === 0 && (
                  <div className="py-12 text-center text-[#52525b] font-sans">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-[14px]">No sources match your active query.</p>
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs text-[#38bdf8] hover:underline font-mono"
                    >
                      Clear search filter
                    </button>
                  </div>
                )}
              </ul>

              {/* Concluding segment info */}
              {!isEditMode && (
                <div className="pt-8 border-t border-[#262626] flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-[1.125rem] text-[#e4e4e7] font-normal leading-relaxed">
                    Note created: <span className="font-semibold text-white">{savedNoteName}</span> saved inside the <span className="text-[#38bdf8] font-semibold">{folderName}</span> folder.
                  </p>
                </div>
              )}

            </div>
          </div>
          
          {/* Docs Metadata Status Indicator */}
          <div className="h-[36px] bg-[#161616] border-t border-[#262626] shrink-0 px-4 flex items-center justify-between text-[11px] text-[#52525b] font-mono select-none">
            <div className="flex items-center gap-3">
              <span>STATUS: AUTO-SAVED IN REALTIME</span>
              <span>•</span>
              <span className="text-[#38bdf8]">{papers.length} SOURCES ATTACHED</span>
            </div>
            <div>
              <span>UTF-8</span>
            </div>
          </div>

        </div>

        {/* Right Section - AI Assistant Window Panel */}
        {isAssistantOpen && (
          <div className="w-[320px] md:w-[350px] bg-[#121212] border border-[#262626] rounded-xl flex flex-col h-full shrink-0 overflow-hidden shadow-2xl animate-slide-in">
            
            {/* Assistant Header */}
            <div className="h-[52px] flex items-center justify-between px-5 border-b border-[#262626] shrink-0 bg-[#121212]">
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
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Citations / Sources index panel (Sticky at top of advisor side) */}
            <div className="p-4 border-b border-[#262626] bg-[#161616] shrink-0">
              <h3 className="text-[#e4e4e7] text-[12px] mb-2.5 font-normal flex items-center justify-between">
                <span>Active Research Sources:</span>
                <span className="text-[10.5px] font-mono text-[#52525b]">Click a pill to prompt</span>
              </h3>
              <div className="flex flex-wrap gap-2 max-h-[82px] overflow-y-auto scrollbar-none pr-1">
                {papers.map((p, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSendMessage(`Analyze the claims of ${p.author} and synthesise with our current note.`)}
                    className="px-2.5 py-1 bg-[#262626] hover:bg-[#343438] hover:text-[#38bdf8] transition-colors border border-transparent rounded-[100px] text-[11.5px] text-[#d4d4d8] cursor-pointer max-w-[150px] truncate text-left"
                    title={p.title}
                  >
                    {p.author}
                  </button>
                ))}
              </div>
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
            <div className="p-3.5 shrink-0 bg-[#121212] border-t border-[#262626]">
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

      </main>

      {/* Floating Panel Re-opener handle (Visible only if user closed the sidebar) */}
      {!isAssistantOpen && (
        <button 
          onClick={() => setIsAssistantOpen(true)}
          className="absolute right-4 bottom-5 px-3 py-2 bg-[#222222] border border-[#2d2d30] hover:border-[#38bdf8] hover:text-[#38bdf8] text-[#a1a1aa] rounded-full text-xs font-mono transition-all flex items-center gap-1.5 shadow-xl select-none cursor-pointer duration-200"
          title="Open AI Research Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Open Advisor</span>
        </button>
      )}

    </div>
  );
}
