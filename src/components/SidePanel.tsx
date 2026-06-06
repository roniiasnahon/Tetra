import React, { useState, useEffect, useMemo } from 'react';
import { AudioVisualizerPlayer } from './AudioVisualizerPlayer';
import { 
  X, 
  FileText, 
  Clock, 
  Globe, 
  Calendar, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  RotateCcw, 
  AlertCircle,
  ExternalLink,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  BrainCircuit,
  FileQuestion,
  User,
  Info,
  ChevronDown,
  Music,
  Image as ImageIcon,
  Paperclip,
  File,
  Download
} from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  tabId: string;
  activeTab: any;
  papers: any[];
}

interface SourceItem {
  id: string;
  title: string;
  url: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

interface QuizData {
  isQuizApplicable: boolean;
  applicabilityReason: string;
  questions?: QuizQuestion[];
}

export const SidePanel: React.FC<SidePanelProps> = ({ 
  isOpen, 
  onClose, 
  tabId, 
  activeTab, 
  papers 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'notes' | 'details' | 'sources' | 'quizzes' | 'attachments'>('notes');

  // Notes state
  const [notes, setNotes] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [notesSavedStatus, setNotesSavedStatus] = useState<boolean>(false);

  // Author & url override state
  const [customAuthor, setCustomAuthor] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  // Sources state
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<{ id: string; name: string; mimetype: string; timestamp: number }[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');

  // Quiz state
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizHistory, setQuizHistory] = useState<Record<number, number>>({}); // maps question index to chosen option

  // Retrieve current paper matching activeTab
  const matchingPaper = useMemo(() => {
    if (!activeTab) return null;
    return papers.find(p => p.fileId === activeTab.fileId || p.title === activeTab.title) || null;
  }, [papers, activeTab]);

  // Compute document key for storage
  const docStorageKey = useMemo(() => {
    return tabId || 'default-doc';
  }, [tabId]);

  // Effect to load stored data when tab changes
  useEffect(() => {
    if (!isOpen) return;

    // 1. Load Notes
    const savedNotes = localStorage.getItem(`notes_${docStorageKey}`);
    setNotes(savedNotes || '');
    setNotesSavedStatus(false);

    // 2. Load Details overrides
    const savedAuthor = localStorage.getItem(`author_${docStorageKey}`) || matchingPaper?.author || '';
    const savedUrl = localStorage.getItem(`url_${docStorageKey}`) || matchingPaper?.url || '';
    setCustomAuthor(savedAuthor);
    setCustomUrl(savedUrl);
    setIsEditingDetails(false);

    // 3. Load Sources
    const savedSourcesStr = localStorage.getItem(`sources_${docStorageKey}`);
    if (savedSourcesStr) {
      try {
        setSources(JSON.parse(savedSourcesStr));
      } catch (err) {
        setSources([]);
      }
    } else {
      // Auto-initialize with original source if available
      const defaultUrl = matchingPaper?.url || activeTab?.url;
      if (defaultUrl) {
        const initSourcesList = [
          {
            id: 'original',
            title: 'Primary Reference Web Link',
            url: defaultUrl
          }
        ];
        setSources(initSourcesList);
        localStorage.setItem(`sources_${docStorageKey}`, JSON.stringify(initSourcesList));
      } else {
        setSources([]);
      }
    }

    // 4. Load Quiz state
    const savedQuizStr = localStorage.getItem(`quiz_${docStorageKey}`);
    if (savedQuizStr) {
      try {
        setQuizData(JSON.parse(savedQuizStr));
      } catch {
        setQuizData(null);
      }
    } else {
      setQuizData(null);
    }

    // 5. Load Attachments state
    const savedAttachmentsStr = localStorage.getItem(`attachments_${docStorageKey}`);
    if (savedAttachmentsStr) {
      try {
        setAttachments(JSON.parse(savedAttachmentsStr));
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }

    // Reset quiz runtime state upon document switch
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizHistory({});
    setQuizError('');
    setAttachmentError('');

  }, [docStorageKey, isOpen, matchingPaper, activeTab]);

  // Auto-save notes
  const handleNotesChange = (val: string) => {
    setNotes(val);
    localStorage.setItem(`notes_${docStorageKey}`, val);
    setNotesSavedStatus(true);
    const timeoutId = setTimeout(() => {
      setNotesSavedStatus(false);
    }, 1000);
    return () => clearTimeout(timeoutId);
  };

  const handleCopyNotes = () => {
    navigator.clipboard.writeText(notes);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Details Save Override
  const handleSaveDetails = () => {
    localStorage.setItem(`author_${docStorageKey}`, customAuthor);
    localStorage.setItem(`url_${docStorageKey}`, customUrl);
    setIsEditingDetails(false);
  };

  // Calculate dynamic content metrics
  const wordMetrics = useMemo(() => {
    if (!activeTab?.content) {
      // check extractedText
      const altText = matchingPaper?.extractedText || matchingPaper?.description || '';
      const wCount = altText.trim() ? altText.trim().split(/\s+/).length : 0;
      return {
        wordCount: wCount,
        readingTime: Math.max(1, Math.ceil(wCount / 200)),
        chars: altText.length
      };
    }
    const cleanText = activeTab.content.replace(/<[^>]*>/g, ' ').trim();
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    return {
      wordCount,
      readingTime,
      chars: cleanText.length
    };
  }, [activeTab, matchingPaper]);

  // Sources management
  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    setSourceError('');
    if (!newSourceUrl.trim()) return;

    let formattedUrl = newSourceUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      new URL(formattedUrl);
    } catch (_) {
      setSourceError('Invalid website URL address.');
      return;
    }

    const titleToUse = newSourceName.trim() || new URL(formattedUrl).hostname;
    const newSource: SourceItem = {
      id: `src-${Date.now()}`,
      title: titleToUse,
      url: formattedUrl
    };

    const updated = [...sources, newSource];
    setSources(updated);
    localStorage.setItem(`sources_${docStorageKey}`, JSON.stringify(updated));

    setNewSourceName('');
    setNewSourceUrl('');
    setIsAddSourceModalOpen(false);
  };

  const handleDeleteSource = (idToDelete: string) => {
    const updated = sources.filter(s => s.id !== idToDelete);
    setSources(updated);
    localStorage.setItem(`sources_${docStorageKey}`, JSON.stringify(updated));
  };

  // Attachments management
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    setAttachmentError('');

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload attachment");
      }

      const data = await response.json();
      if (data.success) {
        const newAttachment = {
          id: data.fileId,
          name: data.fileName,
          mimetype: data.mimetype,
          timestamp: Date.now()
        };

        const updated = [newAttachment, ...attachments];
        setAttachments(updated);
        localStorage.setItem(`attachments_${docStorageKey}`, JSON.stringify(updated));
      } else {
        throw new Error(data.error || "Upload response success false");
      }
    } catch (err: any) {
      setAttachmentError(err.message || "Error uploading attachment");
    } finally {
      setIsUploadingAttachment(false);
      // Reset input value
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = (idToDelete: string) => {
    const updated = attachments.filter(a => a.id !== idToDelete);
    setAttachments(updated);
    localStorage.setItem(`attachments_${docStorageKey}`, JSON.stringify(updated));
  };

  // Quizzes logic
  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizError('');
    try {
      const draftContent = activeTab?.content || matchingPaper?.extractedText || matchingPaper?.description || 'No document content available.';
      
      const response = await fetch('/api/research/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftContent,
          title: activeTab?.title || matchingPaper?.title || 'Draft Workspace'
        })
      });

      if (!response.ok) {
        throw new Error('Server issues creating interactive assessment.');
      }

      const rawResult = await response.json();
      setQuizData(rawResult);
      localStorage.setItem(`quiz_${docStorageKey}`, JSON.stringify(rawResult));

      // Reset score
      setCurrentQuestionIndex(0);
      setSelectedOptionIndex(null);
      setQuizScore(0);
      setQuizFinished(false);
      setQuizHistory({});
    } catch (err: any) {
      setQuizError(err.message || 'Error executing AI generation request.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Build a backup/fallback general academic drafting check if the AI decides a quiz is not applicable
  const loadFallbackQuiz = () => {
    const fallbackQuiz: QuizData = {
      isQuizApplicable: true,
      applicabilityReason: "Providing a standardized educational quiz testing citation standards and academic literature synthesis.",
      questions: [
        {
          question: "When paraphrasing structural arguments from an external source, what constitutes a valid citation?",
          options: [
            "Simply copying the exact sentences without quotes while appending the author's name.",
            "Changing every third word of the sentence and citing the source in the footnotes.",
            "Synthesizing the core concept in your own original phrasing while crediting the original author.",
            "Only references placed inside the summary section require formal citation."
          ],
          correctAnswerIndex: 2
        },
        {
          question: "What is the primary function of a literature synthesis in school research portfolios?",
          options: [
            "Listing all bibliography references in chronological order of publishing.",
            "Critically grouping, contrasting, and evaluating major themes across multiple separate papers.",
            "Rewriting abstracts of publications to verify writing counts.",
            "A synthesis is only needed for peer-review thesis dissertations."
          ],
          correctAnswerIndex: 1
        },
        {
          question: "Which metadata element is most reliable when verifying scholastic credibility of an internet document?",
          options: [
            "The visual color contrast of the web banner styling.",
            "Formal author credentials, institutional association, and peer-reviewed publishing citations.",
            "The exact number of words counted across secondary headers.",
            "How many advertisements populate the side banners."
          ],
          correctAnswerIndex: 1
        }
      ]
    };
    setQuizData(fallbackQuiz);
    localStorage.setItem(`quiz_${docStorageKey}`, JSON.stringify(fallbackQuiz));
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizHistory({});
  };

  const handleSelectOption = (idx: number) => {
    if (selectedOptionIndex !== null) return; // Answer already revealed
    setSelectedOptionIndex(idx);
    
    // Track selected option
    const updatedHistory = { ...quizHistory, [currentQuestionIndex]: idx };
    setQuizHistory(updatedHistory);

    const isCorrect = idx === quizData?.questions?.[currentQuestionIndex]?.correctAnswerIndex;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    const totalQuestions = quizData?.questions?.length || 0;
    setSelectedOptionIndex(null);

    if (currentQuestionIndex + 1 < totalQuestions) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizHistory({});
  };

  if (!isOpen) return null;

  return (
    <div className="w-[340px] bg-[#121212] border-l border-[#1c1c1f] h-full flex flex-col shrink-0 overflow-hidden select-none animate-slide-in">
      {/* Tab Navigation Menu */}
      <div className="flex items-center gap-1.5 px-4 h-[56px] bg-[#121212] shrink-0">
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
          {(['quizzes', 'notes', 'details', 'sources', 'attachments'] as const).map(tab => {
            let label = tab as string;
            if (tab === 'quizzes') label = 'Test';
            if (tab === 'sources') label = 'Sources';
            if (tab === 'attachments') label = 'Files';

            return (
              <button 
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-2.5 py-1.5 rounded-full text-[12px] font-medium capitalize transition-all duration-150 cursor-pointer text-center whitespace-nowrap ${
                  activeSubTab === tab 
                    ? 'text-[#f4f4f5] bg-[#27272a]' 
                    : 'text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#18181b]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        
        <button 
          onClick={onClose} 
          className="p-1 px-1.5 ml-1 hover:bg-[#1a1a1c] rounded-md cursor-pointer transition-all text-[#71717a] hover:text-[#f2f2f3]"
          aria-label="Close Side Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Scrolling Viewer container */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-[#121212]">
        
        {/* TAB 1: NOTES */}
        {activeSubTab === 'notes' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-end px-4 pt-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                {notesSavedStatus && (
                  <span className="text-[#a1a1aa] flex items-center gap-1 animate-fade-in font-medium">
                    <Check className="w-3 h-3 text-emerald-500" />
                    Saved
                  </span>
                )}
                <button 
                  onClick={handleCopyNotes}
                  disabled={!notes.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-transparent text-[#a1a1aa] hover:text-[#f4f4f5] disabled:opacity-40 transition-all cursor-pointer border-none"
                  title="Copy notes to clipboard"
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <textarea
              className="flex-1 w-full min-h-[300px] bg-transparent text-[#cfcfd4] p-4 pt-1 focus:outline-none text-[13px] leading-relaxed resize-none font-sans placeholder-[#52525b] border-none outline-none focus:ring-0"
              placeholder="Paste relevant excerpts, frame your primary thesis, outline sections, or capture spontaneous ideas about this document..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>
        )}

        {/* TAB 2: DETAILS */}
        {activeSubTab === 'details' && (
          <div className="flex flex-col flex-1 p-4 bg-transparent text-[13px]">
            <div 
              className="flex items-center justify-between mb-4 text-[#f4f4f5] font-semibold cursor-pointer select-none"
              onClick={() => setIsEditingDetails(!isEditingDetails)}
            >
              <div className="flex items-center gap-2">
                <ChevronDown className={`w-4 h-4 transition-transform text-[#a1a1aa] ${isEditingDetails ? 'rotate-[-90deg]' : ''}`} />
                <span>File details</span>
              </div>
            </div>

            {!isEditingDetails && (
              <div className="flex flex-col space-y-4 pl-[26px]">
                <div className="flex leading-normal">
                  <span className="w-1/3 shrink-0 text-[#a1a1aa]">File type</span>
                  <span className="flex-1 text-[#f4f4f5] font-medium capitalize">{matchingPaper?.fileType || activeTab?.mimetype || 'Document'}</span>
                </div>
                <div className="flex leading-normal">
                  <span className="w-1/3 shrink-0 text-[#a1a1aa]">Title</span>
                  <span className="flex-1 text-[#f4f4f5] font-medium">{activeTab?.title || matchingPaper?.title || 'Document'}</span>
                </div>
                <div className="flex leading-normal">
                  <span className="w-1/3 shrink-0 text-[#a1a1aa]">Authors</span>
                  <span className="flex-1 text-[#f4f4f5] font-medium">{customAuthor || matchingPaper?.author || 'Unknown'}</span>
                </div>
                <div className="flex leading-normal">
                  <span className="w-1/3 shrink-0 text-[#a1a1aa]">Published</span>
                  <span className="flex-1 text-[#f4f4f5] font-medium">{matchingPaper?.added || 'Just now'}</span>
                </div>
                <div className="flex leading-normal">
                  <span className="w-1/3 shrink-0 text-[#a1a1aa]">URL</span>
                  <span className="flex-1 text-[#f4f4f5] font-medium break-all">{customUrl || matchingPaper?.url || 'URL not specified'}</span>
                </div>
                {wordMetrics.wordCount > 0 && (
                  <>
                    <div className="flex leading-normal">
                      <span className="w-1/3 shrink-0 text-[#a1a1aa]">Word Count</span>
                      <span className="flex-1 text-[#f4f4f5] font-medium">{wordMetrics.wordCount.toLocaleString()}</span>
                    </div>
                    <div className="flex leading-normal">
                      <span className="w-1/3 shrink-0 text-[#a1a1aa]">Reading Time</span>
                      <span className="flex-1 text-[#f4f4f5] font-medium">{wordMetrics.readingTime} min</span>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {isEditingDetails && (
              <div className="space-y-4 pl-[26px]">
                <div className="space-y-1">
                  <label className="block text-[13px] text-[#a1a1aa]">Authors Edit</label>
                  <input 
                    type="text" 
                    value={customAuthor} 
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    className="w-full text-[13px] bg-transparent outline-none ring-0 text-[#f4f4f5] font-medium"
                    placeholder="e.g. Ronald, Stanford Lab, arXiv"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[13px] text-[#a1a1aa]">URL Edit</label>
                  <input 
                    type="text" 
                    value={customUrl} 
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="w-full text-[13px] bg-transparent outline-none ring-0 text-[#f4f4f5] font-medium"
                    placeholder="https://example.com/paper.pdf"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SOURCES */}
        {activeSubTab === 'sources' && (
          <div className="flex flex-col flex-1">
            <div className="px-4 pt-4 pb-2 flex justify-between items-center bg-transparent">
              <span className="text-[11px] font-mono tracking-wider uppercase text-zinc-400 font-medium flex-1">Sources ({sources.length})</span>
              <button 
                onClick={() => setIsAddSourceModalOpen(true)}
                className="p-1 hover:bg-[#1a1a1c] rounded-md cursor-pointer transition-all text-[#a1a1aa] hover:text-[#f4f4f5]"
                title="Add manual source"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of current sources with dynamically resolved favicon */}
            {sources.length === 0 ? (
              <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                <Globe className="w-6 h-6 text-zinc-600 mb-2" />
                <span className="text-[11px] text-zinc-500">No linked research sources yet.</span>
              </div>
            ) : (
              <div className="divide-y divide-[#1c1c1e] max-h-[360px] overflow-y-auto">
                {sources.map((src) => {
                  let host = 'link';
                  try {
                    host = new URL(src.url).hostname;
                  } catch (_) {}
                  const iconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;

                  return (
                    <div 
                      key={src.id}
                      className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#131315] transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img 
                          src={iconUrl} 
                          alt="" 
                          className="w-4 h-4 rounded shrink-0 bg-zinc-800"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-zinc-200 truncate leading-tight">{src.title}</div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">{host}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0 opacity-85 group-hover:opacity-100">
                        <a 
                          href={src.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition-all cursor-pointer"
                          title="Open URL in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button 
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-all cursor-pointer"
                          title="Delete reference"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: QUIZZES */}
        {activeSubTab === 'quizzes' && (
          <div className="flex flex-col flex-1">
            
            {/* Generate State or loading */}
            {quizData === null ? (
              <div className="text-center py-8 px-4 flex flex-col items-center">
                <img 
                  src="/quiz.png" 
                  alt="Quiz illustration" 
                  className="w-48 h-48 object-contain mb-8 select-none" 
                  referrerPolicy="no-referrer" 
                />
                <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed mb-6">
                  Cosmi will read this document to decide if quizzes are applicable, then outline an interactive 10-question scholastic test.
                </p>

                {quizError && (
                  <div className="mb-4 mx-4 p-2.5 rounded-lg bg-red-950/10 border border-red-900/20 text-red-400 text-[10.5px] flex items-start gap-2 text-left">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                    <span>{quizError}</span>
                  </div>
                )}

                {isGeneratingQuiz ? (
                  <div className="space-y-2 py-1">
                    <div className="flex items-center justify-center gap-2 text-xs text-purple-400 font-semibold">
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      Cosmi reading document...
                    </div>
                    <span className="text-[10px] text-zinc-600 block">Determining applicability and styling key insights...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full px-6">
                    <button 
                      onClick={handleGenerateQuiz}
                      className="w-full py-2 rounded-xl bg-zinc-200 hover:bg-white text-zinc-950 font-bold text-xs transition-all cursor-pointer shadow-sm"
                    >
                      Draft comprehension quiz
                    </button>
                    <button 
                      onClick={loadFallbackQuiz}
                      className="w-full py-1.5 rounded-lg bg-[#18181b] border border-zinc-800 text-zinc-400 hover:text-white font-medium text-[10.5px] transition-colors cursor-pointer"
                    >
                      Load standard drafting check
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Quiz content is loaded
              <div className="flex flex-col flex-1">
                
                {/* 1. If AI evaluated the document as Unsuitable */}
                {!quizData.isQuizApplicable ? (
                  <div className="p-4 bg-[#1a1313]/50 border-b border-red-950/40 space-y-3 text-xs">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-zinc-100">Quiz not appropriate</div>
                        <div className="text-[11px] text-zinc-400 leading-relaxed">
                          {quizData.applicabilityReason || "The text lacks sufficient concepts, data, or size to perform challenging multiple-choice verification."}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <button 
                        onClick={loadFallbackQuiz}
                        className="w-full py-1.5 text-center text-xs bg-zinc-200 hover:bg-white text-zinc-950 rounded-lg font-bold cursor-pointer transition-all"
                      >
                        Try Standard Comprehension Quiz Instead
                      </button>
                      <button 
                        onClick={() => setQuizData(null)}
                        className="w-full text-center text-[10.5px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors font-medium cursor-pointer"
                      >
                        Reset Check
                      </button>
                    </div>
                  </div>
                ) : (
                  // Active Interactive quiz view (Edge-to-edge, border-free buttons)
                  <div className="flex flex-col flex-1">
                    
                    {/* Header score / progress */}
                    <div className="flex justify-between items-center text-[10.5px] font-mono text-zinc-500 px-4 py-3 bg-[#0c0c0d]">
                      <span>Comprehension Check</span>
                      <span>
                        {quizFinished ? 'Assessment completed' : `Question ${currentQuestionIndex + 1} of ${quizData.questions?.length}`}
                      </span>
                    </div>

                    {!quizFinished ? (
                      <div className="flex flex-col flex-1">
                        {/* Question text */}
                        <div className="text-zinc-200 font-bold leading-relaxed text-[12.5px] p-4 bg-[#0c0c0d]">
                          {quizData.questions?.[currentQuestionIndex]?.question}
                        </div>

                        {/* Options buttons - border-free, edge-to-edge list */}
                        <div className="flex flex-col">
                          {quizData.questions?.[currentQuestionIndex]?.options.map((opt, oIdx) => {
                            const isSelected = quizHistory[currentQuestionIndex] === oIdx;
                            const isRevealed = selectedOptionIndex !== null;
                            const isCorrect = oIdx === quizData.questions?.[currentQuestionIndex]?.correctAnswerIndex;

                            let optStyle = "text-zinc-400 hover:bg-[#131315]/60 bg-transparent";
                            
                            if (isRevealed) {
                              if (isCorrect) {
                                // Correct option
                                optStyle = "bg-emerald-950/20 text-emerald-400 font-medium";
                              } else if (isSelected) {
                                // Wrong selected option
                                optStyle = "bg-red-950/20 text-red-400";
                              } else {
                                // Other options
                                optStyle = "opacity-45 bg-transparent text-zinc-600";
                              }
                            } else {
                              if (isSelected) {
                                optStyle = "bg-zinc-800/30 text-white font-medium";
                              }
                            }

                            return (
                              <button
                                key={oIdx}
                                onClick={() => handleSelectOption(oIdx)}
                                disabled={isRevealed}
                                className={`w-full text-left px-4 py-3.5 text-[12px] leading-relaxed transition-all cursor-pointer flex items-start gap-3 ${optStyle}`}
                              >
                                <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${
                                  isRevealed && isCorrect ? 'bg-emerald-900/30 border border-emerald-800/30 text-emerald-400' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                                } shrink-0`}>
                                  {['A', 'B', 'C', 'D'][oIdx]}
                                </span>
                                <span className="flex-1">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Next question and confirmation guidance */}
                        {selectedOptionIndex !== null && (
                          <div className="p-4 animate-fade-in flex flex-col gap-3 bg-[#0c0c0d]">
                            <div className="text-[10.5px] text-zinc-400 bg-transparent p-0 flex items-start gap-1.5 leading-relaxed">
                              {selectedOptionIndex === quizData.questions?.[currentQuestionIndex]?.correctAnswerIndex ? (
                                <span className="text-emerald-400 font-bold shrink-0">✓ Correct!</span>
                               ) : (
                                <span className="text-red-400 font-bold shrink-0">✗ Incorrect.</span>
                              )}
                              <span>The scholastic keys cite Option {['A', 'B', 'C', 'D'][quizData.questions?.[currentQuestionIndex]?.correctAnswerIndex || 0]} as correct.</span>
                            </div>
                            
                            <button
                              onClick={handleNextQuestion}
                              className="w-full py-2 hover:bg-zinc-200 bg-white text-zinc-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              {currentQuestionIndex + 1 < (quizData.questions?.length || 0) ? "Next Question" : "View Final Score"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Quiz scoring card results screen
                      <div className="text-center py-8 p-4 space-y-5">
                        <div className="w-14 h-14 bg-purple-950/20 border border-purple-800/20 rounded-full flex items-center justify-center mx-auto text-purple-400">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-zinc-200">Session Complete</h4>
                          <span className="text-[11px] text-zinc-500 block">Assessment analysis completed</span>
                        </div>

                        <div className="grid place-items-center">
                          <div className="inline-block px-5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                            <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Your Score</div>
                            <div className="text-2xl font-bold text-white mt-1">
                              {quizScore} <span className="text-xs text-zinc-500">/ {quizData.questions?.length}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-[11.5px] text-zinc-400 leading-relaxed px-4">
                          {quizScore === quizData.questions?.length ? (
                            "Outstanding comprehension! You've mastered all key details documented across this reference."
                          ) : quizScore >= (quizData.questions?.length || 0) / 2 ? (
                            "Good progress! We suggest reviewing the details block to reinforce elements you might have missed."
                          ) : (
                            "Let's try that check again. Keeping structured draft notes makes testing key elements a breeze!"
                          )}
                        </p>

                        <div className="pt-2 px-4 flex flex-col gap-2">
                          <button
                            onClick={handleRetakeQuiz}
                            className="w-full py-1.5 text-xs font-bold bg-[#1d1d20] hover:bg-[#28282b] text-[#f4f4f5] border border-[#2d2d30] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restart comprehension quiz
                          </button>
                          
                          <button
                            onClick={() => setQuizData(null)}
                            className="w-full py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                          >
                            Generate new questions
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* TAB 5: ATTACHMENTS */}
        {activeSubTab === 'attachments' && (
          <div className="flex-1 flex flex-col p-4 bg-transparent text-[13px] h-full min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="text-[11px] font-mono tracking-wider uppercase text-zinc-400 font-medium">Linked Attachments ({attachments.length})</span>
              <label 
                className={`p-1.5 hover:bg-[#1a1a1c] border border-zinc-800 rounded-lg cursor-pointer transition-all text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center justify-center ${isUploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}
                title="Attach other file"
              >
                <input 
                  type="file" 
                  onChange={handleAttachmentUpload} 
                  className="hidden" 
                  disabled={isUploadingAttachment}
                />
                <Paperclip className="w-3.5 h-3.5" />
              </label>
            </div>

            {attachmentError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-[11px] flex items-start gap-2 text-left shrink-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                <span>{attachmentError}</span>
              </div>
            )}

            {isUploadingAttachment && (
              <div className="mb-4 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-zinc-400 text-xs flex items-center gap-3 shrink-0">
                <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-medium animate-pulse">Uploading attachment...</span>
              </div>
            )}

            {attachments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center select-none">
                <Paperclip className="w-6 h-6 text-zinc-600 mb-2" />
                <span className="text-[11px] text-zinc-500 max-w-[200px] leading-relaxed">
                  No attachments yet. Link audio recordings, images, templates, or spreadsheets.
                </span>
                <label className="mt-4 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg cursor-pointer transition-colors font-semibold">
                  <input 
                    type="file" 
                    onChange={handleAttachmentUpload} 
                    className="hidden" 
                    disabled={isUploadingAttachment}
                  />
                  Select File
                </label>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-10 scrollbar-thin scrollbar-thumb-zinc-800">
                {attachments.map((att) => {
                  const isAudio = att.mimetype.startsWith('audio/') || 
                                  att.name.toLowerCase().endsWith('.mp3') || 
                                  att.name.toLowerCase().endsWith('.wav') || 
                                  att.name.toLowerCase().endsWith('.m4a');
                  const isImage = att.mimetype.startsWith('image/');

                  return (
                    <div 
                      key={att.id} 
                      className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl flex flex-col gap-2 group hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1 px-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                            {isAudio ? (
                              <Music className="w-3.5 h-3.5" />
                            ) : isImage ? (
                              <ImageIcon className="w-3.5 h-3.5" />
                            ) : (
                              <File className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[12px] font-medium text-zinc-200 truncate leading-tight" title={att.name}>
                              {att.name}
                            </span>
                            <span className="block text-[9px] text-[#71717a] font-mono mt-0.5 uppercase tracking-wider">
                              {att.mimetype.split('/')[1] || 'FILE'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <a 
                            href={`/api/files/${att.id}`}
                            download={att.name}
                            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                            title="Download reference"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button 
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                            title="Delete attachment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Display players/previews dynamically */}
                      {isAudio && (
                        <div className="pt-2 border-t border-zinc-900/40">
                          <AudioVisualizerPlayer src={`/api/files/${att.id}`} />
                        </div>
                      )}

                      {isImage && (
                        <div className="mt-1 relative rounded-lg overflow-hidden max-h-36 border border-zinc-900 flex justify-center bg-zinc-950">
                          <img 
                            src={`/api/files/${att.id}`} 
                            alt={att.name} 
                            className="max-w-full max-h-32 object-contain rounded pointer-events-none" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal for adding source reference */}
      {isAddSourceModalOpen && (
        <div className="absolute inset-0 bg-[#070708]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl w-full max-w-[300px] p-4 flex flex-col gap-4 shadow-xl select-none animate-fade-in relative z-50">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#f4f4f5]">Add New Source</span>
              <button 
                type="button"
                onClick={() => {
                  setIsAddSourceModalOpen(false);
                  setNewSourceName('');
                  setNewSourceUrl('');
                  setSourceError('');
                }}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSource} className="space-y-3">
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block mb-1">Website Name</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-sans bg-[#1c1c1e] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600"
                    placeholder="e.g. PubMed, Wikipedia"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block mb-1">Reference URL</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-sans bg-[#1c1c1e] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600"
                    placeholder="e.g. wikipedia.org"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    required
                  />
                </div>
              </div>

              {sourceError && (
                <div className="text-[10.5px] text-red-400 font-medium flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 p-2 rounded-lg">
                  <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                  <span>{sourceError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddSourceModalOpen(false);
                    setNewSourceName('');
                    setNewSourceUrl('');
                    setSourceError('');
                  }}
                  className="flex-1 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-1.5 rounded-lg bg-zinc-200 hover:bg-white text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
