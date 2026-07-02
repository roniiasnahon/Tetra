import { linkifyHtml, renderLinkifiedText, parseAssistantResponse, extractTextFromPdf, cleanJsonLeakFront, PDF_CACHE_NAME, preCachePdfFile, getOrCreateCachedPdf, formatAbstractText } from './app-utils';
import { DocumentToolbar } from "./components/DocumentToolbar";
import { TRANSLATIONS } from './translations';
import { openUrl } from "@tauri-apps/plugin-opener";
import React, { useState, useEffect, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { marked, Marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import { MainChat, modelsList } from "./components/MainChat";
import { TypewriterMarkdown, preprocessLaTeX } from "./components/TypewriterMarkdown";
import { DynamicShimmer } from "./components/DynamicShimmer";
import { HomePanel } from "./components/HomePanel";
import { LibraryPanel } from "./components/LibraryPanel";
import { ChatPanel } from "./components/ChatPanel";
import { SidebarPanel } from "./components/SidebarPanel";
import { ModalManager } from "./components/ModalManager";
import { ChartModal } from "./components/ChartModal";
import { DocumentEditor } from "./components/DocumentEditor";
import { UploadsManager, UploadTask } from "./components/UploadsManager";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "./components/SolarIcon";
import { MaterialIcon } from "./components/MaterialIcon";
import { Sidebar, Plain2, PaperclipRounded2, Notes, FolderWithFiles, PenNewRound, FolderOpen, MinimalisticMagnifier, MenuDots, UploadMinimalistic, AddFolder, AddCircle, PaletteRound, NotebookBookmark, SidebarMinimalistic, HandStars, Mug } from "@solar-icons/react";
import { Plus, X as XIcon, Minus, Square, HelpCircle } from "lucide-react";
import html2pdf from "html2pdf.js";
import { getUserFriendlyErrorMessage } from "./lib/error-utils";

interface ShimProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  fill?: boolean;
  size?: number;
}

const mapLucideToMaterialSize = (className: string = '', size?: number) => {
  if (size !== undefined) {
    return `text-[${size}px] ${className}`;
  }
  let sizeClass = 'text-[18px]'; // default size replacing w-4 h-4
  if (className.includes('w-3.5') || className.includes('h-3.5')) {
    sizeClass = 'text-[15px]';
  } else if (className.includes('w-3') || className.includes('h-3')) {
    sizeClass = 'text-[13px]';
  } else if (className.includes('w-5') || className.includes('h-5')) {
    sizeClass = 'text-[20px]';
  } else if (className.includes('w-6') || className.includes('h-6')) {
    sizeClass = 'text-[24px]';
  } else if (className.includes('w-8') || className.includes('h-8')) {
    sizeClass = 'text-[32px]';
  }
  return `${sizeClass} ${className}`;
};

const makeIcon = (name: string, fillDefault = false) => {
  return ({ className = '', fill = fillDefault, size, ...props }: ShimProps) => (
    <MaterialIcon
      name={name}
      fill={fill}
      className={mapLucideToMaterialSize(className, size)}
      {...props}
    />
  );
};

const Edit2 = makeIcon('edit');
const ExternalLink = makeIcon('open_in_new');
const Unlink = makeIcon('link_off');
const LinkIcon = makeIcon('link');

const X = makeIcon('close');
import { StatisticsTools } from "./components/StatisticsTools";
import { SidePanel } from "./components/SidePanel";
import { Settings } from "./components/Settings";
import { AuthenticationScreen } from "./components/AuthenticationScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { DesktopAuthBridge } from "./components/DesktopAuthBridge";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ToastContainer, showToast } from "./components/Toast";

// Firebase imports
import {
  auth,
  db,
  OperationType,
  handleFirestoreError,
  signInWithPopup,
  googleProvider,
  signOut,
} from "./firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocFromServer,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

export interface PaperItem {
  author: string;
  title: string;
  description: string;
  url?: string;
  added?: string;
  fullTextStatus?: string;
  viewed?: string;
  fileType?: string;
  summary?: string;
  fileId?: string;
  mimetype?: string;
  extractedText?: string;
  folderId?: string;
  notes?: string;
}

export interface Tab {
  id: string;
  type: "home" | "document" | "library" | "chat" | "tools" | "settings";
  title: string;
  originalTitle?: string;
  content?: string;
  fileId?: string;
  mimetype?: string;
  messages?: ChatMessage[];
  folderId?: string;
  chatInput?: string;
  undoStack?: string[];
  redoStack?: string[];
  starred?: boolean;
  updatedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
  timestamp: number;
  isHidden?: boolean;
  attachment?: {
    fileId: string;
    fileName: string;
    mimetype: string;
    url: string;
  };
  groundingMetadata?: any;
}



export default function App() {
  const [appLanguage, setAppLanguage] = useState<"en" | "fr" | "es" | "de" | "it" | "pt" | "ar" | "zh" | "ja" | "hi">(() => {
    return (localStorage.getItem("cosmi_language") as any) || "en";
  });

  const t = (key: keyof typeof TRANSLATIONS["en"]) => {
    return TRANSLATIONS[appLanguage]?.[key] || TRANSLATIONS["en"][key];
  };

  const getUniqueTabs = (tabList: Tab[]) => {
    const seen = new Set<string>();
    return tabList.filter((t) => {
      if (!t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  };

  const getUniqueChats = (chatList: Tab[]) => {
    const seen = new Set<string>();
    return chatList.filter((c) => {
      if (!c.id) return false;
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  };

  const getUniqueFolders = (folderList: FolderItem[]) => {
    const seen = new Set<string>();
    return folderList.filter((f) => {
      if (!f.id) return false;
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  };

  const getUniquePapers = (paperList: PaperItem[]) => {
    const seen = new Set<string>();
    return paperList.filter((p) => {
      const id = p.fileId || p.title;
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const isReadOnly = false;
  const isElectronApp = typeof window !== 'undefined' && (
    (window as any).electron !== undefined || 
    navigator.userAgent.toLowerCase().includes('electron') ||
    (window as any).ipcRenderer !== undefined ||
    (window as any).process?.versions?.electron !== undefined
  );
  const isDesktopApp = isElectronApp || (typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined);
  const cleanTitleStr = (t?: string) =>
    t ? t.replace(/[*#]/g, "").trim() : "";

  const translateDynamicTitle = (title?: string) => {
    if (!title) return t("untitled");
    const trimmed = title.trim();
    if (trimmed === "Untitled") return t("untitled");
    if (trimmed === "Untitled Document") return t("untitled");
    if (trimmed === "Untitled Folder") return t("untitledFolder");
    if (trimmed === "New Folder") return t("newFolder");
    if (trimmed === "New Chat") return t("newChat");
    if (trimmed === "Library") return t("library");
    if (trimmed === "Home") return t("home");
    if (trimmed === "Statistics Tools" || trimmed === "Tools") return t("tools");
    return cleanTitleStr(title);
  };

  const handleMinimize = () => {
    if ((window as any).__TAURI__) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().minimize();
      }).catch(console.error);
    } else {
      (window as any).electron?.minimize?.();
    }
  };

  const handleMaximize = () => {
    if ((window as any).__TAURI__) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().toggleMaximize();
      }).catch(console.error);
    } else {
      (window as any).electron?.maximize?.();
    }
  };

  const handleCloseApp = () => {
    if ((window as any).__TAURI__) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().close();
      }).catch((err) => {
        console.error(err);
        (window as any).electron?.close?.();
      });
    } else {
      (window as any).electron?.close?.();
    }
  };

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isUploadsPanelOpen, setIsUploadsPanelOpen] = useState(true);
  const [isUploadsPanelCollapsed, setIsUploadsPanelCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const [showBuyCoffeeModal, setShowBuyCoffeeModal] = useState(false);
  const [supportAmountPaid, setSupportAmountPaid] = useState<string | null>(
    null,
  );
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<
    "files" | "chats" | "tools" | "library"
  >("files");

  const [activeToolsTab, setActiveToolsTab] = useState<
    "slovin" | "percentage" | "weighted" | "likert" | "ai" | "citation"
  >("slovin");
  const [isStatsSectionOpen, setIsStatsSectionOpen] = useState(true);
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);

  const openToolsTab = (
    toolType:
      | "slovin"
      | "percentage"
      | "weighted"
      | "likert"
      | "ai"
      | "citation",
  ) => {
    setActiveToolsTab(toolType);
    const toolsTab = tabs.find((t) => t.type === "tools");
    if (!toolsTab) {
      const newId = `tools-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        { id: newId, type: "tools", title: "Statistics Tools" },
      ]);
      setActiveTabId(newId);
    } else {
      setActiveTabId(toolsTab.id);
    }
  };

  const [toolsHistory, setToolsHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("toolsHistory");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedToolsHistoryItem, setSelectedToolsHistoryItem] = useState<
    any | null
  >(null);

  const addToolsHistoryItem = (item: any) => {
    const newItem = {
      ...item,
      id: `tool-hist-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    setToolsHistory((prev) => {
      // Avoid duplicate computations with active parameters
      const filtered = prev.filter(
        (p) =>
          !(
            p.type === item.type &&
            JSON.stringify(p.parameters) === JSON.stringify(item.parameters)
          ),
      );
      const updated = [newItem, ...filtered].slice(0, 30);
      try {
        localStorage.setItem("toolsHistory", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save tools history to localStorage:", e);
      }
      return updated;
    });
  };

  const deleteToolsHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setToolsHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem("toolsHistory", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to update tools history in localStorage:", err);
      }
      return updated;
    });
    if (selectedToolsHistoryItem?.id === id) {
      setSelectedToolsHistoryItem(null);
    }
  };

  const loadToolsHistoryItem = (item: any) => {
    setSelectedToolsHistoryItem(item);
    setActiveToolsTab(item.type);

    // Select the active tools tab or insert a new tab of type tools
    const toolsTab = tabs.find((t) => t.type === "tools");
    if (!toolsTab) {
      const newId = `tools-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        { id: newId, type: "tools", title: "Statistics Tools" },
      ]);
      setActiveTabId(newId);
    } else {
      setActiveTabId(toolsTab.id);
    }
    setSidebarView("tools");
  };

  // Tab Management
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_tabs_${uid}`);
      return cached
        ? JSON.parse(cached)
        : [{ id: "initial-home", type: "home", title: "Home" }];
    } catch {
      return [{ id: "initial-home", type: "home", title: "Home" }];
    }
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_activeTabId_${uid}`);
      return cached || "initial-home";
    } catch {
      return "initial-home";
    }
  });
  const [activeAssistantTabId, setActiveAssistantTabId] = useState<
    string | null
  >(null);
  const ignoreNextTabSyncRef = useRef<string | null>(null);
  const loadedTabIdRef = useRef<string>("initial-home");
  const activeTabIdRef = useRef(activeTabId);
  const activeAssistantTabIdRef = useRef(activeAssistantTabId);
  const tabsRef = useRef(tabs);
  const activeTab = React.useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId],
  );

  const onTabUpdate = React.useCallback((tabId: string, updatedFields: Partial<Tab>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, ...updatedFields } : t))
    );
  }, []);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    activeAssistantTabIdRef.current = activeAssistantTabId;
  }, [activeAssistantTabId]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const [appearanceTheme, setAppearanceTheme] = useState<string>(() => {
    return localStorage.getItem("cosmi_settings_appearance") || "dark";
  });

  useEffect(() => {
    const isLight = appearanceTheme === "light" || 
      (appearanceTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
    
    if (isLight) {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
    localStorage.setItem("cosmi_settings_appearance", appearanceTheme);
    localStorage.setItem("cosmi_light_mode", isLight.toString());
  }, [appearanceTheme]);

  // Editor Styles and Customizations
  const [editorFont, setEditorFont] = useState("font-jakarta");
  const [editorFontSize, setEditorFontSize] = useState(18);
  const [currentSelectionSize, setCurrentSelectionSize] = useState(18);
  const [editorAlign, setEditorAlign] = useState<
    "left" | "center" | "right" | "justify"
  >("left");
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableGrid, setTableGrid] = useState({ r: 0, c: 0 });
  
  // Chart creation modal state
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartTitle, setChartTitle] = useState("");
  const [chartDataColor, setChartDataColor] = useState<string>("blue");
  const [chartLabels, setChartLabels] = useState<string[]>(["Group A", "Group B", "Group C", "Group D"]);
  const [chartValues, setChartValues] = useState<number[]>([45, 60, 30, 50]);
  const [chartIndividualColors, setChartIndividualColors] = useState<string[]>([]);
  const [openRowColorPickerIdx, setOpenRowColorPickerIdx] = useState<number | null>(null);
  const [chartBeingEdited, setChartBeingEdited] = useState<HTMLElement | null>(null);

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);

  // Tab deletion confirmation modal state
  const [tabIdToDelete, setTabIdToDelete] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Chat deletion confirmation modal state
  const [chatIdToDelete, setChatIdToDelete] = useState<string | null>(null);
  const [isDeleteSelectionConfirmOpen, setIsDeleteSelectionConfirmOpen] = useState(false);

  // Desktop app exit confirmation modal state
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

  // Tab drag-and-drop state
  const dragStartIndexRef = useRef<number | null>(null);

  // Link and Table context menu and rename modal state
  const [linkContextMenu, setLinkContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLAnchorElement;
  } | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLTableElement;
    cell: HTMLTableCellElement | null;
  } | null>(null);
  const [chartContextMenu, setChartContextMenu] = useState<{
    x: number;
    y: number;
    target: HTMLElement;
  } | null>(null);
  const [showLinkRenameModal, setShowLinkRenameModal] = useState(false);
  const [linkToRename, setLinkToRename] = useState<{
    target: HTMLAnchorElement;
    initialText: string;
    initialUrl: string;
  } | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameUrl, setRenameUrl] = useState("");

  // Library folders and files drag-and-drop state
  const draggedLibraryItemRef = useRef<{ type: "paper" | "folder"; id: string; title?: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRootLibrary, setDragOverRootLibrary] = useState(false);

  const handleLibraryDragStart = (e: React.DragEvent, type: "paper" | "folder", id: string, title?: string) => {
    draggedLibraryItemRef.current = { type, id, title };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleLibraryDragOverFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setDragOverFolderId(folderId);
      return;
    }
    if (!draggedLibraryItemRef.current) return;
    if (draggedLibraryItemRef.current.type === "paper") {
      setDragOverFolderId(folderId);
    } else if (draggedLibraryItemRef.current.type === "folder" && draggedLibraryItemRef.current.id !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleLibraryDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);

    // Support physical operating system files drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (targetFolderId) {
        setSelectedFolderId(targetFolderId);
      }
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await handleUploadFile(file);
      }
      return;
    }

    const dragged = draggedLibraryItemRef.current;
    if (!dragged) return;

    if (dragged.type === "paper") {
      const paperTitle = dragged.title;
      const paper = papers.find((p) => p.title === paperTitle);
      if (paper && paper.folderId !== targetFolderId) {
        dbSetPaper({
          ...paper,
          folderId: targetFolderId,
        });
      }
    } else if (dragged.type === "folder") {
      const draggedFolderId = dragged.id;
      if (draggedFolderId === targetFolderId) return;
      const startIndex = folders.findIndex((f) => f.id === draggedFolderId);
      const hoverIndex = folders.findIndex((f) => f.id === targetFolderId);
      if (startIndex !== -1 && hoverIndex !== -1) {
        const updated = [...folders];
        const [movedFolder] = updated.splice(startIndex, 1);
        updated.splice(hoverIndex, 0, movedFolder);
        setFolders(updated);
      }
    }
    draggedLibraryItemRef.current = null;
  };

  const handleLibraryDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setDragOverRootLibrary(true);
      return;
    }
    if (draggedLibraryItemRef.current && draggedLibraryItemRef.current.type === "paper") {
      setDragOverRootLibrary(true);
    }
  };

  const handleLibraryDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRootLibrary(false);

    // Support physical operating system files drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFolderId("");
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await handleUploadFile(file);
      }
      return;
    }

    const dragged = draggedLibraryItemRef.current;
    if (dragged && dragged.type === "paper") {
      const paper = papers.find((p) => p.title === dragged.title);
      if (paper && paper.folderId) {
        dbSetPaper({
          ...paper,
          folderId: "",
        });
      }
    }
    draggedLibraryItemRef.current = null;
  };

  // Library toolbar and interaction states
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const [displayDensity, setDisplayDensity] = useState<
    "comfortable" | "compact"
  >("comfortable");
  const [sortBy, setSortBy] = useState<"title" | "added" | "viewed">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isDisplayDropdownOpen, setIsDisplayDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isHomeCreateDropdownOpen, setIsHomeCreateDropdownOpen] =
    useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isChatDropdownOpen, setIsChatDropdownOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isRenamingChat, setIsRenamingChat] = useState<string | null>(null);
  const [renamingChatText, setRenamingChatText] = useState("");

  const handleRenameChat = (e: React.KeyboardEvent | React.FocusEvent) => {
    if ("key" in e && e.key !== "Enter" && e.key !== "Escape") return;

    if (isRenamingChat) {
      if (!("key" in e) || e.key === "Enter") {
        const newTitle = renamingChatText.trim() || "Untitled";
        setTabs(
          tabs.map((t) =>
            t.id === isRenamingChat ? { ...t, title: newTitle } : t,
          ),
        );
        showToast(`Chat renamed to "${newTitle}"`, "success");
      }
      setIsRenamingChat(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragStartIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, hoverIndex: number) => {
    e.preventDefault();
    if (dragStartIndexRef.current === null || dragStartIndexRef.current === hoverIndex) {
      return;
    }

    const startIndex = dragStartIndexRef.current;
    
    // Reorder tabs array
    setTabs((prevTabs) => {
      const updated = [...prevTabs];
      const [draggedItem] = updated.splice(startIndex, 1);
      updated.splice(hoverIndex, 0, draggedItem);
      // Update drag index ref to the current hover index since it moved
      dragStartIndexRef.current = hoverIndex;
      return updated;
    });
  };

  const handleDragEnd = () => {
    dragStartIndexRef.current = null;
  };

  const closeTab = React.useCallback((id: string) => {
    const closedTab = tabs.find((t) => t.id === id);
    const closedTitle = closedTab ? closedTab.title : "Tab";

    if (tabs.length <= 1 && tabs[0].id === id) {
      const newId = `chat-${Date.now()}`;
      setTabs([{ id: newId, type: "chat", title: "Untitled" }]);
      setActiveTabId(newId);
      setActiveAssistantTabId(newId);
      setMessages([]);
    } else {
      const updatedTabs = tabs.filter((t) => t.id !== id);
      const tabToDeleteIndex = tabs.findIndex((t) => t.id === id);
      setTabs(updatedTabs);

      if (activeTabId === id) {
        const nextTab =
          updatedTabs[tabToDeleteIndex] ||
          updatedTabs[tabToDeleteIndex - 1] ||
          updatedTabs[0];
        setActiveTabId(nextTab.id);
      }

      if (activeAssistantTabId === id) {
        const nextAssistantTab = updatedTabs.find((t) => t.type === "chat");
        if (nextAssistantTab) {
          setActiveAssistantTabId(nextAssistantTab.id);
          setMessages(nextAssistantTab.messages || []);
        } else {
          setActiveAssistantTabId(null);
          setMessages([]);
        }
      }
    }

    showToast(`Closed "${closedTitle}"`, "info");
    setIsChatMenuOpen(false);
    setIsAssistantChatDropdownOpen(false);
  }, [tabs, activeTabId, activeAssistantTabId]);

  const requestDeleteTab = React.useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isDesktopApp) {
      setTabIdToDelete(id);
      setIsDeleteConfirmOpen(true);
    } else {
      closeTab(id);
    }
  }, [isDesktopApp, closeTab]);

  const deleteChatPermanently = async (id: string) => {
    // If the chat is currently open as a tab, close it first
    if (tabs.some((t) => t.id === id)) {
      closeTab(id);
    }

    const uid = currentUser ? currentUser.uid : "guest";
    if (currentUser && storageMode === "database") {
      const path = `users/${currentUser.uid}/chats/${id}`;
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "chats", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      setAllChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        localStorage.setItem(`cosmi_chats_${uid}`, JSON.stringify(next));
        return next;
      });
    }
    showToast("Chat deleted permanently", "info");
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // 1. Tab Switching: Ctrl+1 to Ctrl+9 or Cmd+1 to Cmd+9
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        // e.key could be "1"-"9"
        const keyNum = parseInt(e.key, 10);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
          const tabIndex = keyNum - 1;
          if (tabIndex < tabs.length) {
            e.preventDefault();
            setActiveTabId(tabs[tabIndex].id);
          }
        }
      }

      // 2. Alt+F4 for closing notice on Desktop
      if (e.altKey && e.key === "F4" && isDesktopApp) {
        e.preventDefault();
        setIsExitConfirmOpen(true);
      }

      // 3. Ctrl+W or Cmd+W to close current tab on Desktop
      if ((e.ctrlKey || e.metaKey) && (e.key === "w" || e.key === "W") && isDesktopApp) {
        e.preventDefault();
        if (activeTabId) {
          requestDeleteTab(activeTabId);
        }
      }

      // 4. Ctrl+P or Cmd+P to toggle side panel in document tabs
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        const currentTab = tabs.find((t) => t.id === activeTabId);
        if (currentTab?.type === "document") {
          e.preventDefault();
          setIsSidePanelOpen((prev) => !prev);
        }
      }

      // 5. Ctrl+T or Cmd+T to add a new tab
      if ((e.ctrlKey || e.metaKey) && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("request-new-chat"));
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [tabs, activeTabId, isDesktopApp, requestDeleteTab]);

  const [isAssistantChatDropdownOpen, setIsAssistantChatDropdownOpen] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [pdfViewMode, setPdfViewMode] = useState<Record<string, "pdf" | "overview">>({});
  const [activePdfBlobUrl, setActivePdfBlobUrl] = useState<string | null>(null);
  const [isBlobLoading, setIsBlobLoading] = useState<boolean>(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedLinkType, setGeneratedLinkType] = useState<
    "workspace" | "library" | null
  >(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [addDropdownNested, setAddDropdownNested] = useState<string | null>(
    null,
  );
  const [newPaperTitle, setNewPaperTitle] = useState("");
  const [newPaperAuthors, setNewPaperAuthors] = useState("");
  const [newPaperType, setNewPaperType] = useState<"Note" | "Document">(
    "Document",
  );
  const [newPaperDescription, setNewPaperDescription] = useState("");

  // Link summarizer states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [importType, setImportType] = useState<
    "url" | "gdoc" | "youtube" | null
  >(null);
  const [importUrl, setImportUrl] = useState("");
  const [isAnalyzingLink, setIsAnalyzingLink] = useState(false);
  const [linkAnalyzeStatus, setLinkAnalyzeStatus] = useState("");
  const [linkAnalyzeError, setLinkAnalyzeError] = useState("");
  const [activeViewingPaper, setActiveViewingPaper] =
    useState<PaperItem | null>(null);

  const handleLinkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setIsAnalyzingLink(true);
    setLinkAnalyzeError("");
    setLinkAnalyzeStatus("Locating source address and resolving hostname...");

    const step1 = setTimeout(() => {
      setLinkAnalyzeStatus(
        "Fetching public content and stripping raw templates...",
      );
    }, 1500);

    const step2 = setTimeout(() => {
      setLinkAnalyzeStatus(
        "Sending text stream to Gemini API for literature review synthesis...",
      );
    }, 4500);

    try {
      const response = await fetch("/api/research/summarize-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl, type: importType }),
      });

      clearTimeout(step1);
      clearTimeout(step2);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze that URL.");
      }

      const resData = await response.json();
      if (resData.success && resData.data) {
        const withFolder = {
          ...resData.data,
          folderId: selectedFolderId || folders[0]?.id || "f1",
        };
        dbSetPaper(withFolder);
        setImportModalOpen(false);
        setImportUrl("");
        setLinkAnalyzeStatus("");
        setActiveViewingPaper(withFolder);

        // Auto-create and switch to a new document tab with the synthesized content
        const newTabId = `link-${Date.now()}`;
        const initialContent = markdownToHtml(
          resData.data.summary || resData.data.description || "",
        );
        setTabs((prev) => [
          ...prev,
          {
            id: newTabId,
            type: "document",
            title: resData.data.title,
            content: initialContent,
          },
        ]);
        setActiveTabId(newTabId);
      } else {
        throw new Error(
          "Link parsing completed, but returned empty synthesis data.",
        );
      }
    } catch (err: any) {
      console.error(err);
      clearTimeout(step1);
      clearTimeout(step2);
      setLinkAnalyzeError(
        err.message ||
          "An unexpected failure occurred while analyzing this link.",
      );
    } finally {
      setIsAnalyzingLink(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setLinkContextMenu(null);
      setTableContextMenu(null);
      setPdfContextMenu(null);
      setIsCreateDropdownOpen(false);
      setIsHomeCreateDropdownOpen(false);
      setIsDisplayDropdownOpen(false);
      setIsSortDropdownOpen(false);
      setIsFilterDropdownOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (activeTab && activeTab.fileId && activeTab.mimetype === "application/pdf") {
      setIsBlobLoading(true);
      getOrCreateCachedPdf(activeTab.fileId)
        .then((blobUrl) => {
          if (active) {
            setActivePdfBlobUrl(blobUrl);
            setIsBlobLoading(false);
          }
        })
        .catch((err) => {
          console.error("Local caching PDF load error:", err);
          if (active) {
            setActivePdfBlobUrl(`/api/files/${activeTab.fileId}`);
            setIsBlobLoading(false);
          }
        });
    } else {
      setActivePdfBlobUrl(null);
      setIsBlobLoading(false);
    }
    return () => {
      active = false;
    };
  }, [activeTab?.fileId, activeTab?.mimetype]);

  const editorRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef("");
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const savedSelectionRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
          savedSelectionRangeRef.current = range.cloneRange();
        }

        if (!selection.isCollapsed) {
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
      }
      setCurrentSelectionSize(editorFontSize);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [editorFontSize]);

  const changeSelectedFontSize = (increase: boolean) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    if (selection.isCollapsed) {
      const next = increase ? editorFontSize + 1 : editorFontSize - 1;
      const clamped = Math.min(72, Math.max(12, next));
      setEditorFontSize(clamped);
      setCurrentSelectionSize(clamped);
      return;
    }

    const currentSize = currentSelectionSize;
    const nextSize = increase ? currentSize + 1 : currentSize - 1;
    const clampedSize = Math.max(12, Math.min(72, nextSize));

    try {
      document.execCommand("styleWithCSS", false, "true");
      const tempFontName = `___fs_${Date.now()}___`;
      document.execCommand("fontName", false, tempFontName);

      const editor = editorRef.current;
      if (editor) {
        const selector = `font[face="${tempFontName}"], span[style*="font-family: ${tempFontName}"], span[style*='font-family: "${tempFontName}"']`;
        const targets = editor.querySelectorAll(selector);

        targets.forEach((el) => {
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
      setEditorFontSize((prev) => (increase ? prev + 1 : prev - 1));
    }

    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
      );
    }
  };

  const applySpecificFontSize = (size: number) => {
    const clampedSize = Math.max(8, Math.min(120, size));
    setCurrentSelectionSize(clampedSize);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setEditorFontSize(clampedSize);
      return;
    }

    if (selection.isCollapsed) {
      setEditorFontSize(clampedSize);
      return;
    }

    try {
      document.execCommand("styleWithCSS", false, "true");
      const tempFontName = `___fs_${Date.now()}___`;
      document.execCommand("fontName", false, tempFontName);

      const editor = editorRef.current;
      if (editor) {
        const selector = `font[face="${tempFontName}"], span[style*="font-family: ${tempFontName}"], span[style*='font-family: "${tempFontName}"']`;
        const targets = editor.querySelectorAll(selector);

        targets.forEach((el) => {
          const element = el as HTMLElement;
          element.style.fontFamily = "";
          element.removeAttribute("face");
          element.style.fontSize = `${clampedSize}px`;
          element.style.lineHeight = "normal";
        });
      }
    } catch (e) {
      console.error("Font resize failed:", e);
    }

    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
      );
    }
  };

  const pushToUndo = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          const undoStack = t.undoStack || [];
          if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentHtml) {
            return {
              ...t,
              undoStack: [...undoStack.slice(-99), currentHtml],
              redoStack: [], // Clear redo stack on key change
            };
          }
        }
        return t;
      })
    );
  };

  const handleUndo = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    let targetHtml: string | null = null;
    
    setTabs((prev) => {
      const currentTab = prev.find((t) => t.id === activeTabId);
      if (!currentTab) return prev;
      const undoStack = currentTab.undoStack || [];
      if (undoStack.length === 0) {
        return prev;
      }
      const previousHtml = undoStack[undoStack.length - 1];
      targetHtml = previousHtml;
      const newUndoStack = undoStack.slice(0, -1);
      const redoStack = currentTab.redoStack || [];
      const newRedoStack = [...redoStack, currentHtml];
      
      return prev.map((t) =>
        t.id === activeTabId
          ? { ...t, content: previousHtml, undoStack: newUndoStack, redoStack: newRedoStack }
          : t
      );
    });

    if (targetHtml !== null) {
      editorRef.current.innerHTML = targetHtml;
      lastContentRef.current = targetHtml;
      setDocumentContent(targetHtml);
      setDocSaveStatus("saving");
    } else {
      document.execCommand("undo");
    }
  };

  const handleRedo = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    let targetHtml: string | null = null;

    setTabs((prev) => {
      const currentTab = prev.find((t) => t.id === activeTabId);
      if (!currentTab) return prev;
      const redoStack = currentTab.redoStack || [];
      if (redoStack.length === 0) {
        return prev;
      }
      const nextHtml = redoStack[redoStack.length - 1];
      targetHtml = nextHtml;
      const newRedoStack = redoStack.slice(0, -1);
      const undoStack = currentTab.undoStack || [];
      const newUndoStack = [...undoStack, currentHtml];

      return prev.map((t) =>
        t.id === activeTabId
          ? { ...t, content: nextHtml, undoStack: newUndoStack, redoStack: newRedoStack }
          : t
      );
    });

    if (targetHtml !== null) {
      editorRef.current.innerHTML = targetHtml;
      lastContentRef.current = targetHtml;
      setDocumentContent(targetHtml);
      setDocSaveStatus("saving");
    } else {
      document.execCommand("redo");
    }
  };

  const handleFormat = (command: string, value?: string) => {
    if (command === "undo") {
      handleUndo();
      return;
    }
    if (command === "redo") {
      handleRedo();
      return;
    }
    pushToUndo();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
      );
    }
  };

  const handleInsertTable = (rows: number = 2, cols: number = 3) => {
    if (!editorRef.current) return;
    pushToUndo();
    
    // Cache the range first before focusing changes the selection!
    const rangeToRestore = savedSelectionRangeRef.current;

    // Ensure the editor has focus before trying selection
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }

    const selection = window.getSelection();
    if (selection && rangeToRestore) {
      selection.removeAllRanges();
      selection.addRange(rangeToRestore);
    }
    
    let thead = `<thead><tr style="background-color:#1a1a1c; border-bottom:1px solid #27272a;">`;
    for (let i = 0; i < cols; i++) {
        thead += `<th style="padding:10px 12px; text-align:left; font-weight:600; color:#e4e4e7; border-right:${i < cols - 1 ? '1px solid #27272a' : 'none'};">Header ${i + 1}</th>`;
    }
    thead += `</tr></thead>`;

    let tbody = `<tbody>`;
    for (let r = 0; r < rows; r++) {
        tbody += `<tr style="border-bottom:${r < rows - 1 ? '1px solid #27272a' : 'none'};">`;
        for (let c = 0; c < cols; c++) {
            tbody += `<td style="padding:10px 12px; color:#d4d4d8; border-right:${c < cols - 1 ? '1px solid #27272a' : 'none'};">Row ${r + 1}, Cell ${c + 1}</td>`;
        }
        tbody += `</tr>`;
    }
    tbody += `</tbody>`;

    const tableHTML = `
      <div class="table-embed-wrapper" contenteditable="false" draggable="true" style="display:block; margin:20px 0; position:relative; cursor:grab; border-radius:8px; border:1px solid transparent; transition:border-color 0.15s;" onmouseenter="this.style.borderColor='#27272a'" onmouseleave="this.style.borderColor='transparent'">
        <button class="embed-delete-btn" title="Delete Table" style="position:absolute; top:6px; right:6px; background:#18181b; border:1px solid #27272a; border-radius:4px; color:#a1a1aa; cursor:pointer; font-size:10px; width:18px; height:18px; display:none; align-items:center; justify-content:center; z-index:10; outline:none; transition:all 0.15s;">✕</button>
        <div contenteditable="true" style="padding:4px; background:transparent; cursor:default;" onmousedown="event.stopPropagation();">
          <table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid #27272a; border-radius:8px; overflow:hidden;">${thead}${tbody}</table>
        </div>
      </div>
      <p><br></p>
    `;
    
    let success = false;
    try {
      success = document.execCommand("insertHTML", false, tableHTML);
    } catch (e) {
      console.warn("execCommand failed:", e);
    }
    
    // Fallback if execCommand fails (e.g. no selection range or unsupported)
    if (!success) {
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Ensure range is within our editor
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const el = document.createElement("div");
          el.innerHTML = tableHTML;
          const frag = document.createDocumentFragment();
          let node, lastNode;
          while ((node = el.firstChild)) {
            lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);
          if (lastNode) {
            range.setStartAfter(lastNode);
            range.setEndAfter(lastNode);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          editorRef.current.innerHTML += tableHTML;
        }
      } else {
        editorRef.current.innerHTML += tableHTML;
      }
    }
    
    // Sync state
    const html = editorRef.current.innerHTML;
    lastContentRef.current = html;
    setDocumentContent(html);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
    );
    setDocSaveStatus("saving");
  };

  const handleRemoveTable = () => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node = selection.anchorNode as Node | null;
      let tableEl = null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === "TABLE") {
          tableEl = node as HTMLTableElement;
          break;
        }
        node = node.parentNode;
      }
      if (tableEl) {
        const wrapper = tableEl.closest(".table-embed-wrapper");
        if (wrapper) {
          wrapper.remove();
        } else {
          tableEl.remove();
        }
        // Sync state
        const html = editorRef.current.innerHTML;
        lastContentRef.current = html;
        setDocumentContent(html);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
        );
        setDocSaveStatus("saving");
      }
    }
  };

  const handleInsertChart = () => {
    if (!editorRef.current) return;
    pushToUndo();
    
    // Filter out empty rows or invalid values
    const labels = chartLabels.map(l => l.trim() || "Item");
    const values = chartValues.map(v => isNaN(v) ? 0 : v);
    const maxVal = Math.max(...values, 1);

    // Color schemes that fit our clean visual design
    const schemeColors: Record<string, string[]> = {
      multicolor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316", "#6366f1"],
      emerald: ["#10b981", "#34d399", "#059669", "#a7f3d0", "#047857", "#065f46"],
      blue: ["#3b82f6", "#60a5fa", "#2563eb", "#bfdbfe", "#1d4ed8", "#1e40af"],
      purple: ["#8b5cf6", "#a78bfa", "#7c3aed", "#ddd6fe", "#6d28d9", "#5b21b6"],
      amber: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#b45309", "#92400e"],
      rose: ["#f43f5e", "#fb7185", "#e11d48", "#fecdd3", "#be123c", "#9f1239"],
      cyan: ["#06b6d4", "#22d3ee", "#0891b2", "#cffafe", "#0e7490", "#155e75"],
      orange: ["#f97316", "#fb923c", "#ea580c", "#ffedd5", "#c2410c", "#9a3412"],
      pink: ["#ec4899", "#f472b6", "#db2777", "#fce7f3", "#be185d", "#9d174d"],
      indigo: ["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff", "#4338ca", "#3730a3"],
      slate: ["#64748b", "#94a3b8", "#475569", "#f1f5f9", "#334155", "#1e293b"],
      forest: ["#22c55e", "#4ade80", "#16a34a", "#dcfce7", "#15803d", "#14532d"]
    };

    const activeColors = schemeColors[chartDataColor] || schemeColors.blue;

    let svgContent = "";
    const width = 500;
    const height = 300;

    if (chartType === "bar") {
      const paddingLeft = 45;
      const paddingRight = 20;
      const paddingTop = 35;
      const paddingBottom = 40;
      const graphWidth = width - paddingLeft - paddingRight;
      const graphHeight = height - paddingTop - paddingBottom;

      // Grid lines
      const yTicks = 4;
      let gridLines = "";
      for (let i = 0; i <= yTicks; i++) {
        const y = paddingTop + (graphHeight * i) / yTicks;
        const gridVal = Math.round(maxVal - (maxVal * i) / yTicks);
        gridLines += `
          <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#27272a" stroke-dasharray="3,3" />
          <text x="${paddingLeft - 8}" y="${y + 4}" fill="#71717a" font-size="10" font-family="sans-serif" text-anchor="end">${gridVal}</text>
        `;
      }

      // Draw Bars
      const nBars = labels.length;
      const barSpacing = Math.min(24, graphWidth / (nBars * 2.5));
      const totalSpacingWidth = barSpacing * (nBars + 1);
      const remainingWidth = graphWidth - totalSpacingWidth;
      const barWidth = Math.max(16, remainingWidth / nBars);

      let bars = "";
      for (let i = 0; i < nBars; i++) {
        const val = values[i];
        const barHeight = (val / maxVal) * graphHeight;
        const x = paddingLeft + barSpacing + i * (barWidth + barSpacing);
        const y = paddingTop + graphHeight - barHeight;
        const color = (chartIndividualColors && chartIndividualColors[i]) || (chartDataColor === "multicolor" ? activeColors[i % activeColors.length] : activeColors[0]);

        bars += `
          <g>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(2, barHeight)}" rx="4" fill="${color}" />
            <text x="${x + barWidth / 2}" y="${y - 6}" fill="#f4f4f5" font-size="10" font-family="sans-serif" font-weight="600" text-anchor="middle">${val}</text>
            <text x="${x + barWidth / 2}" y="${paddingTop + graphHeight + 16}" fill="#a1a1aa" font-size="10" font-family="sans-serif" text-anchor="middle">${labels[i]}</text>
          </g>
        `;
      }

      svgContent = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="display:block; background:transparent;">
          ${gridLines}
          ${bars}
        </svg>
      `;

    } else if (chartType === "line") {
      const paddingLeft = 45;
      const paddingRight = 20;
      const paddingTop = 35;
      const paddingBottom = 40;
      const graphWidth = width - paddingLeft - paddingRight;
      const graphHeight = height - paddingTop - paddingBottom;

      // Grid lines
      const yTicks = 4;
      let gridLines = "";
      for (let i = 0; i <= yTicks; i++) {
        const y = paddingTop + (graphHeight * i) / yTicks;
        const gridVal = Math.round(maxVal - (maxVal * i) / yTicks);
        gridLines += `
          <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#27272a" stroke-dasharray="3,3" />
          <text x="${paddingLeft - 8}" y="${y + 4}" fill="#71717a" font-size="10" font-family="sans-serif" text-anchor="end">${gridVal}</text>
        `;
      }

      const nPoints = labels.length;
      const stepX = nPoints > 1 ? graphWidth / (nPoints - 1) : graphWidth;

      const points = values.map((val, i) => {
        const x = paddingLeft + i * stepX;
        const y = paddingTop + graphHeight - (val / maxVal) * graphHeight;
        return { x, y, val, label: labels[i] };
      });

      // Path
      let pathD = "";
      let areaD = `M ${paddingLeft} ${paddingTop + graphHeight}`;

      if (points.length > 0) {
        pathD = `M ${points[0].x} ${points[0].y}`;
        areaD += ` L ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          pathD += ` L ${points[i].x} ${points[i].y}`;
          areaD += ` L ${points[i].x} ${points[i].y}`;
        }
        areaD += ` L ${points[points.length - 1].x} ${paddingTop + graphHeight} Z`;
      }

      const strokeColor = activeColors[0];
      const fillColor = chartDataColor === "multicolor" ? activeColors[1] || strokeColor : strokeColor;

      let markers = "";
      points.forEach((pt, i) => {
        const ptColor = (chartIndividualColors && chartIndividualColors[i]) || strokeColor;
        markers += `
          <g>
            <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="${ptColor}" stroke="#121212" stroke-width="1.5" />
            <text x="${pt.x}" y="${pt.y - 8}" fill="#f4f4f5" font-size="10" font-family="sans-serif" font-weight="600" text-anchor="middle">${pt.val}</text>
            <text x="${pt.x}" y="${paddingTop + graphHeight + 16}" fill="#a1a1aa" font-size="10" font-family="sans-serif" text-anchor="middle">${pt.label}</text>
          </g>
        `;
      });

      svgContent = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="display:block; background:transparent;">
          ${gridLines}
          <path d="${areaD}" fill="${fillColor}" fill-opacity="0.12" />
          <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          ${markers}
        </svg>
      `;

    } else {
      // Pie Chart
      const cx = 180;
      const cy = 150;
      const r = 95;
      const cut = 55;

      const totalVal = values.reduce((a, b) => a + b, 0) || 1;
      let cumulativeAngle = 0;

      let slices = "";
      let legendItems = "";

      for (let i = 0; i < labels.length; i++) {
        const val = values[i];
        const pct = val / totalVal;
        const angle = pct * 360;

        const rad1 = (cumulativeAngle - 90) * (Math.PI / 180);
        const rad2 = (cumulativeAngle + angle - 90) * (Math.PI / 180);

        const x1_out = cx + r * Math.cos(rad1);
        const y1_out = cy + r * Math.sin(rad1);
        const x2_out = cx + r * Math.cos(rad2);
        const y2_out = cy + r * Math.sin(rad2);

        const x1_in = cx + cut * Math.cos(rad1);
        const y1_in = cy + cut * Math.sin(rad1);
        const x2_in = cx + cut * Math.cos(rad2);
        const y2_in = cy + cut * Math.sin(rad2);

        const largeArc = angle > 180 ? 1 : 0;
        const color = (chartIndividualColors && chartIndividualColors[i]) || activeColors[i % activeColors.length];

        let pathStr = "";
        if (pct >= 0.999) {
          pathStr = `
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r - cut}" />
          `;
        } else {
          pathStr = `
            <path d="M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${r} ${r} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${cut} ${cut} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z" fill="${color}" stroke="transparent" stroke-width="1.5" />
          `;
        }

        slices += pathStr;

        const midAngle = cumulativeAngle + angle / 2;
        const midRad = (midAngle - 90) * (Math.PI / 180);
        const tx = cx + (r * 0.75) * Math.cos(midRad);
        const ty = cy + (r * 0.75) * Math.sin(midRad);

        if (pct > 0.05) {
          slices += `<text x="${tx}" y="${ty + 4}" fill="#ffffff" font-size="9.5" font-family="sans-serif" font-weight="600" text-anchor="middle">${Math.round(pct * 100)}%</text>`;
        }

        legendItems += `
          <g transform="translate(0, ${i * 24})">
            <rect width="12" height="12" rx="3" fill="${color}" />
            <text x="20" y="10" fill="#f4f4f5" font-size="11.5" font-family="sans-serif" font-weight="500">${labels[i]}</text>
            <text x="135" y="10" fill="#71717a" font-size="11" font-family="sans-serif" text-anchor="end">${val} (${Math.round(pct * 100)}%)</text>
          </g>
        `;

        cumulativeAngle += angle;
      }

      svgContent = `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="display:block; background:transparent;">
          ${slices}
          <circle cx="${cx}" cy="${cy}" r="${cut - 2}" fill="transparent" />
          <text x="${cx}" y="${cy - 3}" fill="#71717a" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="600" letter-spacing="0.5">TOTAL</text>
          <text x="${cx}" y="${cy + 11}" fill="#f4f4f5" font-size="15" font-family="sans-serif" text-anchor="middle" font-weight="700">${values.reduce((a, b) => a + b, 0)}</text>
          
          <g transform="translate(325, ${Math.max(40, 150 - (labels.length * 24) / 2)})">
            ${legendItems}
          </g>
        </svg>
      `;
    }

    const chartState = { chartType, chartTitle, chartDataColor, chartLabels, chartValues, chartIndividualColors };
    const encodedState = btoa(encodeURIComponent(JSON.stringify(chartState)));
    
    const chartWrapperHTML = `
      <div class="chart-embed-wrapper" data-chart-state="${encodedState}" contenteditable="false" draggable="true" style="display:block; margin:24px auto; max-width:540px; position:relative; cursor:grab; border-radius:8px; border:1px solid transparent; transition:border-color 0.15s; text-align:center;" onmouseenter="this.style.borderColor='#27272a'" onmouseleave="this.style.borderColor='transparent'">
        <button class="embed-delete-btn" title="Delete Chart" style="position:absolute; top:6px; right:6px; background:#18181b; border:1px solid #27272a; border-radius:4px; color:#a1a1aa; cursor:pointer; font-size:10px; width:18px; height:18px; display:none; align-items:center; justify-content:center; z-index:10; outline:none; transition:all 0.15s;">✕</button>
        <div style="padding:16px; background:transparent;">
          ${svgContent}
        </div>
      </div>
    `;
    const chartHTML = chartWrapperHTML + `<p><br></p>`;

    const targetChart = editorRef.current?.querySelector('[data-is-editing="true"]') as HTMLElement | null;

    if (targetChart) {
      const el = document.createElement("div");
      el.innerHTML = chartWrapperHTML;
      const frag = document.createDocumentFragment();
      while (el.firstChild) {
        frag.appendChild(el.firstChild);
      }
      targetChart.parentNode?.replaceChild(frag, targetChart);
    } else if (chartBeingEdited && chartBeingEdited.parentNode) {
      const el = document.createElement("div");
      el.innerHTML = chartWrapperHTML;
      const frag = document.createDocumentFragment();
      while (el.firstChild) {
        frag.appendChild(el.firstChild);
      }
      chartBeingEdited.parentNode.replaceChild(frag, chartBeingEdited);
    } else {
      const rangeToRestore = savedSelectionRangeRef.current;

      if (document.activeElement !== editorRef.current) {
        editorRef.current.focus();
      }

      const selection = window.getSelection();
      if (selection && rangeToRestore) {
        selection.removeAllRanges();
        selection.addRange(rangeToRestore);
      }

      let success = false;
      try {
        success = document.execCommand("insertHTML", false, chartHTML);
      } catch (e) {
        console.warn("execCommand failed:", e);
      }

      if (!success) {
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            const el = document.createElement("div");
            el.innerHTML = chartHTML;
            const frag = document.createDocumentFragment();
            let node, lastNode;
            while ((node = el.firstChild)) {
              lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);
            if (lastNode) {
              range.setStartAfter(lastNode);
              range.setEndAfter(lastNode);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } else {
            editorRef.current.innerHTML += chartHTML;
          }
        } else {
          editorRef.current.innerHTML += chartHTML;
        }
      }
    }

    // Sync state
    const html = editorRef.current.innerHTML;
    lastContentRef.current = html;
    setDocumentContent(html);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
    );
    setDocSaveStatus("saving");
    
    // Clean up temporary edit tokens
    if (editorRef.current) {
      editorRef.current.querySelectorAll('[data-is-editing="true"]').forEach((el) => {
        el.removeAttribute('data-is-editing');
      });
    }
    setChartBeingEdited(null);
    setIsChartModalOpen(false);
  };

  const closeChartModal = () => {
    if (editorRef.current) {
      editorRef.current.querySelectorAll('[data-is-editing="true"]').forEach((el) => {
        el.removeAttribute('data-is-editing');
      });
    }
    setChartBeingEdited(null);
    setIsChartModalOpen(false);
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.textAlign = editorAlign;
    }
  }, [editorAlign]);

  // Document Metadata State
  const [documentTitle, setDocumentTitle] = useState("");
  const [docSaveStatus, setDocSaveStatus] = useState<"saved" | "saving" | null>(
    "saved",
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isExportSubmenuOpen, setIsExportSubmenuOpen] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number>(Date.now());
  const [saveMessage, setSaveMessage] = useState("Saved just now");

  useEffect(() => {
    if (!isMoreMenuOpen) {
      setIsExportSubmenuOpen(false);
    }
  }, [isMoreMenuOpen]);

  useEffect(() => {
    if (docSaveStatus === "saving") {
      setSaveMessage("Saving...");
    } else if (docSaveStatus === "saved") {
      setLastSavedTime(Date.now());
      setSaveMessage("Saved just now");
    }
  }, [docSaveStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (docSaveStatus === "saving") return;
      const diff = Date.now() - lastSavedTime;
      if (diff < 10000) {
        setSaveMessage("Saved just now");
      } else if (diff < 60000) {
        setSaveMessage("Saved a few seconds ago");
      } else {
        const mins = Math.floor(diff / 60000);
        setSaveMessage(`Saved ${mins}m ago`);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [lastSavedTime, docSaveStatus]);

  const handleExportMarkdown = () => {
    try {
      const content = editorRef.current?.innerText || "";
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${documentTitle || "document"}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Document exported to Markdown successfully!", "success");
    } catch (err) {
      console.error("Export error:", err);
      showToast("Failed to export Markdown", "error");
    }
  };

  const handleExportWord = () => {
    try {
      const content = editorRef.current?.innerHTML || "";
      const title = documentTitle || "Document";
      const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; }
        </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${title}.doc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Document exported to Word format successfully!", "success");
    } catch (err) {
      console.error("Export word error:", err);
      showToast("Failed to export to Word", "error");
    }
  };

  const handleExportTXT = () => {
    try {
      const content = editorRef.current?.innerText || "";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${documentTitle || "document"}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Document exported to TXT successfully!", "success");
    } catch (err) {
      console.error("Export TXT error:", err);
      showToast("Failed to export TXT", "error");
    }
  };

  const handleExportPDF = () => {
    try {
      const element = editorRef.current;
      if (!element) {
        showToast("No content to export.", "error");
        return;
      }
      
      const title = documentTitle || "document";
      
      // We prepend the title to the element temporarily
      const titleEl = document.createElement("h1");
      titleEl.innerText = title;
      titleEl.style.fontSize = "28px";
      titleEl.style.fontWeight = "700";
      titleEl.style.color = "#111111"; // deep black bold title
      titleEl.style.borderBottom = "2px solid #e2e8f0";
      titleEl.style.paddingBottom = "12px";
      titleEl.style.marginBottom = "28px";
      titleEl.style.fontFamily = "'Inter', system-ui, sans-serif";
      
      element.insertBefore(titleEl, element.firstChild);
      
      // Temporarily add dark-to-light/print theme override classes
      element.classList.add("pdf-export-element");

      const opt = {
        margin:       0.6,
        filename:     `${title}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };

      showToast("Generating PDF...", "success");
      
      html2pdf().from(element).set(opt).save().then(() => {
        showToast("Document exported to PDF successfully!", "success");
        element.classList.remove("pdf-export-element");
        if (titleEl.parentNode) titleEl.parentNode.removeChild(titleEl);
      }).catch((err: any) => {
        console.error("PDF Export error:", err);
        showToast("Failed to export to PDF", "error");
        element.classList.remove("pdf-export-element");
        if (titleEl.parentNode) titleEl.parentNode.removeChild(titleEl);
      });
      
    } catch (err) {
      console.error("PDF Export error:", err);
      showToast("Failed to export to PDF", "error");
    }
  };

  useEffect(() => {
    if (isShareModalOpen && activeTabId) {
      setGeneratedLink(`${window.location.origin}/?tab=${activeTabId}`);
    }
  }, [isShareModalOpen, activeTabId]);

  // PDF Annotation States
  const [selectionText, setSelectionText] = useState("");
  const [selectionPos, setSelectionPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pdfContextMenu, setPdfContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedPageNum, setSelectedPageNum] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [activeHighlightColor, setActiveHighlightColor] = useState("#fef08a");
  const [folderName, setFolderName] = useState("");
  const [savedNoteName, setSavedNoteName] = useState("");

  // Authentication & session loaded state
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("cosmi_user_snapshot");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const setOnboardingTaskComplete = (taskKey: string) => {
    const uid = currentUser?.uid;
    const storageKey = uid ? `onboarding_${taskKey}_${uid}` : `onboarding_${taskKey}`;
    localStorage.setItem(storageKey, 'true');
  };

  // Handle desktop deep linking callbacks (Electron & Tauri)
  useEffect(() => {
    let unsubscribeDeepLink: (() => void) | undefined;

    const setupDeepLinkListener = async () => {
      const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
      const isTauri = typeof window !== 'undefined' && ('___TAURI___' in window || (window as any).__TAURI__ !== undefined);

      if (isElectron && (window as any).electron?.onDeepLink) {
        console.log("Electron: Registering deep link listener");
        unsubscribeDeepLink = (window as any).electron.onDeepLink(async (urlStr: string) => {
          try {
            console.log("Electron received deep link:", urlStr);
            const url = new URL(urlStr);
            const token = url.searchParams.get('token');
            const googleIdToken = url.searchParams.get('id_token') || url.searchParams.get('googleIdToken');
            
            if (token) {
              const { signInWithCustomToken } = await import('firebase/auth');
              await signInWithCustomToken(auth, token);
              console.log("Electron authenticated successfully with custom token");
            } else if (googleIdToken) {
              const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
              const credential = GoogleAuthProvider.credential(googleIdToken);
              await signInWithCredential(auth, credential);
              console.log("Electron authenticated successfully with Google ID token");
            }
          } catch (err) {
            console.error("Electron deep link authentication error:", err);
          }
        });
      } else if (isTauri) {
        try {
          console.log("Tauri: Registering deep link listener");
          const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
          const unlisten = await onOpenUrl(async (urls) => {
            try {
              console.log("Tauri received deep link:", urls[0]);
              const url = new URL(urls[0]);
              const token = url.searchParams.get('token');
              if (token) {
                const { signInWithCustomToken } = await import('firebase/auth');
                await signInWithCustomToken(auth, token);
                console.log("Tauri authenticated successfully with custom token");
              }
            } catch (err) {
              console.error("Tauri custom token login fail:", err);
            }
          });
          unsubscribeDeepLink = () => {
            unlisten();
          };
        } catch (err) {
          console.error("Tauri deep link initialization fail:", err);
        }
      }
    };

    setupDeepLinkListener();

    return () => {
      if (unsubscribeDeepLink) {
        unsubscribeDeepLink();
      }
    };
  }, []);

  // Handle desktop authentication redirection bypass & system browser google callback flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_callback') === '1') {
      // Handled by DesktopAuthBridge component entirely, skip this effect
      return;
    }

    const isElectron = () => typeof window !== 'undefined' && (
      (window as any).electron !== undefined || 
      navigator.userAgent.toLowerCase().includes('electron') ||
      (window as any).ipcRenderer !== undefined ||
      (window as any).process?.versions?.electron !== undefined
    );
    const isTauri = () => typeof window !== 'undefined' && ('___TAURI___' in window || (window as any).__TAURI__ !== undefined);
    
    if (isElectron() || isTauri()) {
      console.log("Desktop shell detected (Electron/Tauri): Skipping third-party storage auth redirects.");
      return;
    }
    
    const checkRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const isCallback = params.get('google_callback') === '1';

      try {
        const { getRedirectResult, signInWithRedirect } = await import('firebase/auth');
        const result = await getRedirectResult(auth);
        
        if (result?.user) {
          console.log('Redirect login success', result.user);
          if (isCallback) {
            const idToken = await result.user.getIdToken();
            try {
              const res = await fetch('/api/auth/custom-token', {
                method: 'POST',
                body: JSON.stringify({ idToken }),
                headers: { 'Content-Type': 'application/json' }
              });
              if (!res.ok) throw new Error("Failed to fetch custom token");
              const { customToken } = await res.json();
              if (customToken) {
                window.location.href = `cosmiwise://auth?token=${customToken}`;
              }
            } catch (fetchErr) {
              console.error("Custom token error:", fetchErr);
            }
            return;
          }
        } else if (isCallback) {
          if (!auth.currentUser) {
            const { signInWithRedirect } = await import('firebase/auth');
            await signInWithRedirect(auth, googleProvider);
          } else {
            // Already logged in from dynamic session, directly retrieve token & deep link back
            const idToken = await auth.currentUser.getIdToken();
            try {
              const res = await fetch('/api/auth/custom-token', {
                method: 'POST',
                body: JSON.stringify({ idToken }),
                headers: { 'Content-Type': 'application/json' }
              });
              if (res.ok) {
                const { customToken } = await res.json();
                window.location.href = `cosmiwise://auth?token=${customToken}`;
              }
            } catch (err) {
              console.error("Custom token error on currentUser:", err);
            }
          }
        }
      } catch (err: any) {
        console.error('redirect result error:', err.code, err.message);
      }
    };
    checkRedirect();
  }, []);

  const currentUserIdRef = useRef<string | null>(
    currentUser ? currentUser.uid : null,
  );
  const loadedUserIdRef = useRef<string | "guest" | null>(
    currentUser ? currentUser.uid : "guest",
  );
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<"local" | "database">(() => {
    return (localStorage.getItem("cosmi_settings_storage_mode") as "local" | "database") || "local";
  });

  const lastLocalEditTimeRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);
  const lastReceivedSnapshotTabsStr = useRef<string>("");

  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [isCloudMenuOpen, setIsCloudMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Folder Management State
  const [folders, setFolders] = useState<FolderItem[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_folders_${uid}`);
      return cached
        ? JSON.parse(cached)
        : [
            {
              id: "f1",
              name: "My Research",
              createdAt: Date.now() - 172800000,
            },
          ];
    } catch {
      return [
        { id: "f1", name: "My Research", createdAt: Date.now() - 172800000 },
      ];
    }
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderTempName, setRenamingFolderTempName] =
    useState<string>("");
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const activeModal: "deleteFolder" | "deleteSelection" | "closeTab" | "deleteChat" | "exitApp" | null = (() => {
    if (isDeleteFolderModalOpen) return "deleteFolder";
    if (isDeleteSelectionConfirmOpen) return "deleteSelection";
    if (isDeleteConfirmOpen) return "closeTab";
    if (chatIdToDelete) return "deleteChat";
    if (isExitConfirmOpen) return "exitApp";
    return null;
  })();

  const setActiveModal = (modal: "deleteFolder" | "deleteSelection" | "closeTab" | "deleteChat" | "exitApp" | null) => {
    setIsDeleteFolderModalOpen(modal === "deleteFolder");
    setIsDeleteSelectionConfirmOpen(modal === "deleteSelection");
    setIsDeleteConfirmOpen(modal === "closeTab");
    setChatIdToDelete(modal === "deleteChat" ? chatIdToDelete : null);
    setIsExitConfirmOpen(modal === "exitApp");
  };

  const handleCloseModal = () => {
    setIsDeleteFolderModalOpen(false);
    setIsDeleteSelectionConfirmOpen(false);
    setIsDeleteConfirmOpen(false);
    setChatIdToDelete(null);
    setIsExitConfirmOpen(false);
  };
  const [activeMoveFolderDropdown, setActiveMoveFolderDropdown] = useState<
    string | null
  >(null);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({ f1: true, f2: true, f3: false });

  // Research Papers Data
  const [papers, setPapers] = useState<PaperItem[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_papers_${uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Dynamic Tab Title Management
  useEffect(() => {
    if (!activeTab) {
      document.title = "Cosmi";
      return;
    }

    switch (activeTab.type) {
      case "home":
        document.title = "Cosmi";
        break;
      case "library":
        if (selectedFolderId) {
          const folderObj = folders.find((f) => f.id === selectedFolderId);
          document.title = `Cosmi - ${folderObj?.name || "Library"}`;
        } else {
          document.title = "Cosmi - Library";
        }
        break;
      case "document": {
        const titleStr =
          activeTab.title && activeTab.title.trim() !== ""
            ? activeTab.title
            : "Untitled Document";
        document.title = `Cosmi - ${titleStr}`;
        break;
      }
      case "chat": {
        const titleStr =
          activeTab.title && activeTab.title.trim() !== ""
            ? activeTab.title
            : "Chat";
        document.title = `Cosmi - ${titleStr}`;
        break;
      }
      default: {
        const titleStr =
          activeTab.title && activeTab.title.trim() !== ""
            ? activeTab.title
            : "Workspace";
        document.title = `Cosmi - ${titleStr}`;
      }
    }
  }, [activeTab, selectedFolderId, folders]);

  // Database helper wrappers to sync automatically to Firestore or guest local state
  const dbSetFolder = async (folder: FolderItem) => {
    const isRename = folders.some((f) => f.id === folder.id);
    if (currentUser && storageMode === "database") {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "folders", folder.id), {
          id: folder.id,
          name: folder.name,
          createdAt: folder.createdAt,
        });
        showToast(
          isRename
            ? `Folder renamed to "${folder.name}"`
            : `Folder "${folder.name}" created successfully`,
          "success",
        );
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${currentUser.uid}/folders/${folder.id}`,
        );
        showToast(
          `Failed to save folder: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setFolders((prev) => {
        if (prev.some((f) => f.id === folder.id)) {
          return prev.map((f) => (f.id === folder.id ? folder : f));
        }
        return [...prev, folder];
      });
      showToast(
        isRename
          ? `Folder renamed to "${folder.name}"`
          : `Folder "${folder.name}" created successfully`,
        "success",
      );
    }
  };

  const dbDeleteFolder = async (folderId: string) => {
    const folderName = folders.find((f) => f.id === folderId)?.name || "Folder";

    // Close tabs associated with deleted papers
    const papersToDelete = papers.filter((p) => p.folderId === folderId);
    if (papersToDelete.length > 0) {
      const titlesToDelete = papersToDelete.map((p) => p.title);
      setTabs((prev) => {
        const tabsToDelete = prev.filter(
          (t) => t.type === "document" && titlesToDelete.includes(t.title),
        );
        if (tabsToDelete.length === 0) return prev;

        const updated = prev.filter(
          (t) => t.type !== "document" || !titlesToDelete.includes(t.title),
        );

        if (updated.length === 0) {
          const newId = `chat-${Date.now()}`;
          setActiveTabId(newId);
          setActiveAssistantTabId(newId);
          setMessages([]);
          return [{ id: newId, type: "chat", title: "Untitled" }];
        }

        if (tabsToDelete.some((t) => t.id === activeTabId)) {
          setActiveTabId(updated[0].id);
        }

        return updated;
      });
    }

    if (currentUser && storageMode === "database") {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "folders", folderId));
        for (const p of papersToDelete) {
          const paperId = encodeURIComponent(p.title).replace(/\./g, "%2E");
          await deleteDoc(doc(db, "users", currentUser.uid, "papers", paperId));
        }
        showToast(
          `Folder "${folderName}" and its documents deleted successfully`,
          "success",
        );
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${currentUser.uid}/folders/${folderId}`,
        );
        showToast(
          `Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setPapers((prev) => prev.filter((p) => p.folderId !== folderId));
      showToast(
        `Folder "${folderName}" and its documents deleted successfully`,
        "success",
      );
    }
  };

  const dbSetPaper = async (paper: PaperItem, silent = false) => {
    const paperId = encodeURIComponent(paper.title).replace(/\./g, "%2E");
    const isNew = !papers.some((p) => p.title === paper.title);
    const hasFolderChanged = papers.some(
      (p) => p.title === paper.title && p.folderId !== paper.folderId,
    );

    if (currentUser && storageMode === "database") {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "papers", paperId), {
          author: paper.author || "",
          title: paper.title || "",
          description: paper.description || "",
          url: paper.url || "",
          added: paper.added || "",
          fullTextStatus: paper.fullTextStatus || "",
          viewed: paper.viewed || "",
          fileType: paper.fileType || "",
          summary: paper.summary || "",
          fileId: paper.fileId || "",
          mimetype: paper.mimetype || "",
          extractedText: paper.extractedText || "",
          folderId: paper.folderId || "",
          notes: paper.notes || "",
        });

        if (!silent) {
          if (hasFolderChanged) {
            const destFolder =
              folders.find((f) => f.id === paper.folderId)?.name || "Default";
            showToast(`Moved "${paper.title}" to ${destFolder}`, "success");
          } else if (isNew) {
            showToast(
              `Document "${paper.title}" added to workspace`,
              "success",
            );
          }
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${currentUser.uid}/papers/${paperId}`,
        );
        showToast(
          `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setPapers((prev) => {
        if (prev.some((p) => p.title === paper.title)) {
          return prev.map((p) => (p.title === paper.title ? paper : p));
        }
        return [paper, ...prev];
      });

      if (!silent) {
        if (hasFolderChanged) {
          const destFolder =
            folders.find((f) => f.id === paper.folderId)?.name || "Default";
          showToast(`Moved "${paper.title}" to ${destFolder}`, "success");
        } else if (isNew) {
          showToast(`Document "${paper.title}" added to workspace`, "success");
        }
      }
    }
  };

  const createNewDocument = (targetFolderId?: string) => {
    setOnboardingTaskComplete('create_note');
    const newId = `doc-${Date.now()}`;
    const folder = targetFolderId || selectedFolderId || folders[0]?.id || "f1";
    const newDoc: Tab = {
      id: newId,
      type: "document",
      title: "Untitled",
      originalTitle: "Untitled",
      content: "",
      folderId: folder,
    };

    lastLocalEditTimeRef.current = Date.now();
    setTabs((prev) => [...prev, newDoc]);
    setActiveTabId(newId);
    setSidebarView("files");
    saveDraftToLibrary(newDoc);
    showToast(`New draft document created`, "success");
    return newId;
  };

  const handleUploadFile = async (file: File) => {
    setOnboardingTaskComplete('upload_file');
    const taskId = "upload-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const uploaderId = currentUserIdRef.current;
    
    // Add to uploadTasks state
    const newTask: UploadTask = {
      id: taskId,
      fileName: file.name,
      progress: 0,
      status: "starting",
    };
    
    setUploadTasks((prev) => [...prev, newTask]);
    setIsUploadsPanelOpen(true);
    setIsUploadsPanelCollapsed(false);

    const toastId = "upload-main-" + Date.now();

    try {
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);

        // Save reference to the task's xhr so we can cancel/abort it
        setUploadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, xhr } : t))
        );

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            
            // Update percentage and upload task state
            setUploadTasks((prev) =>
              prev.map((t) =>
                t.id === taskId ? { ...t, progress: percent, status: "uploading" } : t
              )
            );
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              const preview = xhr.responseText.substring(0, 100);
              reject(new Error("Invalid server response: " + preview));
            }
          } else {
            let errMsg = `Server responded with status ${xhr.status}`;
            try {
              const resData = JSON.parse(xhr.responseText);
              if (resData.error) errMsg += ": " + resData.error;
            } catch (e) {}
            reject(new Error(errMsg));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network upload error")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      if (currentUserIdRef.current !== uploaderId) return;
      if (data.success) {
        const fileLabel = data.fileName;
        const titlePlaceholder = fileLabel.replace(/\.[^/.]+$/, "");
        const isImage = data.mimetype?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(fileLabel.toLowerCase().split('.').pop() || "");

        // Update task success status
        setUploadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, progress: 100, status: "success" } : t
          )
        );

        // Always save attached file info
        setAttachedFile({
          fileId: data.fileId,
          fileName: data.fileName,
          mimetype: data.mimetype,
          url: `/api/files/${data.fileId}`
        });

        let extractedText = "";
        let summaryInfo = `This academic resource was uploaded and incorporated into your workspace. Select 'Ask Assistant' to summarize patterns or find citations.`;
        let pagesCountString = "";

        if (fileLabel.toLowerCase().endsWith(".pdf")) {
          // Pre-cache PDF in client-side storage so next view and parser is instant
          preCachePdfFile(data.fileId, file);
          try {
            extractedText = await extractTextFromPdf(`/api/files/${data.fileId}`);
            if (extractedText) {
              summaryInfo = `This PDF document is parsed and indexed successfully. You can write essays or ask questions about its exact contents.`;
              // Count pages mapped
              const pagesMatch = extractedText.match(/--- Page \d+ of \d+ ---/g);
              if (pagesMatch) {
                pagesCountString = ` (${pagesMatch.length} pages mapped)`;
              }
            }
          } catch (pdfErr) {
            console.error("PDF mapping failed", pdfErr);
          }
        } else if (isImage) {
          try {
            console.log("[OCR] Direct image upload detected. Triggering Gemini OCR...");
            const textRes = await fetch(`/api/files/${data.fileId}/raw-text`);
            if (textRes.ok) {
              const textData = await textRes.json();
              if (textData.success && textData.text) {
                extractedText = textData.text;
                summaryInfo = `This image has been OCR scanned and mapped successfully. You can start analyzing and asking the Assistant specifically about its claims.`;
                const words = extractedText.trim().split(/\s+/).filter(Boolean).length;
                pagesCountString = ` (${words} words OCR transcribed)`;
              }
            }
          } catch (ocrErr) {
            console.error("Image OCR mapping failed", ocrErr);
          }
        } else if (
          fileLabel.toLowerCase().endsWith(".docx") ||
          fileLabel.toLowerCase().endsWith(".txt") ||
          fileLabel.toLowerCase().endsWith(".md") ||
          fileLabel.toLowerCase().endsWith(".html") ||
          fileLabel.toLowerCase().endsWith(".htm")
        ) {
          try {
            let textRes;
            if (data.fileId.startsWith("local-") && typeof window !== "undefined" && (window as any).__textMemoryCache?.has(data.fileId)) {
              textRes = {
                ok: true,
                json: async () => ({ success: true, text: (window as any).__textMemoryCache.get(data.fileId) })
              };
            } else {
              textRes = await fetch(`/api/files/${data.fileId}/raw-text`);
            }
            if (textRes.ok) {
              const textData = await textRes.json();
              if (textData.success && textData.text) {
                let cleanText = textData.text;
                if (fileLabel.toLowerCase().endsWith(".html") || fileLabel.toLowerCase().endsWith(".htm")) {
                  cleanText = cleanText
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                }
                extractedText = cleanText;
                summaryInfo = `This document is parsed and mapped successfully. You can start synthesizing your notes, analyzing findings, and asking the Assistant specifically about its claims Simon.`;
                const words = extractedText.trim().split(/\s+/).filter(Boolean).length;
                pagesCountString = ` (${words} words mapped)`;
              }
            }
          } catch (docxErr) {
            console.error("Docx/Text/HTML mapping failed", docxErr);
          }
        }

        if (currentUserIdRef.current !== uploaderId) return;

        const targetFolder = selectedFolderId || folders[0]?.id || "f1";
        const parsedPaper: PaperItem = {
          author: "Unknown Author",
          title: titlePlaceholder,
          description: `Uploaded draft document: ${fileLabel}`,
          added: "Today",
          fullTextStatus: "Available",
          viewed: "Just now",
          fileType: "Document",
          summary: summaryInfo,
          fileId: data.fileId,
          mimetype: data.mimetype,
          extractedText: extractedText,
          folderId: targetFolder,
        };
        dbSetPaper(parsedPaper, true);

        const newId = `doc-${Date.now()}`;
        let initialContent = "";
        if (extractedText) {
          const pages = extractedText.split(/--- Page \d+ of \d+ ---/);
          const markers = extractedText.match(/--- Page (\d+) of \d+ ---/g) || [];

          initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
            <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${titlePlaceholder}</h1>
            <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Mapped Document: ${fileLabel}${pagesCountString}</p>
            <div class="h-[1px] bg-zinc-800 mb-6 font-medium"></div>`;

          pages.forEach((pageContent: string, idx: number) => {
            if (!pageContent.trim() && idx === 0) return;
            const pageNumMatch = idx > 0 ? markers[idx - 1]?.match(/\d+/) : null;
            const pageNum = pageNumMatch ? pageNumMatch[0] : (idx === 0 ? "1" : idx.toString());

            initialContent += `<div id="pdf-page-${pageNum}" class="mb-10 pt-4 border-t border-zinc-800/30 group/page">
              <div class="text-[10px] font-mono text-zinc-600 mb-4 uppercase tracking-widest group-hover/page:text-zinc-400 transition-colors">Page ${pageNum}</div>
              <div class="space-y-4 leading-relaxed">${pageContent
                .trim()
                .split("\n\n")
                .map((p) => p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : "")
                .join("")}</div>
            </div>`;
          });
          initialContent += `</div>`;
        } else {
          initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
              <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${titlePlaceholder}</h1>
              <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Document File: ${fileLabel}${pagesCountString}</p>
              <div class="h-[1px] bg-zinc-800 mb-6"></div>
              <p class="mb-4 leading-relaxed font-jakarta">The file has been uploaded securely and mapped. You can start synthesizing your notes, analyzing findings, and asking the Assistant specifically about its claims.</p>
            </div>`;
        }

        setTabs((prev) => [
          ...prev,
          {
            id: newId,
            type: "document",
            title: titlePlaceholder,
            content: initialContent,
            fileId: data.fileId,
            mimetype: data.mimetype,
            folderId: targetFolder,
          },
        ]);
        setActiveTabId(newId);
        setSidebarView("files");
        setIsCreateDropdownOpen(false);
        setIsAssistantOpen(true);

        if (extractedText || fileLabel.toLowerCase().endsWith(".pdf")) {
          setTimeout(() => {
            handleSendMessage(
              `Please thoroughly analyze the newly uploaded document titled "${fileLabel}".${extractedText ? ` Here are the contents (partially extracted): \n\n${extractedText.substring(0, 10000)}\n\n` : `\n\n`}Provide a comprehensive summary, highlight the main findings, and explain key claims in detail.`,
              { 
                isHidden: true,
                overrideAttachment: { fileId: data.fileId, fileName: fileLabel, mimetype: data.mimetype }
              },
            );
          }, 500);
        } else {
          setTimeout(() => {
            const assistantMsg: ChatMessage = {
              id: String(Date.now()),
              role: "assistant",
              content: `### Document Mapped: ${fileLabel}\n\nI have successfully indexed **${fileLabel}** and mapped it to your workspace. The document metadata has been saved.`,
              timestamp: Date.now(),
            };
            updateChatMessages((prev) => [...prev, assistantMsg], false);
          }, 500);
        }
      } else {
        throw new Error(data.message || "Invalid upload response");
      }
    } catch (err: any) {
      console.warn("Upload failed, falling back to local client-side processing:", err);
      
      const fileLabel = file.name;
      const titlePlaceholder = fileLabel.replace(/\.[^/.]+$/, "");
      const isImage = file.type?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(fileLabel.toLowerCase().split('.').pop() || "");
      const isPdf = fileLabel.toLowerCase().endsWith(".pdf");
      const isTextOrDoc = fileLabel.toLowerCase().endsWith(".docx") ||
                          fileLabel.toLowerCase().endsWith(".txt") ||
                          fileLabel.toLowerCase().endsWith(".md") ||
                          fileLabel.toLowerCase().endsWith(".html") ||
                          fileLabel.toLowerCase().endsWith(".htm");

      if (isPdf || isTextOrDoc || isImage) {
        const localFileId = "local-" + Date.now();
        
        setUploadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: "success" } : t))
        );

        if (isImage) {
          const objectUrl = URL.createObjectURL(file);
          if (typeof window !== "undefined") {
            const win = window as any;
            if (!win.__pdfMemoryCache) win.__pdfMemoryCache = new Map();
            win.__pdfMemoryCache.set(localFileId, objectUrl);
          }
          setAttachedFile({
            fileId: localFileId,
            fileName: file.name,
            mimetype: file.type || "image/png",
            url: `/api/files/${localFileId}`,
          });
        } else {
          await preCachePdfFile(localFileId, file);
        }

        let extractedText = "";
        let summaryInfo = `This academic resource was uploaded and incorporated into your workspace. Select 'Ask Assistant' to summarize patterns or find citations.`;
        let pagesCountString = "";

        if (isPdf) {
          try {
            extractedText = await extractTextFromPdf(`/api/files/${localFileId}`);
            if (extractedText) {
              summaryInfo = `This PDF document is parsed and indexed successfully. You can write essays or ask questions about its exact contents.`;
              const pagesMatch = extractedText.match(/--- Page \d+ of \d+ ---/g);
              if (pagesMatch) {
                pagesCountString = ` (${pagesMatch.length} pages mapped)`;
              }
            }
          } catch (pdfErr) {
            console.error("Local PDF mapping failed", pdfErr);
          }
        } else if (isImage) {
          try {
            console.log("[OCR] Local image upload detected. Reading base64 for server OCR...");
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(",")[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const ocrRes = await fetch("/api/ocr-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64: base64Data, mimeType: file.type || "image/jpeg" })
            });
            if (ocrRes.ok) {
              const ocrData = await ocrRes.json();
              if (ocrData.success && ocrData.text) {
                extractedText = ocrData.text;
                summaryInfo = `This image has been OCR scanned and mapped successfully (local mode). You can start analyzing and asking the Assistant specifically about its claims.`;
                const words = extractedText.trim().split(/\s+/).filter(Boolean).length;
                pagesCountString = ` (${words} words OCR transcribed)`;
              }
            }
          } catch (ocrErr) {
            console.error("Local Image OCR failed", ocrErr);
          }
        } else if (isTextOrDoc) {
          try {
            if (fileLabel.toLowerCase().endsWith(".txt") || fileLabel.toLowerCase().endsWith(".md") || fileLabel.toLowerCase().endsWith(".html") || fileLabel.toLowerCase().endsWith(".htm")) {
              const reader = new FileReader();
              extractedText = await new Promise<string>((resolve) => {
                reader.onload = (e) => resolve((e.target?.result as string) || "");
                reader.readAsText(file);
              });
              if (!(window as any).__textMemoryCache) (window as any).__textMemoryCache = new Map();
              (window as any).__textMemoryCache.set(localFileId, extractedText);

              if (fileLabel.toLowerCase().endsWith(".html") || fileLabel.toLowerCase().endsWith(".htm")) {
                extractedText = extractedText
                  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
              }
            }
          } catch (textErr) {
            console.error("Local text mapping failed", textErr);
          }
        }

        const newDoc: any = {
          id: localFileId,
          title: titlePlaceholder,
          fileName: fileLabel,
          mimetype: isPdf ? "application/pdf" : (file.type || "text/plain"),
          extractedText: extractedText || "",
          summary: summaryInfo,
          createdAt: Date.now(),
          lastModified: Date.now(),
        };

        dbSetPaper(newDoc);
        setPapers((prev) => [newDoc, ...prev]);

        showToast(`Document "${fileLabel}" imported successfully (local mode)${pagesCountString}`, "success", 4000, toastId);

        const newId = `tab-doc-${localFileId}`;
        setTabs((prev) => [
          ...prev,
          {
            id: newId,
            title: titlePlaceholder,
            type: "document",
            fileId: localFileId,
            mimetype: isPdf ? "application/pdf" : (file.type || "text/plain"),
            isGeneratingNotes: false,
            content: "",
          },
        ]);
        setActiveTabId(newId);
        setSidebarView("files");
        setIsCreateDropdownOpen(false);
        setIsAssistantOpen(true);

        if (extractedText || isPdf) {
          setTimeout(() => {
            handleSendMessage(
              `Please thoroughly analyze the newly uploaded document titled "${fileLabel}".${extractedText ? ` Here are the contents (partially extracted): \n\n${extractedText.substring(0, 10000)}\n\n` : `\n\n`}Provide a comprehensive summary, highlight the main findings, and explain key claims in detail.`,
              { 
                isHidden: true,
                overrideAttachment: { fileId: localFileId, fileName: fileLabel, mimetype: isPdf ? "application/pdf" : (file.type || "text/plain") }
              },
            );
          }, 500);
        } else {
          setTimeout(() => {
            const assistantMsg: ChatMessage = {
              id: String(Date.now()),
              role: "assistant",
              content: `### Document Mapped: ${fileLabel}\n\nI have successfully indexed **${fileLabel}** and mapped it to your workspace locally.`,
              timestamp: Date.now(),
            };
            updateChatMessages((prev) => [...prev, assistantMsg], false);
          }, 500);
        }
        return;
      }

      const errMsg = getUserFriendlyErrorMessage(err);
      
      // Update upload tasks state with failure
      setUploadTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "error", error: errMsg } : t))
      );
      
      showToast(`Upload failed: ${errMsg}`, "error", 4000, toastId);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: "assistant",
          content: `⚠️ **Upload failed**: ${errMsg}\n\n*Make sure the file is a valid PDF, DOC, or DOCX, and is under 15MB.*`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleCancelTask = (taskId: string) => {
    setUploadTasks((prev) => {
      const match = prev.find((t) => t.id === taskId);
      if (match && match.xhr) {
        match.xhr.abort();
      }
      return prev.map((t) =>
        t.id === taskId ? { ...t, status: "cancelled" } : t
      );
    });
  };

  const handleCancelAllTasks = () => {
    setUploadTasks((prev) => {
      prev.forEach((t) => {
        if ((t.status === "uploading" || t.status === "starting") && t.xhr) {
          t.xhr.abort();
        }
      });
      return prev.map((t) =>
        t.status === "uploading" || t.status === "starting" ? { ...t, status: "cancelled" } : t
      );
    });
  };

  const dbDeletePaper = async (paperTitle: string) => {
    const paperId = encodeURIComponent(paperTitle).replace(/\./g, "%2E");

    // Close any open document tabs associated with this paper
    setTabs((prev) => {
      const tabsToDelete = prev.filter(
        (t) => t.type === "document" && t.title === paperTitle,
      );
      if (tabsToDelete.length === 0) return prev;

      const updated = prev.filter(
        (t) => t.type !== "document" || t.title !== paperTitle,
      );

      if (updated.length === 0) {
        const newId = `chat-${Date.now()}`;
        setActiveTabId(newId);
        setActiveAssistantTabId(newId);
        setMessages([]);
        return [{ id: newId, type: "chat", title: "Untitled" }];
      }

      if (tabsToDelete.some((t) => t.id === activeTabId)) {
        setActiveTabId(updated[0].id);
      }

      return updated;
    });

    if (currentUser && storageMode === "database") {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "papers", paperId));
        showToast(`Document "${paperTitle}" deleted successfully`, "success");
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${currentUser.uid}/papers/${paperId}`,
        );
        showToast(
          `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    } else {
      setPapers((prev) => prev.filter((p) => p.title !== paperTitle));
      showToast(`Document "${paperTitle}" deleted successfully`, "success");
    }
  }  // Real-time Firestore synchronization effect
  useEffect(() => {
    let unsubscribeUser = () => {};
    let unsubFolders = () => {};
    let unsubPapers = () => {};
    let unsubChats = () => {};
    let unsubAnnos = () => {};

    const setupListeners = async (user: any) => {
      // Clean up previous listeners
      unsubFolders();
      unsubPapers();
      unsubChats();
      unsubAnnos();

      if (user) {
        // Save/Sync profile & Check Onboarding
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDocFromServer(userDocRef);
          
          if (!userDocSnap.exists() || !userDocSnap.data()?.onboardingComplete) {
             setNeedsOnboarding(true);
          } else {
             setNeedsOnboarding(false);
          }

          setDoc(
            userDocRef,
            {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "Researcher",
              lastActive: Date.now(),
              createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now(),
            },
            { merge: true },
          );
        } catch (error) {
          console.error("Failed saving user profile:", error);
        }
      }

      if (user && storageMode === "database") {
        // --- PRIVATE PERSISTENT MODE ---

        // Hydrate from localStorage first for instant UI response
        try {
          const cachedFolders = localStorage.getItem(`cosmi_folders_${user.uid}`);
          if (cachedFolders) setFolders(JSON.parse(cachedFolders));
          const cachedPapers = localStorage.getItem(`cosmi_papers_${user.uid}`);
          if (cachedPapers) setPapers(JSON.parse(cachedPapers));
          const cachedTabs = localStorage.getItem(`cosmi_tabs_${user.uid}`);
          if (cachedTabs) setTabs(JSON.parse(cachedTabs));
          const cachedActiveTabId = localStorage.getItem(`cosmi_activeTabId_${user.uid}`);
          if (cachedActiveTabId) setActiveTabId(cachedActiveTabId);
          const cachedMessages = localStorage.getItem(`cosmi_messages_${user.uid}`);
          if (cachedMessages) setMessages(JSON.parse(cachedMessages));
        } catch {}

        loadedUserIdRef.current = user.uid;

        // Load workspace session state from server
        try {
          const sessionDoc = await getDocFromServer(
            doc(db, "users", user.uid, "workspace", "session"),
          );
          if (sessionDoc.exists()) {
            const data = sessionDoc.data();
            if (data.tabs && data.tabs.length > 0) setTabs(data.tabs);
            if (data.activeTabId) setActiveTabId(data.activeTabId);
            if (data.messages) setMessages(data.messages);
          }
        } catch (error) {
          console.error("Failed loading workspace session:", error);
        } finally {
          setIsSessionLoaded(true);
        }

        // Real-time listeners
        const foldersColRef = collection(db, "users", user.uid, "folders");
        unsubFolders = onSnapshot(foldersColRef, (snapshot) => {
          const loadedFolders: FolderItem[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedFolders.push({
              id: doc.id,
              name: data.name || "Untitled Folder",
              createdAt: data.createdAt || Date.now(),
            });
          });
          if (loadedFolders.length > 0) {
            setFolders(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(loadedFolders)) {
                return loadedFolders;
              }
              return prev;
            });
          } else {
            const defaultFolder: FolderItem = { id: "f1", name: "My Research", createdAt: Date.now() };
            setDoc(doc(db, "users", user.uid, "folders", defaultFolder.id), defaultFolder);
          }
        });

        const papersColRef = collection(db, "users", user.uid, "papers");
        unsubPapers = onSnapshot(papersColRef, (snapshot) => {
          const loadedPapers: PaperItem[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedPapers.push({
              author: typeof data.author === "string" ? data.author : String(data.author || ""),
              title: typeof data.title === "string" ? data.title : String(data.title || ""),
              description: typeof data.description === "string" ? data.description : String(data.description || ""),
              url: data.url || "",
              added: data.added || "",
              fullTextStatus: data.fullTextStatus || "",
              viewed: data.viewed || "",
              fileType: data.fileType || "",
              summary: data.summary || "",
              fileId: data.fileId || "",
              mimetype: data.mimetype || "",
              extractedText: data.extractedText || "",
              folderId: data.folderId || "",
              notes: data.notes || "",
            });
          });
          setPapers(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(loadedPapers)) {
              return loadedPapers;
            }
            return prev;
          });
        });

        const chatsColRef = collection(db, "users", user.uid, "chats");
        unsubChats = onSnapshot(chatsColRef, (snapshot) => {
          const loadedChats: Tab[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedChats.push({
              id: doc.id,
              type: "chat",
              title: data.title || "Untitled",
              messages: data.messages || [],
              updatedAt: data.updatedAt || 0,
            });
          });
          const sorted = loadedChats.sort((a, b) => {
            const aTime = Math.max(
              a.updatedAt || 0,
              a.messages && a.messages.length > 0
                ? a.messages[a.messages.length - 1].timestamp
                : 0
            );
            const bTime = Math.max(
              b.updatedAt || 0,
              b.messages && b.messages.length > 0
                ? b.messages[b.messages.length - 1].timestamp
                : 0
            );
            return bTime - aTime;
          });
          setAllChats(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(sorted)) {
              return sorted;
            }
            return prev;
          });
        });

        const annosColRef = collection(db, "users", user.uid, "annotations");
        unsubAnnos = onSnapshot(annosColRef, (snapshot) => {
          const groupedAnnos: Record<string, any[]> = {};
          snapshot.forEach((doc) => {
            const data = doc.data();
            const fileId = data.fileId || "default";
            if (!groupedAnnos[fileId]) groupedAnnos[fileId] = [];
            groupedAnnos[fileId].push({
              id: doc.id,
              fileId,
              text: data.text || "",
              comment: data.comment || "",
              page: data.page || 1,
              color: data.color || "#fef08a",
              timestamp: data.timestamp || Date.now(),
            });
          });
          Object.keys(groupedAnnos).forEach((fileId) => {
            localStorage.setItem(
              `annotations_${fileId}`,
              JSON.stringify(groupedAnnos[fileId]),
            );
          });
          window.dispatchEvent(new Event("annotationsUpdated"));
        });
      } else if (user && storageMode === "local") {
        // --- PRIVATE SECURED LOCAL STORAGE MODE FOR USER ---
        setIsSessionLoaded(true);
        try {
          const cachedFolders = localStorage.getItem(`cosmi_folders_${user.uid}`);
          setFolders(cachedFolders ? JSON.parse(cachedFolders) : [{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          const cachedPapers = localStorage.getItem(`cosmi_papers_${user.uid}`);
          setPapers(cachedPapers ? JSON.parse(cachedPapers) : []);
          const cachedTabs = localStorage.getItem(`cosmi_tabs_${user.uid}`);
          setTabs(cachedTabs ? JSON.parse(cachedTabs) : [{ id: "initial-home", type: "home", title: "Home" }]);
          const cachedActiveTabId = localStorage.getItem(`cosmi_activeTabId_${user.uid}`);
          setActiveTabId(cachedActiveTabId || "initial-home");
          const cachedMessages = localStorage.getItem(`cosmi_messages_${user.uid}`);
          setMessages(cachedMessages ? JSON.parse(cachedMessages) : []);
          const cachedChats = localStorage.getItem(`cosmi_chats_${user.uid}`);
          setAllChats(cachedChats ? JSON.parse(cachedChats) : []);
        } catch {
          setFolders([{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          setPapers([]);
          setTabs([{ id: "initial-home", type: "home", title: "Home" }]);
          setActiveTabId("initial-home");
          setMessages([]);
          setAllChats([]);
        }
        loadedUserIdRef.current = user.uid;
      } else {
        // --- GUEST / OFFLINE MODE ---
        setIsSessionLoaded(true);
        try {
          const cachedFolders = localStorage.getItem(`cosmi_folders_guest`);
          setFolders(cachedFolders ? JSON.parse(cachedFolders) : [{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          const cachedPapers = localStorage.getItem(`cosmi_papers_guest`);
          setPapers(cachedPapers ? JSON.parse(cachedPapers) : []);
          const cachedTabs = localStorage.getItem(`cosmi_tabs_guest`);
          setTabs(cachedTabs ? JSON.parse(cachedTabs) : [{ id: "initial-home", type: "home", title: "Home" }]);
          const cachedActiveTabId = localStorage.getItem(`cosmi_activeTabId_guest`);
          setActiveTabId(cachedActiveTabId || "initial-home");
          const cachedMessages = localStorage.getItem(`cosmi_messages_guest`);
          setMessages(cachedMessages ? JSON.parse(cachedMessages) : []);
          const cachedChats = localStorage.getItem(`cosmi_chats_guest`);
          setAllChats(cachedChats ? JSON.parse(cachedChats) : []);
        } catch {
          setFolders([{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
          setPapers([]);
          setTabs([{ id: "initial-home", type: "home", title: "Home" }]);
          setActiveTabId("initial-home");
          setMessages([]);
          setAllChats([]);
        }
        loadedUserIdRef.current = "guest";
      }
    };

    const syncUserToLocal = (user: any) => {
      if (user) {
        const userToStore = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        localStorage.setItem("cosmi_user_snapshot", JSON.stringify(userToStore));
      } else {
        localStorage.removeItem("cosmi_user_snapshot");
      }
    };

    // Handle login breakout trigger
    // (code removed)

    // Handle Firebase Redirect result (removed as Tauri breakout is preferred)

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setIsAuthLoading(true);
      syncUserToLocal(user);
      setCurrentUser(user);
      currentUserIdRef.current = user ? user.uid : null;
      
      const uid = user ? user.uid : "guest";
      const userCallMe = localStorage.getItem(`cosmi_settings_call_me_${uid}`) || "";
      setCallMe(userCallMe);
      
      await setupListeners(user);

      setIsAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubFolders();
      unsubPapers();
      unsubChats();
      unsubAnnos();
    };
  }, [storageMode]);

  const handleGoogleLogin = async () => {
    // Detect if we are inside Electron or Tauri
    const isElectron = () => typeof window !== "undefined" && (
      (window as any).electron !== undefined || 
      navigator.userAgent.toLowerCase().includes("electron") ||
      (window as any).ipcRenderer !== undefined ||
      (window as any).process?.versions?.electron !== undefined
    );
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    // Use system browser breakout for Tauri and Electron environments
    // because Firebase Auth popup/redirect doesn't support custom desktop protocols or wrappers securely.
    const needsSystemBrowserBreakout = isTauri || isElectron();

    if (needsSystemBrowserBreakout) {
      const redirectUrl = "https://cosmiwise.vercel.app/?google_callback=1";
      if (isElectron()) {
        if ((window as any).electron?.openUrl) {
          (window as any).electron.openUrl(redirectUrl);
        } else {
          window.open(redirectUrl, "_blank");
        }
      } else if (isTauri) {
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(redirectUrl);
        } catch (err) {
          console.error("Tauri breakout failed:", err);
        }
      }
    } else {
      // Normal web behavior: use the popup
      await signInWithPopup(auth, googleProvider);
    }
  };

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleSearchPapers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSynthesis(null);
    try {
      const resp = await fetch(
        `/api/research/papers?q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await resp.json();
      setSearchResults(data.papers || (Array.isArray(data) ? data : []));
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
      const resp = await fetch("/api/research/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers: searchResults, userQuery: searchQuery }),
      });
      const data = await resp.json();
      setSynthesis(data.synthesis);
    } catch (err) {
      console.error("Synthesis failed:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const addPaperToLibrary = async (paper: any) => {
    const authors =
      paper.authors?.map((a: any) => a.name).join(", ") || "Unknown Author";
    const targetFolder = selectedFolderId || folders[0]?.id || "f1";

    // Extract actual text if file exists and it is not a pdf
    let extractedText = "";
    if (paper.fileId) {
      try {
        extractedText = await extractTextFromPdf(`/api/files/${paper.fileId}`);
      } catch (err) {
        console.error(
          "Failed to extract text for paper saved to library:",
          err,
        );
      }
    }

    const newPaper: PaperItem = {
      author: authors,
      title: paper.title,
      description:
        paper.abstract || `Paper from ${paper.venue || "Academic Repository"}`,
      added: "Today",
      fullTextStatus: paper.fileId ? "Mapped" : "Available",
      viewed: "Just now",
      fileType: "Document",
      summary: paper.abstract || "",
      fileId: paper.fileId || "",
      mimetype: paper.mimetype || "",
      extractedText: extractedText,
      folderId: targetFolder,
    };
    dbSetPaper(newPaper);

    // Auto-create and switch to a new document tab with the added document's content
    const newTabId = paper.fileId
      ? `view-${paper.fileId}`
      : `added-${Date.now()}`;

    let initialContent = "";
    const isPdfValue =
      paper.mimetype === "application/pdf" ||
      paper.title.toLowerCase().endsWith(".pdf");
    if (extractedText && !isPdfValue) {
      initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
        <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${paper.title}</h1>
        <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Document File: ${paper.title}</p>
        <div class="h-[1px] bg-zinc-800 mb-6"></div>
        <div class="space-y-4 leading-relaxed">${extractedText
          .split("\n\n")
          .map((p: string) =>
            p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : "",
          )
          .join("")}</div>
      </div>`;
    } else {
      initialContent = `<h3>${paper.title}</h3><p><em>${authors}</em></p><p>${newPaper.description}</p>`;
    }

    setTabs((prev) => {
      // Avoid adding duplicate tabs if already open
      const existing = prev.find((t) => t.title === paper.title);
      if (existing) {
        return prev;
      }
      return [
        ...prev,
        {
          id: newTabId,
          type: "document",
          title: paper.title,
          content: initialContent,
          fileId: paper.fileId || "",
          mimetype: paper.mimetype || "",
          folderId: targetFolder,
        },
      ];
    });

    const existingTab = tabs.find((t) => t.title === paper.title);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      setActiveTabId(newTabId);
    }
  };

  // AI Assistant Chat Messages
  const [allChats, setAllChats] = useState<Tab[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_messages_${uid}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [chatInput, setChatInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      const cached = localStorage.getItem(`cosmi_selected_model_${uid}`) || localStorage.getItem("cosmi_selected_model");
      return cached || "command-a-plus-05-2026";
    } catch {
      return "command-a-plus-05-2026";
    }
  });

  useEffect(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      localStorage.setItem(`cosmi_selected_model_${uid}`, selectedModel);
      localStorage.setItem("cosmi_selected_model", selectedModel);
    } catch {}
  }, [selectedModel, currentUser]);
  const [thinkingLevel, setThinkingLevel] = useState<'Standard' | 'Deep' | 'Instant'>('Standard');
  const [isAgentModelMenuOpen, setIsAgentModelMenuOpen] = useState(false);
  const [isAgentThinkingMenuOpen, setIsAgentThinkingMenuOpen] = useState(false);
  const [isAgentPlusMenuOpen, setIsAgentPlusMenuOpen] = useState(false);
  const [isAgentMoreModelsOpen, setIsAgentMoreModelsOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    return localStorage.getItem("cosmi_settings_web_search") !== "false";
  });
  const [latexEnabled, setLatexEnabled] = useState(() => {
    return localStorage.getItem("cosmi_settings_latex") !== "false";
  });
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(() => {
    return localStorage.getItem("cosmi_settings_auto_draft") !== "false";
  });
  const [callMe, setCallMe] = useState(() => {
    try {
      const cachedRef = localStorage.getItem("cosmi_user_snapshot");
      const uid = cachedRef ? JSON.parse(cachedRef).uid : "guest";
      return localStorage.getItem(`cosmi_settings_call_me_${uid}`) || "";
    } catch {
      return "";
    }
  });
  const [assistantInput, setAssistantInput] = useState("");
  const assistantInputRef = useRef<HTMLTextAreaElement>(null);
  const [agentMentionState, setAgentMentionState] = useState<{
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

  const agentFilteredPapers = papers.filter((p) => {
    if (!p.title) return false;
    return p.title.toLowerCase().includes(agentMentionState.query.toLowerCase());
  });

  const handleAgentTextareaChange = (val: string, selectionStart: number) => {
    setAssistantInput(val);
  };

  const selectAgentPaper = (paper: PaperItem) => {
    if (!agentMentionState.show) return;

    const val = assistantInput;
    const beforeMention = val.slice(0, agentMentionState.startIndex);
    const selectionStart = assistantInputRef.current ? assistantInputRef.current.selectionStart : val.length;
    const afterMention = val.slice(selectionStart);
    const replacement = "";
    const newValue = beforeMention + replacement + afterMention;

    setOnboardingTaskComplete('citation_note');
    setAssistantInput(newValue);
    setAgentMentionState({ show: false, query: "", startIndex: -1, selectedIndex: 0 });

    if (paper.fileId) {
      setAttachedFile({
        fileId: paper.fileId,
        fileName: paper.title,
        mimetype: paper.mimetype || 'application/pdf',
        url: paper.url || ''
      });
    }

    setTimeout(() => {
      if (assistantInputRef.current) {
        assistantInputRef.current.focus();
        const cursorPosition = beforeMention.length + replacement.length;
        assistantInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 50);
  };

  const [isAiTyping, setIsAiTyping] = useState(false);
  const [researchStatus, setResearchStatus] = useState<
    "fetching" | "downloading" | "polishing" | "editor_agent" | null
  >(null);
  const aiWritingTabIdRef = useRef<string | null>(null);
  const [isChatSuggestionsDismissed, setIsChatSuggestionsDismissed] =
    useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(
    null,
  );
  const [attachedFile, setAttachedFile] = useState<{
    fileId: string;
    fileName: string;
    mimetype: string;
    url: string;
  } | null>(null);

  const saveDraftToLibrary = async (tab: Tab) => {
    if (tab.type !== "document") return;

    // We do not auto-save PDF documents as drafts, they are managed via upload/import.
    if (tab.fileId || tab.mimetype === "application/pdf") return;

    const paperTitle =
      tab.title && tab.title.trim() ? tab.title.trim() : "Untitled";
    const paperId = encodeURIComponent(paperTitle).replace(/\./g, "%2E");

    // If the title changed, delete the old document
    if (tab.originalTitle && tab.originalTitle !== paperTitle) {
      if (currentUser && storageMode === "database") {
        const oldPaperId = encodeURIComponent(tab.originalTitle).replace(
          /\./g,
          "%2E",
        );
        try {
          await deleteDoc(
            doc(db, "users", currentUser.uid, "papers", oldPaperId),
          );
        } catch (err) {
          console.error("Failed to delete renamed draft", err);
        }
      }

      // Update tab's originalTitle, title, and content so the sync effect doesn't try to overwrite the editor
      setTabs((prev) => {
        let changed = false;
        const nextTabs = prev.map((t) => {
          if (t.id === tab.id) {
            const hasChanged = t.originalTitle !== paperTitle || t.title !== paperTitle || t.content !== tab.content;
            if (!hasChanged) return t;
            changed = true;
            return { ...t, originalTitle: paperTitle, title: paperTitle, content: tab.content };
          }
          return t;
        });
        return changed ? nextTabs : prev;
      });
    }

    const draftPaper: PaperItem = {
      author: "Workspace Draft",
      title: paperTitle,
      description:
        (tab.content || "").substring(0, 100).replace(/<[^>]*>/g, "") + "...",
      added: "Just now",
      fullTextStatus: "Draft",
      viewed: "Active",
      fileType: "Document",
      summary: tab.content || "",
      folderId: tab.folderId || folders[0]?.id || "f1",
      fileId: tab.id,
    };

    if (currentUser && storageMode === "database") {
      const path = `users/${currentUser.uid}/papers/${paperId}`;
      try {
        await setDoc(
          doc(db, "users", currentUser.uid, "papers", paperId),
          draftPaper,
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    // Reflect the change locally in the papers array
    setPapers((prev) => {
      const filtered = prev.filter(
        (p) =>
          encodeURIComponent(p.title).replace(/\./g, "%2E") !== paperId &&
          p.title !== tab.originalTitle,
      );
      const newPapers = [draftPaper, ...filtered];
      if (JSON.stringify(prev) === JSON.stringify(newPapers)) {
        return prev;
      }
      return newPapers;
    });
  };

  const saveChatToLibrary = React.useCallback(async (targetUserId: string, chatTab: Tab) => {
    if (!chatTab || chatTab.type !== "chat") return;
    
    const uid = currentUser ? currentUser.uid : "guest";
    
    if (storageMode === "database" && currentUser) {
      const path = `users/${targetUserId}/chats/${chatTab.id}`;
      try {
        const chatDocRef = doc(db, "users", targetUserId, "chats", chatTab.id);
        await setDoc(
          chatDocRef,
          {
            title: chatTab.title || "Untitled",
            messages: chatTab.messages || [],
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }
    
    // Always update local state for immediate feedback
    setAllChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatTab.id);
      const updatedChat = {
        ...chatTab,
        messages: chatTab.messages || [],
        updatedAt: Date.now(),
      };
      const next = [updatedChat, ...filtered];
      
      // Also update localStorage for the specific user/guest as a backup
      const uid = currentUser ? currentUser.uid : "guest";
      localStorage.setItem(`cosmi_chats_${uid}`, JSON.stringify(next));
      
      return next;
    });
  }, [currentUser, storageMode]);

  const createNewChat = () => {
    const newId = `chat-${Date.now()}`;
    const newChatTab: Tab = {
      id: newId,
      type: "chat",
      title: "New chat",
      messages: [],
    };
    setTabs((prev) => [...prev, newChatTab]);
    setActiveTabId(newId);
    setActiveAssistantTabId(newId);
    setMessages([]);
    saveChatToLibrary(currentUser?.uid || "guest", newChatTab);
    return newId;
  };

  const updateChatMessages = (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
    skipTabsUpdate = true,
  ) => {
    let next: ChatMessage[];
    setMessages((prev) => {
      next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });

    // Handle tab update OUTSIDE of setMessages callback to avoid nested state updates
    if (!skipTabsUpdate) {
      // Use setTimeout 0 to ensure this runs after setMessages has queued its update
      // and we are not in the middle of another state update cycle
      setTimeout(() => {
        let targetTabId =
          activeAssistantTabIdRef.current || activeTabIdRef.current;
        const currentTab = tabsRef.current.find((t) => t.id === targetTabId);
        let foundChat = false;

        if (!currentTab || currentTab.type !== "chat") {
          const firstChat = tabsRef.current.find((t) => t.type === "chat");
          if (firstChat) {
            targetTabId = firstChat.id;
            foundChat = true;
          }
        } else {
          foundChat = true;
        }

        let newChatId = "";
        if (!foundChat) {
          newChatId = `chat-${Date.now()}`;
          targetTabId = newChatId;
          setActiveAssistantTabId(newChatId);
        }

        const finalTargetId = targetTabId;

        setTabs((prevTabs) => {
          let finalTabs = prevTabs;
          
          if (!foundChat) {
            // Double check if a chat tab snuck in
            const firstChat = prevTabs.find((t) => t.type === "chat");
            if (!firstChat) {
              const newChatTab: Tab = {
                id: finalTargetId,
                type: "chat",
                title: "New chat",
                messages: next,
              };
              finalTabs = [...prevTabs, newChatTab];
            }
          }

          const existingTab = finalTabs.find(t => t.id === finalTargetId);
          if (existingTab && JSON.stringify(existingTab.messages) === JSON.stringify(next)) {
            return prevTabs; // No change needed
          }

          return finalTabs.map((t) =>
            t.id === finalTargetId ? { ...t, messages: next } : t,
          );
        });
        
        // Save to persistent chat library after state has time to settle
        setTimeout(() => {
          const chatTab = tabsRef.current.find((t) => t.id === finalTargetId);
          if (chatTab) {
            saveChatToLibrary(currentUser?.uid || "guest", chatTab);
          }
        }, 50);
      }, 0);
    }
  };

  useEffect(() => {
    const handleNewChat = () => {
      const newId = `chat-${Date.now()}`;
      const newChatTab: Tab = {
        id: newId,
        type: "chat",
        title: "New chat",
        messages: [],
      };
      setTabs((prev) => [...prev, newChatTab]);
      setActiveTabId(newId);
      setActiveAssistantTabId(newId);
      setMessages([]);
      saveChatToLibrary(currentUser?.uid || "guest", newChatTab);
    };

    window.addEventListener("request-new-chat", handleNewChat);
    return () => {
      window.removeEventListener("request-new-chat", handleNewChat);
    };
  }, [currentUser?.uid, saveChatToLibrary, setTabs, setActiveTabId, setActiveAssistantTabId, setMessages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollPositionsRef = useRef<Record<string, number>>({});
  const lastActiveAssistantTabIdRef = useRef<string | null>(activeAssistantTabId);
  const previousMessageCountRef = useRef<number>(messages?.length || 0);

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

  // Auto Scroll Chat & Preserve Position over Tabs
  React.useLayoutEffect(() => {
    if (activeAssistantTabId !== lastActiveAssistantTabIdRef.current) {
      // Tab switched: restore scroll position or go to bottom
      lastActiveAssistantTabIdRef.current = activeAssistantTabId;
      if (activeAssistantTabId && chatScrollPositionsRef.current[activeAssistantTabId] !== undefined) {
        if (chatScrollContainerRef.current) {
          chatScrollContainerRef.current.scrollTop = chatScrollPositionsRef.current[activeAssistantTabId];
        }
      } else {
        scrollToBottom(true);
      }
    } else {
      const length = messages?.length || 0;
      if (length > previousMessageCountRef.current) {
        scrollToBottom(false);
      } else if (isAiTyping) {
        scrollToBottom(true);
      }
    }
    previousMessageCountRef.current = messages?.length || 0;
  }, [messages, activeAssistantTabId, isAiTyping, scrollToBottom]);

  // Presence reporting loop has been removed

  // Sync workspace session to Firestore periodically when changes occur
  useEffect(() => {
    if (!isSessionLoaded || !tabs || tabs.length === 0) return;

    if (currentUser && storageMode === "database") {
      if (loadedUserIdRef.current !== currentUser.uid) return; // Prevent leak!
      const handler = setTimeout(() => {
        const sessionRef = doc(
          db,
          "users",
          currentUser.uid,
          "workspace",
          "session",
        );
        const cleanTabs = JSON.parse(JSON.stringify(tabs));
        const cleanMessages = JSON.parse(JSON.stringify(messages));

        setDoc(
          sessionRef,
          {
            tabs: cleanTabs,
            activeTabId,
            messages: cleanMessages,
          },
          { merge: true },
        ).catch((err) => console.error("Workspace sync failed:", err));
      }, 1500);
      return () => clearTimeout(handler);
    }
  }, [tabs, activeTabId, messages, currentUser, isSessionLoaded]);

  // Synchronize workspace changes to LocalStorage instantly
  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    if (loadedUserIdRef.current !== uid) return; // Prevent leak!
    localStorage.setItem(`cosmi_folders_${uid}`, JSON.stringify(folders));
  }, [folders, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    if (loadedUserIdRef.current !== uid) return; // Prevent leak!
    localStorage.setItem(`cosmi_papers_${uid}`, JSON.stringify(papers));
  }, [papers, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    if (loadedUserIdRef.current !== uid) return; // Prevent leak!
    localStorage.setItem(`cosmi_tabs_${uid}`, JSON.stringify(tabs));
  }, [tabs, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    if (loadedUserIdRef.current !== uid) return; // Prevent leak!
    localStorage.setItem(`cosmi_activeTabId_${uid}`, activeTabId);
  }, [activeTabId, currentUser]);

  useEffect(() => {
    const uid = currentUser ? currentUser.uid : "guest";
    if (loadedUserIdRef.current !== uid) return; // Prevent leak!
    localStorage.setItem(`cosmi_messages_${uid}`, JSON.stringify(messages));
  }, [messages, currentUser]);

  // PDF Annotation Helpers & Highlight Engine
  const highlightPDFSpans = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.id) return;
    const fileKey = activeTab.fileId || activeTab.id;
    const saved = localStorage.getItem(`annotations_${fileKey}`);
    if (!saved) return;
    try {
      const annos = JSON.parse(saved);
      if (!annos || annos.length === 0) return;

      annos.forEach((anno: any) => {
        const pageContainer = document.getElementById(`pdf-page-${anno.page}`);
        if (!pageContainer) return;

        const textLayer = pageContainer.querySelector(
          ".react-pdf__Page__textContent",
        );
        if (!textLayer) return;

        const spans = textLayer.querySelectorAll("span");
        spans.forEach((span: any) => {
          if (
            span.textContent &&
            span.textContent.includes(anno.text) &&
            !span.dataset.annotated
          ) {
            span.dataset.annotated = "true";
            const originalHTML = span.innerHTML;
            const highlightColor = anno.color || "#fef08a";
            span.innerHTML = originalHTML
              .split(anno.text)
              .join(
                `<mark style="background-color: ${highlightColor} !important; color: transparent !important; -webkit-text-fill-color: transparent !important; opacity: 0.55 !important; mix-blend-mode: multiply !important; border-radius: 2px; padding: 1px 0px; box-shadow: none;">${anno.text}</mark>`,
              );
          }
        });
      });
    } catch (e) {
      console.warn("Error highlighting spans", e);
    }
  };

  useEffect(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    let intervalId: any;
    if (activeTab && activeTab.mimetype === "application/pdf") {
      highlightPDFSpans();
      intervalId = setInterval(highlightPDFSpans, 1500);
    }

    const handleUpdate = () => {
      highlightPDFSpans();
    };

    window.addEventListener("annotationsUpdated", handleUpdate);
    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("annotationsUpdated", handleUpdate);
    };
  }, [activeTabId, pdfNumPages]);

  useEffect(() => {
    if (!pdfNumPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that is intersecting the most
        let maxRatio = 0;
        let mostVisibleId = null;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisibleId = entry.target.id;
          }
        });

        if (mostVisibleId) {
          const pageNum = parseInt(
            (mostVisibleId as string).replace("pdf-page-", ""),
          );
          if (!isNaN(pageNum)) {
            setCurrentPdfPage(pageNum);
          }
        }
      },
      {
        root: document.getElementById("pdf-scroll-container"),
        rootMargin: "0px",
        threshold: [0.1, 0.4, 0.6, 0.8],
      },
    );

    // We delay the observation to let the DOM settle
    const timeout = setTimeout(() => {
      const pageContainers = document.querySelectorAll(".pdf-page-wrapper");
      pageContainers.forEach((container) => observer.observe(container));
    }, 500);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [pdfNumPages, activeTabId]);

  const findPageFromNode = (node: Node | null): number | null => {
    let current: HTMLElement | null = node as HTMLElement;
    while (current) {
      if (current.id && current.id.startsWith("pdf-page-")) {
        const num = parseInt(current.id.replace("pdf-page-", ""));
        if (!isNaN(num)) return num;
      }
      current = current.parentElement;
    }
    return null;
  };

  const handlePdfMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectionText(text);

      const pageNum =
        findPageFromNode(selection.anchorNode) ||
        findPageFromNode(selection.focusNode);
      setSelectedPageNum(pageNum);
    } else {
      const target = e.target as HTMLElement;
      if (
        target &&
        !target.closest(".pdf-annotation-popover") &&
        !target.closest(".pdf-context-menu-popover")
      ) {
        setSelectionText("");
        setSelectionPos(null);
        setSelectedPageNum(null);
        setCommentDraft("");
      }
    }
  };

  const handlePdfContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate smart positioning for the context menu to keep it within viewport
    const menuWidth = 220;
    const menuHeight = 580; // Larger estimate for more items
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // Bottom boundary check - if x is still above menu height, we might want to flip it
    if (y < 0) y = 10;

    setPdfContextMenu({ x, y });

    // Also try to capture selection if any (in case mouseup didn't fire as expected)
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectionText(text);
      const pageNum =
        findPageFromNode(selection.anchorNode) ||
        findPageFromNode(selection.focusNode);
      setSelectedPageNum(pageNum);
    }
  };

  // Word count helper
  const wordCount = (() => {
    const rawText =
      `${documentTitle} ${folderName} ${savedNoteName} ` +
      papers.map((p) => `${p.author} ${p.title} ${p.description}`).join(" ");
    const cleaned = rawText.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    return cleaned.split(/\s+/).filter(Boolean).length;
  })();

  const [documentContent, setDocumentContent] = useState(() => {
    return "";
  });

  // When activeTabId, tabs, or isSessionLoaded changes, pull the corresponding tab's values and title into states and the editor
  useEffect(() => {
    if (ignoreNextTabSyncRef.current === activeTabId) {
      ignoreNextTabSyncRef.current = null;
      loadedTabIdRef.current = activeTabId;
      return;
    }
    // Always clear if we didn't match, so it doesn't leak to future unrelated tabs
    if (ignoreNextTabSyncRef.current !== null) {
      ignoreNextTabSyncRef.current = null;
    }
    
    const targetTab = tabs.find((t) => t.id === activeTabId);
    if (!targetTab) return;

    const isDocNotPdf =
      targetTab.type === "document" &&
      (!targetTab.fileId ||
        !(
          targetTab.mimetype === "application/pdf" ||
          targetTab.title.toLowerCase().endsWith(".pdf")
        ));

    if (isDocNotPdf) {
      const newTitle = targetTab.title || "Untitled";
      const newContent = targetTab.content || "";
      
      if (!isAiTyping) {
        if (documentTitle !== newTitle) setDocumentTitle(newTitle);
        if (documentContent !== newContent) setDocumentContent(newContent);
        if (docSaveStatus !== "saved") setDocSaveStatus("saved");
        if (editorRef.current && (document.activeElement !== editorRef.current || loadedTabIdRef.current !== activeTabId)) {
          if (editorRef.current.innerHTML !== (targetTab.content || "")) {
            editorRef.current.innerHTML = targetTab.content || "";
            lastContentRef.current = targetTab.content || "";
          }
        }
      }
      
      if (chatInput !== "") setChatInput("");
    } else if (targetTab.type === "chat") {
      const tabMessages = targetTab.messages || [];
      // Synchronize messages state ONLY if it actually differs and we aren't currently typing (streaming)
      // We exclude messages from dependencies to avoid infinite loops when updating messages
      // Using functional update to ensure we check against the very latest state
      if (!isAiTyping) {
        setMessages(prev => {
          if (JSON.stringify(tabMessages) !== JSON.stringify(prev)) {
            return tabMessages;
          }
          return prev;
        });
      }

      if (activeAssistantTabId !== targetTab.id) {
        setActiveAssistantTabId(targetTab.id);
      }
      const newChatInput = targetTab.chatInput || "";
      if (chatInput !== newChatInput) setChatInput(newChatInput);
    } else {
      if (chatInput !== "") setChatInput("");
      if (activeTabId !== "initial-home") {
        const title = targetTab.title || "Untitled";
        if (documentTitle !== title) setDocumentTitle(title);
        if (documentContent !== "") setDocumentContent("");
        if (docSaveStatus !== "saved") setDocSaveStatus("saved");
        if (editorRef.current && (document.activeElement !== editorRef.current || loadedTabIdRef.current !== activeTabId)) {
          if (editorRef.current.innerHTML !== "") {
            editorRef.current.innerHTML = "";
            lastContentRef.current = "";
          }
        }
      }
    }
    loadedTabIdRef.current = activeTabId;
  }, [activeTabId, tabs, isSessionLoaded, isAiTyping, activeAssistantTabId]);

  // Debounced auto-save of active document draft to Firestore/LocalStorage
  useEffect(() => {
    if (docSaveStatus !== "saving") return;

    if (!autoDraftEnabled) {
      // If auto-draft is disabled, we just show "saved" locally since we wait for blur events
      setDocSaveStatus("saved");
      return;
    }

    const timer = setTimeout(async () => {
      const currentTab = tabs.find((t) => t.id === activeTabId);
      if (
        currentTab &&
        currentTab.type === "document" &&
        (!currentTab.fileId ||
          !(
            currentTab.mimetype === "application/pdf" ||
            currentTab.title.toLowerCase().endsWith(".pdf")
          ))
      ) {
        try {
          // IMPORTANT: We must save the LATEST state values, not what's currently in the tabs array
          // since the tabs array might be lagging behind the editor's local state.
          await saveDraftToLibrary({
            ...currentTab,
            title: documentTitle,
            content: documentContent
          });
        } catch (err) {
          console.error("Auto-save failed to update paper draft:", err);
        }
      }
      setDocSaveStatus("saved");
    }, 400); // 400ms debounce for fast and modern response

    return () => clearTimeout(timer);
  }, [docSaveStatus, documentTitle, documentContent, activeTabId, tabs]);

  // Helper to convert Markdown to HTML for the editor
  const markdownToHtml = (markdown: string) => {
    if (!markdown) return "";
    try {
      // Clean JSON leak and replace literal escaped newlines with actual newline characters
      const cleaned = cleanJsonLeakFront(markdown);
      let formattedMarkdown = cleaned.replace(/\\n/g, "\n");

      // Attempt to add spacing to massive walls of text
      if (
        formattedMarkdown.length > 500 &&
        !formattedMarkdown.includes("\n\n")
      ) {
        formattedMarkdown = formatAbstractText(formattedMarkdown);
      }

      // Trim outer whitespace so that heading tags (like ## Introduction)
      // placed at the start/ends are parsed as actual headings, not inline text.
      const trimmedMarkdown = preprocessLaTeX(formattedMarkdown.trim());

      const markedInstance = new Marked();
      if (latexEnabled) {
        markedInstance.use(markedKatex({ throwOnError: false, displayMode: true }));
      }
      const htmlText = markedInstance.parse(trimmedMarkdown, {
        gfm: true,
        breaks: false,
      }) as string;
      return linkifyHtml(htmlText);
    } catch (e) {
      console.error("Markdown conversion failed", e);
      return linkifyHtml(markdown.replace(/\\n/g, "\n"));
    }
  };

  const handlePaperClick = (paper: PaperItem) => {
    const existingTab = tabs.find((t) => t.title === paper.title);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTabId = paper.fileId
        ? `view-${paper.fileId}`
        : `view-${Date.now()}`;

      let initialContent = "";
      const isPdfValue =
        paper.mimetype === "application/pdf" ||
        paper.title.toLowerCase().endsWith(".pdf");
      if (paper.extractedText && !isPdfValue) {
        initialContent = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
          <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${paper.title}</h1>
          <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Document File: ${paper.title}</p>
          <div class="h-[1px] bg-zinc-800 mb-6"></div>
          <div class="space-y-4 leading-relaxed">${paper.extractedText
            .split("\n\n")
            .map((p) => (p.trim() ? `<p>${p.replace(/\n/g, "<br/>")}</p>` : ""))
            .join("")}</div>
        </div>`;
      } else {
        initialContent = markdownToHtml(
          paper.summary || paper.description || "",
        );
      }

      setTabs((prev) => [
        ...prev,
        {
          id: newTabId,
          type: "document",
          title: paper.title,
          content: initialContent,
          fileId: paper.fileId,
          mimetype: paper.mimetype,
          folderId: paper.folderId,
        },
      ]);
      setActiveTabId(newTabId);
    }
  };

  // intel fallback response generator for offline or key-missing states
  const getFallbackResponse = React.useCallback(
    (query: string): { text: string; suggestion?: any } => {
      const lowercase = query.toLowerCase();

      // Check for inline edits from the user
      if (lowercase.includes("rename") || lowercase.includes("change title")) {
        const newTitleMatch = query.match(
          /(?:rename|change title|title to) ["']?(.+?)["']?$/i,
        );
        const title = newTitleMatch
          ? newTitleMatch[1]
          : `Updated Title - ${new Date().toLocaleTimeString()}`;
        return {
          text: `I have updated the document title to "${title}" as you requested.`,
          suggestion: { type: "edit_document", title: title },
        };
      }

      if (
        lowercase.includes("remove") ||
        lowercase.includes("delete") ||
        lowercase.includes("clear")
      ) {
        return {
          text: `I've cleared out the requested section as directed.`,
          suggestion: {
            type: "edit_document",
            replaceContent: "Cleared workspace...",
          },
        };
      }

      if (
        lowercase.includes("add") ||
        lowercase.includes("draft") ||
        lowercase.includes("write")
      ) {
        return {
          text: `I have drafted and inserted a new academic synthesis section directly into your document.`,
          suggestion: {
            type: "edit_document",
            appendContent:
              "\n\nScholarly consensus indicates that cognitive consolidation is a highly physical, lifestyle-dependent adaptation. It requires both cortical neurodevelopmental responsiveness and striatal automation pathways, which are actively catalyzed by aerobic and cognitive stressors.",
          },
        };
      }

      if (
        lowercase.includes("hi") ||
        lowercase.includes("hello") ||
        lowercase.includes("hey") ||
        lowercase.includes("help") ||
        lowercase.includes("greet")
      ) {
        return {
          text: `I'm ready to help you crush your research! If you have any source material (like PDFs or notes), click the paperclip icon inside the chat box or use the "Plus" button in the Workspace sidebar to add them. 

I can help you:
1. **Analyze Sources**: Pull out key arguments and data points from your papers.
2. **Draft Content**: Write high-quality, long-form academic text.
3. **Structure Outlines**: Organize your thoughts into a logical flow.

What's on your mind?`,
        };
      }

      return {
        text: `I'm all set to help you with your project!
 
You haven't added any sources to this workspace yet. Feel free to upload your research papers or drop some notes in the "Notes" section. 
 
Once you have content, I can help you draft sections, summarize findings, or format your bibliography in APA, MLA, or Chicago style.`,
      };
    },
    [],
  );

  const highlightTextOnPage = React.useCallback((pageId: string, searchStr: string) => {
    const pageEl = document.getElementById(pageId);
    if (!pageEl) return;

    const elementsToReset = pageEl.querySelectorAll("[data-highlighted='true']");
    elementsToReset.forEach((el: any) => {
      el.style.backgroundColor = "";
      el.removeAttribute("data-highlighted");
    });

    if (!searchStr || searchStr.trim().length < 4) {
      pageEl.style.transition = "background-color 0.5s ease";
      pageEl.style.backgroundColor = "rgba(224, 207, 184, 0.15)";
      setTimeout(() => {
        pageEl.style.backgroundColor = "";
      }, 4000);
      return;
    }

    const normalizedSearch = searchStr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (normalizedSearch.length < 4) return;

    const targets = pageEl.querySelectorAll("p, span, div.textLayer > span, li");
    let bestMatch: HTMLElement | null = null;
    let bestScore = 0;

    targets.forEach((el: any) => {
      const text = el.textContent || "";
      const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
      if (!normalizedText.trim()) return;

      const searchWords = normalizedSearch.split(" ");
      let matches = 0;
      searchWords.forEach((word) => {
        if (word && normalizedText.includes(word)) {
          matches++;
        }
      });

      const score = matches / searchWords.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    });

    if (bestMatch && bestScore > 0.25) {
      const targetEl = bestMatch as HTMLElement;
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      targetEl.style.transition = "background-color 0.5s ease";
      targetEl.style.backgroundColor = "rgba(224, 207, 184, 0.35)";
      targetEl.setAttribute("data-highlighted", "true");
      
      setTimeout(() => {
        targetEl.style.backgroundColor = "";
        targetEl.removeAttribute("data-highlighted");
      }, 6000);
    } else {
      pageEl.style.transition = "background-color 0.5s ease";
      pageEl.style.backgroundColor = "rgba(224, 207, 184, 0.15)";
      setTimeout(() => {
        pageEl.style.backgroundColor = "";
      }, 4000);
    }
  }, []);

  const handleCitationClick = React.useCallback(
    (page: number, title: string, contextText?: string) => {
      const normalizedTarget = title.replace(/_/g, " ").trim().toLowerCase();

      // 1. Try to find a matching tab
      let targetTab = tabs.find((t) => {
        if (!t.title) return false;
        const normalizedTabTitle = t.title
          .replace(/_/g, " ")
          .trim()
          .toLowerCase();
        return (
          normalizedTabTitle.includes(normalizedTarget) ||
          normalizedTarget.includes(normalizedTabTitle)
        );
      });

      if (targetTab) {
        if (activeTabId !== targetTab.id) {
          setActiveTabId(targetTab.id);
        }

        // Wait for tab transfer then scroll to target page id element
        setTimeout(() => {
          const pageEl = document.getElementById(`pdf-page-${page}`);
          if (pageEl) {
            pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
            if (contextText) {
              highlightTextOnPage(`pdf-page-${page}`, contextText);
            } else {
              pageEl.style.transition = "background-color 0.5s ease";
              pageEl.style.backgroundColor = "rgba(224, 207, 184, 0.15)";
              setTimeout(() => {
                pageEl.style.backgroundColor = "";
              }, 4000);
            }
          }
        }, 500);
      } else {
        // 2. Try to locate the paper in the library/papers state list and load it dynamically
        const matchedPaper = papers.find((p) => {
          if (!p.title) return false;
          const normalizedPaperTitle = p.title
            .replace(/_/g, " ")
            .trim()
            .toLowerCase();
          return (
            normalizedPaperTitle.includes(normalizedTarget) ||
            normalizedTarget.includes(normalizedPaperTitle)
          );
        });

        if (matchedPaper) {
          handlePaperClick(matchedPaper);
          setTimeout(() => {
            const pageEl = document.getElementById(`pdf-page-${page}`);
            if (pageEl) {
              pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
              if (contextText) {
                highlightTextOnPage(`pdf-page-${page}`, contextText);
              } else {
                pageEl.style.transition = "background-color 0.5s ease";
                pageEl.style.backgroundColor = "rgba(224, 207, 184, 0.15)";
                setTimeout(() => {
                  pageEl.style.backgroundColor = "";
                }, 4000);
              }
            }
          }, 800);
        }
      }
    },
    [tabs, activeTabId, papers, highlightTextOnPage],
  );

  // Sending chat messages
  const handleEditLastPrompt = async (newContent: string) => {
    const lastUserIdx = [...messages].map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;

    const remainingMessages = messages.slice(0, lastUserIdx);
    const originalAttachment = messages[lastUserIdx]?.attachment;

    // Trigger handleSendMessage using overrideMessages and overrideAttachment
    await handleSendMessage(newContent, { 
      overrideMessages: remainingMessages,
      overrideAttachment: originalAttachment
    });
  };

  const handleSendMessage = async (
    customText?: string,
    options: { 
      isHidden?: boolean; 
      fromSidePanel?: boolean; 
      overrideMessages?: ChatMessage[]; 
      overrideAttachment?: any;
    } = {},
  ) => {
    let textToSend = "";
    if (customText) {
      textToSend = customText;
    } else {
      const isFromAssistant =
        options.fromSidePanel || activeTab.type !== "chat";
      textToSend = isFromAssistant ? assistantInput : chatInput;
    }

    if (!textToSend.trim()) return;

    if (activeTab.fileId) {
      setOnboardingTaskComplete('chat_with_file');
    }
    if (activeTab.type === "chat" && activeTab.folderId) {
      setOnboardingTaskComplete('folder_chat');
    }

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
      isHidden: options.isHidden ?? false,
      attachment: options.overrideAttachment !== undefined ? options.overrideAttachment : (attachedFile ? { ...attachedFile } : undefined),
    };

    setAttachedFile(null);

    if (options.overrideMessages) {
      updateChatMessages([...options.overrideMessages, userMessage], false);
    } else {
      updateChatMessages((prev) => [...prev, userMessage], false);
    }
    if (!customText) {
      const isFromAssistant =
        options.fromSidePanel || activeTab.type !== "chat";
      if (isFromAssistant) {
        setAssistantInput("");
      } else {
        setChatInput("");
        setTabs((prev) => {
          const updated = prev.map((t) => (t.id === activeTabId ? { ...t, chatInput: "" } : t));
          if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
          return updated;
        });
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAiTyping(true);

    // Generate a title for this chat session EARLIER if it's currently "Untitled" or "New chat"
    const currentTabId = activeTabIdRef.current;
    const currentTab = tabsRef.current.find((t) => t.id === currentTabId);
    if (
      currentTab &&
      currentTab.type === "chat" &&
      (currentTab.title === "Untitled" || currentTab.title === "New chat" || currentTab.title === "New Chat")
    ) {
      // Fire and forget (don't await) so it runs in parallel with the main stream
      fetch("/api/research/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userQuery: textToSend }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((titleData) => {
          if (titleData?.title) {
            const newTitle = titleData.title;
            
            // 1. Update Tabs
            setTabs((prev) =>
              prev.map((t) =>
                t.id === currentTabId ? { ...t, title: newTitle } : t,
              ),
            );

            // 2. Update allChats for immediate sidebar feedback
            setAllChats((prev) => {
              const filtered = prev.filter((c) => c.id !== currentTabId);
              const existingChat = prev.find((c) => c.id === currentTabId);
              if (!existingChat) return prev;
              
              const updatedChat = {
                ...existingChat,
                title: newTitle,
                updatedAt: Date.now(),
              };
              return [updatedChat, ...filtered];
            });

            // 3. Persist to Firestore/LocalStorage
            const updatedTab = { ...currentTab, title: newTitle };
            saveChatToLibrary(currentUser?.uid || "guest", updatedTab).catch(
              console.error,
            );
          }
        })
        .catch((errTitle) =>
          console.error("Failed to generate title", errTitle),
        );
    }

    try {
      // Load user customized styles/instructions from localStorage dynamically
      const localInstructions = localStorage.getItem("cosmi_settings_system_instructions") || "";
      const localExplainStyle = localStorage.getItem("cosmi_settings_explain_style") || "Standard";
      const localWriteStyle = localStorage.getItem("cosmi_settings_write_style") || "Standard";
      const localPersonality = localStorage.getItem("cosmi_settings_personality") || "Success Student Mentor";
      const localFullName = localStorage.getItem("cosmi_settings_full_name") || "";
      const localWorkType = localStorage.getItem("cosmi_settings_work_desc") || "Other";

      // Try hitting our real server-side Gemini research chat endpoint!
      const finalAttachment = options.overrideAttachment !== undefined ? options.overrideAttachment : attachedFile;
      const currentAttachment = finalAttachment ? {
        fileId: finalAttachment.fileId,
        fileName: finalAttachment.fileName,
        mimetype: finalAttachment.mimetype,
        url: finalAttachment.url
      } : null;

      const response = await fetch("/api/research/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...(options.overrideMessages || messages), userMessage]
            .slice(-20)
            .map((m) => ({ 
              role: m.role, 
              content: m.content,
              attachment: m.attachment ? { fileId: m.attachment.fileId, fileName: m.attachment.fileName, mimetype: m.attachment.mimetype } : undefined
            })),
          model: selectedModel,
          thinkingLevel: thinkingLevel,
          webSearch: webSearchEnabled,
          attachment: currentAttachment,
          explainStyle: localExplainStyle,
          writeStyle: localWriteStyle,
          personalityProfile: localPersonality,
          customInstructions: localInstructions,
          userFullName: localFullName,
          userWorkType: localWorkType,
          context: {
            notes: [
              `Document Title: ${documentTitle}`,
              `Saved under folder: ${folderName}`,
              `Note context: ${savedNoteName}`,
            ],
            citations: papers.map((p, idx) => ({
              title: p.title,
              authors: p.author,
              fileId: p.fileId,
              source: "Academic Import Database",
            year: p.author?.match(/\d{4}/)?.[0] || "2023",
              format: "APA",
              fullText:
                idx < 15
                  ? (p.extractedText || p.summary || "").substring(0, 15000)
                  : (p.summary || "").substring(0, 3000),
            })),
            outline: [
              {
                id: "sec-main",
                level: 1,
                title: documentTitle,
                points: [folderName, savedNoteName],
                draftContent: documentContent,
                linkedCitations: [],
              },
            ],
          },
        }),
        signal: controller.signal,
      });

      // Clear the uploader uis instantly after starting request
      setAttachedFile(null);

      if (!response.ok) {
        throw new Error("API server returned status " + response.status);
      }

      assistantMessageIdRef.current = String(Date.now() + 1);
      updateChatMessages(
        (prev) => [
          ...prev,
          {
            id: assistantMessageIdRef.current!,
            role: "assistant",
            content: "",
            thought: "",
            timestamp: Date.now(),
          },
        ],
        false,
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let hasSwitchedToDoc = false;
      let targetTabIdForAi: string | undefined;
      let streamBuffer = "";
      let hasTriggeredDownloadPaper = false;
      let lastGeneratedHtml = "";
      let lastGeneratedTitle = "";

      aiWritingTabIdRef.current = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          // Keep the last incomplete line in the buffer
          streamBuffer = lines.pop() || "";

          if (lines.length > 0) {
            updateChatMessages((prev) => prev); // Final update to sync tabs
          }

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (trimmedLine.startsWith("data: ")) {
              const data = trimmedLine.slice(6).trim();
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.status === "editor_agent") {
                  setResearchStatus("editor_agent");
                } else if (parsed.status === "editor_agent_done") {
                  setResearchStatus(null);
                }
                if (parsed.groundingMetadata) {
                  updateChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageIdRef.current
                        ? { ...m, groundingMetadata: parsed.groundingMetadata }
                        : m,
                    ),
                  );
                }
                if (parsed.text) {
                  accumulatedText += parsed.text;

                  // Extract <chat>
                  const {
                    thought,
                    chat,
                    title: parsedTitle,
                    replaceContent: parsedContent,
                    searchRealPapersQuery,
                  } = parseAssistantResponse(accumulatedText);

                  if (chat !== undefined) {
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageIdRef.current
                          ? { ...m, content: chat }
                          : m,
                      ),
                    );
                  }

                  if (thought !== undefined) {
                    updateChatMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageIdRef.current
                          ? { ...m, thought: thought }
                          : m,
                      ),
                    );
                  }

                  if (parsedTitle) {
                    setDocumentTitle(parsedTitle);
                    lastGeneratedTitle = parsedTitle;
                  }

                  // Process real paper search
                  if (
                    searchRealPapersQuery &&
                    accumulatedText
                      .toLowerCase()
                      .includes("</searchrealpapers>") &&
                    !hasTriggeredDownloadPaper
                  ) {
                    hasTriggeredDownloadPaper = true;
                    setResearchStatus("fetching");
                    try {
                      fetch("/api/search-arxiv", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: searchRealPapersQuery }),
                      })
                        .then((res) => res.json())
                        .then(async (resData) => {
                          if (resData.success && resData.papers) {
                            setOnboardingTaskComplete('search_papers');
                            setResearchStatus("downloading");
                            const newPapers = await Promise.all(
                              resData.papers.map(async (p: any) => {
                                if (p.fileId) setResearchStatus("polishing");
                                return {
                                  title: p.title,
                                  author: p.author,
                                  description: p.abstract,
                                  url: p.url,
                                  added: "Today",
                                  fullTextStatus: p.fileId
                                    ? "Mapped"
                                    : "Link Only",
                                  viewed: "Yes",
                                  fileType: "Document",
                                  summary: p.abstract || "",
                                  fileId: p.fileId,
                                  mimetype: p.mimetype || "application/pdf",
                                  extractedText: p.fileId
                                    ? await extractTextFromPdf(
                                        `/api/files/${p.fileId}`,
                                      )
                                    : "",
                                  folderId:
                                    selectedFolderId || folders[0]?.id || "f1",
                                };
                              }),
                            );

                            newPapers.forEach((np) => {
                              dbSetPaper(np);
                            });
                            setResearchStatus(null);

                            // Auto-trigger messages for each found paper depending on if file downloaded successfully
                            newPapers.forEach((p) => {
                              if (!p.fileId) {
                                setTimeout(() => {
                                  const assistantMsg: ChatMessage = {
                                    id: String(Date.now() + Math.random()),
                                    role: "assistant",
                                    content: `### ⚠️ No free version available: ${p.title}\n\nThe full-text document is hosted behind a restricted publisher credential check or locked portal, and no free/open-access PDF could be found.\n\n* **Suggested Alternative:** Look for alternative papers or try refining the keywords/search terms to target open-access repositories.\n* **Manual Upload:** If you have this document's PDF stored locally on your device, you can manually upload it to the workspace for a robust analysis.`,
                                    timestamp: Date.now(),
                                  };
                                  updateChatMessages(
                                    (prev) => [...prev, assistantMsg],
                                    false,
                                  );
                                }, 1000);
                              }
                            });

                            const newTabs = newPapers
                              .filter((p: any) => p.fileId)
                              .flatMap((p: any) => {
                                let html = "";
                                if (p.extractedText) {
                                  const pages = p.extractedText.split(
                                    /--- Page \d+ of \d+ ---/,
                                  );
                                  const markers =
                                    p.extractedText.match(
                                      /--- Page (\d+) of \d+ ---/g,
                                    ) || [];

                                  html = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
                                 <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${p.title}</h1>
                                 <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Mapped Document: ${p.title}</p>
                                 <div class="h-[1px] bg-zinc-800 mb-6"></div>`;

                                  pages.forEach(
                                    (pageContent: string, idx: number) => {
                                      if (!pageContent.trim() && idx === 0)
                                        return;
                                      const pageNumMatch =
                                        idx > 0
                                          ? markers[idx - 1]?.match(/\d+/)
                                          : null;
                                      const pageNum = pageNumMatch
                                        ? pageNumMatch[0]
                                        : idx === 0
                                          ? "1"
                                          : idx.toString();

                                      html += `<div id="pdf-page-${pageNum}" class="mb-10 pt-4 border-t border-zinc-800/30 group/page">
                                   <div class="text-[10px] font-mono text-zinc-600 mb-4 uppercase tracking-widest group-hover/page:text-zinc-400 transition-colors">Page ${pageNum}</div>
                                   <div class="space-y-4 leading-relaxed">${pageContent
                                     .trim()
                                     .split("\n\n")
                                     .map((para: string) =>
                                       para.trim()
                                         ? `<p>${para.replace(/\n/g, "<br/>")}</p>`
                                         : "",
                                     )
                                     .join("")}</div>
                                 </div>`;
                                    },
                                  );
                                  html += `</div>`;
                                }

                                const overviewHtml = markdownToHtml(`## ${p.title}\n\n**Overview:**\n\n${formatAbstractText(p.summary || "I have successfully indexed this paper.")}`);

                                return [
                                  {
                                    id: `overview-${p.fileId}`,
                                    type: "document" as const,
                                    title: `Overview: ${p.title}`,
                                    content: overviewHtml,
                                    folderId: selectedFolderId || folders[0]?.id || "f1",
                                  },
                                  {
                                    id: `view-${p.fileId}`,
                                    type: "document" as const,
                                    title: p.title,
                                    content: html,
                                    fileId: p.fileId,
                                    mimetype: "application/pdf",
                                    folderId:
                                      selectedFolderId || folders[0]?.id || "f1",
                                  }
                                ];
                              });

                            if (newTabs.length > 0) {
                              setTabs((prev) => [...prev, ...newTabs]);
                              setTimeout(() => {
                                // Only switch if the AI is not actively streaming into a document tab
                                if (!aiWritingTabIdRef.current) {
                                  setActiveTabId(newTabs[0].id);
                                }
                              }, 100);
                            }
                          }
                        })
                        .catch((err) => {
                          console.error("Error searching Arxiv:", err);
                          setResearchStatus(null);
                        });
                    } catch (err) {
                      console.error("Failed to make arxiv request", err);
                    }
                  }

                  if (
                    parsedContent &&
                    parsedContent.length > 5 &&
                    !parsedContent.trim().startsWith("</") &&
                    !parsedContent.trim().startsWith(">")
                  ) {
                    if (!hasSwitchedToDoc) {
                      hasSwitchedToDoc = true;

                      // Determine the target tab ID synchronously to avoid closure lag issues
                      const currentActive = tabs.find(
                        (t) => t.id === activeTabId,
                      );
                      const emptyDocTab = tabs.find(
                        (t) =>
                          t.type === "document" &&
                          !t.fileId &&
                          (!t.content ||
                            t.content.trim() === "" ||
                            t.content.trim() === "<p><br></p>"),
                      );

                      if (
                        currentActive &&
                        currentActive.type === "document" &&
                        !currentActive.fileId &&
                        (!currentActive.content ||
                          currentActive.content.trim() === "" ||
                          currentActive.content.trim() === "<p><br></p>")
                      ) {
                        targetTabIdForAi = currentActive.id;
                      } else if (emptyDocTab) {
                        targetTabIdForAi = emptyDocTab.id;
                      } else {
                        targetTabIdForAi = "doc-" + Date.now();
                      }

                      aiWritingTabIdRef.current = targetTabIdForAi;

                      setTabs((prev) => {
                        const exists = prev.find(
                          (t) => t.id === targetTabIdForAi,
                        );
                        if (exists) return prev;
                        return [
                          ...prev,
                          {
                            id: targetTabIdForAi!,
                            type: "document",
                            title: parsedTitle || "Untitled Document",
                            content: "",
                          },
                        ];
                      });

                      // Set active tab ID outside of the setTabs functional update
                      setTimeout(() => {
                        if (targetTabIdForAi) {
                          ignoreNextTabSyncRef.current = targetTabIdForAi;
                          setActiveTabId(targetTabIdForAi);
                        }
                      }, 0);
                    }

                    let rawContent = parsedContent;

                    // Strip conversational prologue before the first markdown header
                    const headingIndex = rawContent.indexOf("## ");
                    const h1Index = rawContent.indexOf("# ");
                    let firstValidIndex = -1;
                    if (headingIndex !== -1 && h1Index !== -1)
                      firstValidIndex = Math.min(headingIndex, h1Index);
                    else firstValidIndex = Math.max(headingIndex, h1Index);

                    if (firstValidIndex > 0) {
                      const introPart = rawContent.substring(
                        0,
                        firstValidIndex,
                      );
                      if (
                        /((?:Awesome)|(?:Sure)|(?:I've)|(?:I’ve)|(?:I’ll)|(?:I'll)|(?:Here)|(?:Got it)|(?:chat message))/i.test(
                          introPart,
                        )
                      ) {
                        rawContent = rawContent.substring(firstValidIndex);
                      }
                    }

                    rawContent = rawContent.trim();
                    const htmlContent = markdownToHtml(rawContent);
                    lastGeneratedHtml = htmlContent;

                    if (targetTabIdForAi) {
                      // If this tab is currently being viewed, update the active editor state too
                      // We compare against the latest activeTabId from the closure-wrapped state or better yet, check current activeTabId
                      // Note: in effects/handlers, state might be stale if not careful, but usually handlers use the latest state if they are closure-wrapped
                      // To be safe, we can use a ref or check window state, but usually activeTabId is fresh enough in the async loop
                      // Wait, in a while loop, activeTabId value is captured at the start of the function.
                      // We should use an functional update or check a Ref for the LATEST active ID.
                      if (activeTabIdRef.current === targetTabIdForAi) {
                        setDocumentContent(htmlContent);
                        if (editorRef.current) {
                          editorRef.current.innerHTML = htmlContent;
                          lastContentRef.current = htmlContent;
                        }
                        if (parsedTitle) setDocumentTitle(parsedTitle);
                      }
                    } else {
                      // Fallback if no target tab was identified
                      setDocumentContent(htmlContent);
                      if (editorRef.current) {
                        editorRef.current.innerHTML = htmlContent;
                        lastContentRef.current = htmlContent;
                      }
                      if (parsedTitle) setDocumentTitle(parsedTitle);
                    }
                  }
                }
              } catch (e) {
                // ignore partial JSON parse errors just in case
              }
            }
          }
        }
      }

      updateChatMessages((prev) => prev, false);
      setIsAiTyping(false);
      aiWritingTabIdRef.current = null;

      if (targetTabIdForAi && lastGeneratedHtml) {
        const finalTitle = lastGeneratedTitle || "Untitled Document";
        setTabs((prev) =>
          prev.map((t) =>
            t.id === targetTabIdForAi
              ? {
                  ...t,
                  content: lastGeneratedHtml,
                  title: finalTitle,
                }
              : t
          )
        );

        const finalTabObj: Tab = {
          id: targetTabIdForAi,
          type: "document",
          title: finalTitle,
          content: lastGeneratedHtml,
          folderId: selectedFolderId || folders[0]?.id || "f1",
        };
        saveDraftToLibrary(finalTabObj);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        console.log("AI streaming was aborted by the user.");
        return; // Exit without triggering the fallback
      }
      setIsAiTyping(false);
      aiWritingTabIdRef.current = null;
      console.warn(
        "Express server research LLM failed, using deep local simulation rules:",
        e,
      );
      // Fallback safely to our local academic intelligence
      const fallbackPayload = getFallbackResponse(textToSend);
      const simulatedAnswer = fallbackPayload.text;

      if (fallbackPayload.suggestion) {
        if (fallbackPayload.suggestion.type === "edit_document") {
          if (fallbackPayload.suggestion.title) {
            const newTitle = fallbackPayload.suggestion.title;
            setDocumentTitle(newTitle);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === activeTabId ? { ...t, title: newTitle } : t,
              ),
            );
          }
          if (fallbackPayload.suggestion.appendContent) {
            const htmlContent = markdownToHtml(
              fallbackPayload.suggestion.appendContent,
            );
            setDocumentContent((prev) => {
              const newContent = prev + htmlContent;
              setTabs((prevTabs) =>
                prevTabs.map((t) =>
                  t.id === activeTabId ? { ...t, content: newContent } : t,
                ),
              );
              if (editorRef.current) {
                editorRef.current.innerHTML = newContent;
                lastContentRef.current = newContent;
              }
              return newContent;
            });
          }
          if (fallbackPayload.suggestion.replaceContent) {
            const htmlContent = markdownToHtml(
              fallbackPayload.suggestion.replaceContent,
            );
            setDocumentContent(htmlContent);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === activeTabId ? { ...t, content: htmlContent } : t,
              ),
            );
            if (editorRef.current) {
              editorRef.current.innerHTML = htmlContent;
              lastContentRef.current = htmlContent;
            }
          }
        }
      }

      setTimeout(() => {
        updateChatMessages((prev) => {
          const idx = prev.findIndex(
            (m) => m.id === assistantMessageIdRef.current,
          );
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], content: simulatedAnswer };
            return next;
          }
          return [
            ...prev,
            {
              id: String(Date.now() + 1),
              role: "assistant",
              content: simulatedAnswer,
              timestamp: Date.now(),
            },
          ];
        });

        // Generate fallback title
        const currentTab = tabsRef.current.find(
          (t) => t.id === activeTabIdRef.current,
        );
        if (
          currentTab &&
          currentTab.type === "chat" &&
          (currentTab.title === "Untitled" || currentTab.title === "New chat")
        ) {
          const generatedFallbackTitle =
            textToSend.split(" ").slice(0, 3).join(" ") + "...";
          setTabs((prev) =>
            prev.map((t) =>
              t.id === currentTab.id
                ? { ...t, title: generatedFallbackTitle }
                : t,
            ),
          );
        }

        updateChatMessages((prev) => prev, false);
        setIsAiTyping(false);
      }, 1000);
      return;
    } finally {
      setIsAiTyping(false);
    }
  };

  // Paperclip file click trigger
  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  // Dynamic sort and filter logic
  const allLibraryItems = [...papers];

  const filteredPapers = allLibraryItems.filter((p) => {
    const matchesSearch = searchFilter
      ? p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.author &&
          p.author.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (p.summary &&
          p.summary.toLowerCase().includes(searchFilter.toLowerCase()))
      : true;

    const matchesType = filterType === "all" ? true : p.fileType === filterType;
    return matchesSearch && matchesType;
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    let valA = "";
    let valB = "";

    if (sortBy === "title") {
      valA = a.title || "";
      valB = b.title || "";
    } else if (sortBy === "added") {
      valA = a.added || "";
      valB = b.added || "";
    } else if (sortBy === "viewed") {
      valA = a.viewed || "";
      valB = b.viewed || "";
    }

    const orderMultiplier = sortOrder === "asc" ? 1 : -1;
    return valA.localeCompare(valB) * orderMultiplier;
  });

  const isCallback = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("google_callback") === "1";
  if (isCallback) {
    return <DesktopAuthBridge />;
  }

  if (isAuthLoading) {
    return (
      <div className="h-screen bg-[#070707] flex flex-col items-center justify-center font-sans animate-none select-none">
        {/* Brand Lockup: cosmi word in lowercase, Plus Jakarta font, then logo beside it */}
        <div className="flex items-center gap-2.5 mb-6">
          <span className="text-3xl font-semibold tracking-normal text-white font-jakarta lowercase">
            cosmi
          </span>
          <img
            src="/cosmi.png"
            alt="Cosmi"
            className="w-8 h-8 select-none grayscale invert object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* LinkedIn-style loading below */}
        <div className="w-36 h-[2px] bg-zinc-800/80 rounded-full overflow-hidden relative">
          <div className="animate-slide-progress rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthenticationScreen onGoogleSignIn={handleGoogleLogin} />;
  }

  if (needsOnboarding) {
    return (
      <OnboardingScreen 
        user={currentUser} 
        onComplete={(firstPrompt) => {
          setNeedsOnboarding(false);
          if (firstPrompt.trim()) {
            const newId = `chat-${Date.now()}`;
            const newChatTab: Tab = {
              id: newId,
              type: "chat",
              title: "New chat",
              messages: [],
            };
            setTabs((prev) => [...prev, newChatTab]);
            setActiveTabId(newId);
            setActiveAssistantTabId(newId);
            setMessages([]);
            saveChatToLibrary(currentUser?.uid || "guest", newChatTab);

            // Trigger a message from the initial prompt in the main chat tab
            setTimeout(() => {
              handleSendMessage(firstPrompt);
            }, 600);
          }
        }} 
      />
    );
  }

  return (
    <div 
      className="h-screen bg-[#070707] text-[#e4e4e7] font-sans flex selection:bg-[#262626] overflow-hidden relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Prevent default browser behavior (navigating to file) when dropping files outside dedicated drop zones
        e.preventDefault();
      }}
    >
      {isDesktopApp && (
        <>
          <div className="fixed top-0 left-0 right-0 h-[38px] z-[9998] [-webkit-app-region:drag] pointer-events-none" />
          <div className="fixed top-0 right-0 h-[38px] flex items-center z-[9999] [-webkit-app-region:no-drag]">
            <button onClick={handleMinimize} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent">
              <Minus className="w-[14px] h-[14px]" />
            </button>
            <button onClick={handleMaximize} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent">
              <Square className="w-[12px] h-[12px]" />
            </button>
            <button onClick={() => setIsExitConfirmOpen(true)} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-red-500 transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent">
              <XIcon className="w-[14px] h-[14px]" />
            </button>
          </div>
        </>
      )}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={async (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              await handleUploadFile(files[i]);
            }
          }
          e.target.value = "";
        }}
      />

      {/* Left Sidebar */}
      <SidebarPanel
        isOpen={isSidebarOpen}
        isDesktopApp={isDesktopApp}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        tabs={tabs}
        setTabs={setTabs}
        folders={folders}
        papers={papers}
        selectedFolderId={selectedFolderId}
        setSelectedFolderId={setSelectedFolderId}
        createNewDocument={createNewDocument}
        createNewChat={createNewChat}
        dbSetFolder={dbSetFolder}
        fileInputRef={fileInputRef}
        handlePaperClick={handlePaperClick}
        setDocumentContent={setDocumentContent}
        handleSendMessage={handleSendMessage}
        allChats={allChats}
        setChatIdToDelete={setChatIdToDelete}
        setActiveModal={setActiveModal}
        activeToolsTab={activeToolsTab}
        openToolsTab={openToolsTab}
        toolsHistory={toolsHistory}
        setToolsHistory={setToolsHistory}
        loadToolsHistoryItem={loadToolsHistoryItem}
        deleteToolsHistoryItem={deleteToolsHistoryItem}
        currentUser={currentUser}
        handleGoogleLogin={handleGoogleLogin}
        setIsLoggingOut={setIsLoggingOut}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        setShowBuyCoffeeModal={setShowBuyCoffeeModal}
        setIsKeyboardShortcutsOpen={setIsKeyboardShortcutsOpen}
        loadedUserIdRef={loadedUserIdRef}
        setFolders={setFolders}
        setPapers={setPapers}
        setMessages={setMessages}
        setAllChats={setAllChats}
        signOut={signOut}
        auth={auth}
        appLanguage={appLanguage}
        setAppLanguage={setAppLanguage}
        t={t}
        translateDynamicTitle={translateDynamicTitle}
        handleLibraryDragStart={handleLibraryDragStart}
        handleLibraryDragOverFolder={handleLibraryDragOverFolder}
        handleFolderDragLeave={handleFolderDragLeave}
        handleLibraryDropOnFolder={handleLibraryDropOnFolder}
        handleLibraryDragOverRoot={handleLibraryDragOverRoot}
        handleLibraryDropOnRoot={handleLibraryDropOnRoot}
        dragOverFolderId={dragOverFolderId}
        dragOverRootLibrary={dragOverRootLibrary}
        setDragOverRootLibrary={setDragOverRootLibrary}
      />

      {/* Disabled Legacy Sidebar */}

      {/* Main Content (Editor Column) */}
      <div className="flex-1 flex flex-col min-w-0 relative z-0">
        {/* Header Bar */}
        <header className="relative h-[38px] flex items-end shrink-0 bg-[#070707] px-2 [-webkit-app-region:drag]">
          <div className="flex items-center gap-3 h-full pb-1.5 pt-1.5 group z-20 bg-[#070707] pr-2 [-webkit-app-region:no-drag]">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`transition-all duration-300 cursor-pointer p-1 rounded-md ${isSidebarOpen ? "opacity-0 group-hover:opacity-100 bg-[#1a1a1a] text-[#f4f4f5]" : "text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-[#1a1a1a]"}`}
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <Sidebar weight="Linear" size={18} color="currentColor" />
            </button>
          </div>

          {/* Tabs Container */}
          <div
            className="flex-1 flex items-end h-full ml-1 gap-0 overflow-x-auto custom-scrollbar-h min-w-0 [-webkit-app-region:no-drag]"
            style={{
              paddingRight: isDesktopApp 
                ? (isAssistantOpen ? "150px" : "235px") 
                : (isAssistantOpen ? "16px" : "96px"),
              WebkitMaskImage: !isAssistantOpen
                ? (isDesktopApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 230px), rgba(0,0,0,0) calc(100% - 140px))"
                    : "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 90px), rgba(0,0,0,0) 100%)")
                : (isDesktopApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 145px), rgba(0,0,0,0) 100%)"
                    : "none"),
              maskImage: !isAssistantOpen
                ? (isDesktopApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 230px), rgba(0,0,0,0) calc(100% - 140px))"
                    : "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 90px), rgba(0,0,0,0) 100%)")
                : (isDesktopApp
                    ? "linear-gradient(to right, rgba(0,0,0,1) calc(100% - 145px), rgba(0,0,0,0) 100%)"
                    : "none"),
            }}
          >
            {getUniqueTabs(tabs).map((tab, index) => (
              <div
                key={tab.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  setActiveTabId(tab.id);
                  if (tab.type === "tools") setSidebarView("tools");
                  else if (tab.type === "library") setSidebarView("library");
                  else if (tab.type === "chat") setSidebarView("chats");
                  else setSidebarView("files");
                }}
                className={`flex items-center gap-2 px-4 h-[32px] rounded-t-[8px] transition-colors cursor-grab active:cursor-grabbing text-[13px] chrome-tab select-none ${
                  activeTabId === tab.id
                    ? "bg-[#121212] text-[#e4e4e7] chrome-tab-active"
                    : "bg-transparent text-[#a1a1aa] hover:bg-[#121214] border-none"
                }`}
              >
                {tab.type === "home" ? (
                  <Icon icon="ph:house" className="w-3.5 h-3.5" />
                ) : tab.type === "library" ? (
                  <Icon icon="ph:books" className="w-3.5 h-3.5" />
                ) : tab.type === "chat" ? (
                  <Icon icon="ph:chat-circle" className="w-3.5 h-3.5" />
                ) : tab.type === "tools" ? (
                  <PaletteRound weight="Linear" className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Icon icon="ph:pencil-line" className="w-3.5 h-3.5" />
                )}
                <span className="truncate max-w-[130px]">
                  {tab.type === "home"
                    ? t("home")
                    : tab.type === "library"
                      ? t("library")
                      : tab.type === "tools"
                        ? t("tools")
                        : (tab.id === activeTabId &&
                          tab.type === "document" &&
                          (!tab.fileId || tab.mimetype !== "application/pdf")
                            ? translateDynamicTitle(documentTitle)
                            : translateDynamicTitle(tab.title)) || t("untitled")}
                </span>

                {tabs.length > 1 && (
                  <button
                    onClick={(e) => requestDeleteTab(tab.id, e)}
                    className="ml-2 hover:text-white p-0.5 rounded-sm hover:bg-white/10"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Tab Button */}
            <div
              onClick={() => {
                const newId = `home-${Date.now()}`;
                setTabs([...tabs, { id: newId, type: "home", title: "Home" }]);
                setActiveTabId(newId);
              }}
              className="flex items-center justify-center p-2 mb-0.5 ml-1 rounded-md hover:bg-[#1a1a1a] text-[#86868b] hover:text-[#e4e4e7] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-current" strokeWidth={2} />
            </div>
          </div>

          {/* Right Header Navigation & Panel Controls */}
          {!isAssistantOpen && activeTab.type !== "chat" && (
            <div className={`absolute bottom-[3px] z-20 flex items-center [-webkit-app-region:no-drag] ${isDesktopApp ? "right-[145px]" : "right-2"}`}>
              <button
                onClick={() => setIsAssistantOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#222222] hover:border-[#3f3f46] transition-all cursor-pointer text-[12px] font-medium font-jakarta active:scale-[0.98] whitespace-nowrap"
                title="Open Assistant Source"
              >
                <img
                  src="/cosmi.png"
                  alt="Agent"
                  className="w-3.5 h-3.5 object-contain"
                />
                <span>Agent</span>
              </button>
            </div>
          )}
        </header>

        {/* Main Editor Component Container */}
        <div className="relative flex-1 bg-[#121212] rounded-2xl flex flex-row overflow-hidden min-w-0 transition-all">
          <div className="flex-1 flex flex-col min-w-0">
            {activeTab.type === "home" ? (
              <HomePanel
                currentUser={currentUser}
                callMe={callMe}
                tabs={tabs}
                setTabs={setTabs}
                setActiveTabId={setActiveTabId}
                createNewDocument={createNewDocument}
                folders={folders}
                dbSetFolder={dbSetFolder}
                setSelectedFolderId={setSelectedFolderId}
              />
            ) : activeTab.type === "chat" ? (
              <div className="flex-1 flex flex-col bg-[#121212] relative overflow-hidden">
                {/* Chat Header */}
                <header className="absolute top-0 left-0 right-0 h-[64px] flex items-center justify-between px-4 z-45 pointer-events-none">
                  {/* Background fade to make scrolling text disappear smoothly */}
                  <div className="absolute top-0 left-0 right-0 h-[100px] bg-gradient-to-b from-[#121212] via-[#121212]/90 to-transparent pointer-events-none -z-10" />
                  
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="relative">
                      {isRenamingChat === activeTab.id ? (
                        <input
                          autoFocus
                          value={renamingChatText}
                          onChange={(e) => setRenamingChatText(e.target.value)}
                          onKeyDown={handleRenameChat}
                          onBlur={handleRenameChat}
                          className="bg-[#1a1a1a] text-[#e4e4e7] text-[13px] font-medium px-3 py-1.5 rounded-xl border border-[#3f3f46] outline-none w-48"
                        />
                      ) : (
                        <button
                          onClick={() =>
                            setIsChatDropdownOpen(!isChatDropdownOpen)
                          }
                          className="flex items-center gap-1.5 text-[#e4e4e7] hover:bg-[#1a1a1a] px-3 py-1.5 rounded-xl transition-colors cursor-pointer group"
                        >
                          <span className="font-medium text-[13px]">
                            {translateDynamicTitle(activeTab.title)}
                          </span>
                          <Icon
                            icon="ph:caret-down"
                            className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform ${isChatDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      )}

                      {isChatDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsChatDropdownOpen(false)}
                          />
                          <div className="absolute top-full left-0 mt-1.5 w-[200px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 max-h-72 overflow-y-auto shadow-2xl">
                            {getUniqueTabs(tabs)
                              .filter((t) => t.type === "chat")
                              .map((chatTab) => (
                                <button
                                  key={chatTab.id}
                                  onClick={() => {
                                    setActiveTabId(chatTab.id);
                                    setIsChatDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                                    chatTab.id === activeTabId
                                      ? "bg-[#27272a] text-white"
                                      : "text-zinc-400 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <Icon
                                    icon="ph:chat-circle"
                                    className="w-4 h-4 shrink-0 text-zinc-500"
                                  />
                                  <span className="text-xs font-medium truncate">
                                    {translateDynamicTitle(chatTab.title)}
                                  </span>
                                </button>
                              ))}
                            <div className="border-t border-[#2d2d30] my-1" />
                            <button
                              onClick={() => {
                                createNewChat();
                                setIsChatDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <Icon
                                icon="ph:plus"
                                className="w-4 h-4 shrink-0 text-zinc-500"
                              />
                              <span className="text-xs font-semibold">
                                New Chat
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <button
                      onClick={createNewChat}
                      className="p-2 text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1a1a1a] rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0"
                      title="New Chat"
                    >
                      <MaterialIcon name="add" className="text-[20px] shrink-0" />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                        className={`p-2 text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1a1a1a] rounded-xl transition-colors cursor-pointer ${isChatMenuOpen ? "bg-[#1a1a1a] text-[#e4e4e7]" : ""}`}
                      >
                        <MenuDots
                          weight="Linear"
                          className="w-4 h-4"
                        />
                      </button>

                      {isChatMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsChatMenuOpen(false)}
                          />
                          <div className="absolute top-full right-0 mt-1.5 w-40 bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1 flex flex-col gap-0.5 shadow-2xl">
                            <button
                              onClick={() => {
                                setIsRenamingChat(activeTab.id);
                                setRenamingChatText(activeTab.title);
                                setIsChatMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                            >
                              <Icon
                                icon="ph:pencil-simple"
                                className="w-4 h-4"
                              />
                              <span className="text-xs font-medium">
                                Rename
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setChatIdToDelete(activeTab.id);
                                setIsChatMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <Icon icon="ph:trash" className="w-4 h-4" />
                              <span className="text-xs font-medium">
                                Delete chat
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </header>

                {/* Chat Content Area replaced */}
                <ChatPanel
                  tab={activeTab}
                  currentUser={currentUser}
                  isOnline={isOnline}
                  papers={papers}
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  documentTitle={documentTitle}
                  documentContent={documentContent}
                  setDocumentTitle={setDocumentTitle}
                  setDocumentContent={setDocumentContent}
                  setDocSaveStatus={setDocSaveStatus}
                  folderName={folderName}
                  savedNoteName={savedNoteName}
                  attachedFile={attachedFile}
                  setAttachedFile={setAttachedFile}
                  handlePaperclipClick={handlePaperclipClick}
                  onTabUpdate={onTabUpdate}
                  setOnboardingTaskComplete={setOnboardingTaskComplete}
                  saveDraftToLibrary={saveDraftToLibrary}
                  dbSetPaper={dbSetPaper}
                  extractTextFromPdf={extractTextFromPdf}
                  parseAssistantResponse={parseAssistantResponse}
                  getFallbackResponse={getFallbackResponse}
                  markdownToHtml={markdownToHtml}
                  editorRef={editorRef}
                  ignoreNextTabSyncRef={ignoreNextTabSyncRef}
                  activeTabId={activeTabId}
                  setActiveTabId={setActiveTabId}
                  setTabs={setTabs}
                  isAiTyping={isAiTyping}
                  setIsAiTyping={setIsAiTyping}
                />
              </div>
            ) : activeTab.type === "library" ? (
              <LibraryPanel
                papers={papers}
                folders={folders}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                dbSetPaper={dbSetPaper}
                dbSetFolder={dbSetFolder}
                dbDeleteFolder={dbDeleteFolder}
                dbDeletePaper={dbDeletePaper}
                tabs={tabs}
                setTabs={setTabs}
                setActiveTabId={setActiveTabId}
                createNewDocument={createNewDocument}
                fileInputRef={fileInputRef}
                handleLibraryDragStart={handleLibraryDragStart}
                handleLibraryDragOverFolder={handleLibraryDragOverFolder}
                handleFolderDragLeave={handleFolderDragLeave}
                handleLibraryDropOnFolder={handleLibraryDropOnFolder}
                handleLibraryDragOverRoot={handleLibraryDragOverRoot}
                handleLibraryDropOnRoot={handleLibraryDropOnRoot}
                dragOverFolderId={dragOverFolderId}
                dragOverRootLibrary={dragOverRootLibrary}
                setDragOverRootLibrary={setDragOverRootLibrary}
                handlePaperClick={handlePaperClick}
                formatAbstractText={formatAbstractText}
                appLanguage={appLanguage}
              />
            ) : activeTab.type === "tools" ? (
              <div className="flex-1 overflow-hidden focus:outline-none bg-[#121212] flex flex-col pt-8 w-full h-full min-h-0">
                <div className="w-full h-full flex flex-col min-h-0">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#222225] px-8 shrink-0">
                    <h1 className="text-xl text-[#f4f4f5] font-semibold tracking-tight">
                      {activeToolsTab === "slovin"
                        ? t("slovinTitle")
                        : activeToolsTab === "percentage"
                          ? t("percentageTitle")
                          : activeToolsTab === "weighted"
                            ? t("weightedTitle")
                            : activeToolsTab === "likert"
                              ? t("likertTitle")
                              : activeToolsTab === "citation"
                                ? t("citationsTitle")
                                : t("analysisTitle")}
                    </h1>
                    {activeToolsTab === "citation" && (
                      <a 
                        href="https://genlang.vercel.app/#blog-post/demystifying-citations-and-sources"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5"
                        title="Demystifying Citations and Sources"
                      >
                        <HelpCircle className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 flex flex-col">
                    <StatisticsTools
                      onAddHistory={addToolsHistoryItem}
                      selectedHistoryItem={selectedToolsHistoryItem}
                      onClearSelectedHistoryItem={() =>
                        setSelectedToolsHistoryItem(null)
                      }
                      activeTab={activeToolsTab}
                      onChangeActiveTab={setActiveToolsTab}
                      appLanguage={appLanguage}
                    />
                  </div>
                </div>
              </div>
            ) : activeTab.fileId && activeTab.mimetype === "application/pdf" ? (
              <div
                className="flex-1 flex flex-col bg-[#0b0b0c] h-full overflow-hidden"
                id="pdf-viewer-workspace"
              >
                {/* PDF Viewer Display Body */}
                <div className="h-[44px] flex items-center justify-between px-4 bg-[#1e1e1e] border-b border-[#27272a] shrink-0 z-10 relative">
                  {/* Left Spacer for absolute centering balance */}
                  <div className="w-8" />

                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
                    <div className="flex items-center text-sm font-medium text-zinc-400 select-none">
                        <span className="text-zinc-200 min-w-[20px] text-center">
                          {currentPdfPage}
                        </span>
                        <span className="mx-1.5 text-zinc-600">/</span>
                        <span>{pdfNumPages || "-"}</span>
                      </div>
                      <div className="flex items-center box-border border border-[#27272a] rounded overflow-hidden">
                        <button
                          onClick={() =>
                            setPdfScale(Math.max(0.25, pdfScale - 0.25))
                          }
                          disabled={pdfScale <= 0.25}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                          title="Zoom out"
                        >
                          <Icon icon="ph:minus" className="w-4 h-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-[#27272a]" />
                        <div className="w-[50px] text-center text-xs font-medium text-zinc-200">
                          {Math.round(pdfScale * 100)}%
                        </div>
                        <div className="w-[1px] h-4 bg-[#27272a]" />
                        <button
                          onClick={() =>
                            setPdfScale(Math.min(5, pdfScale + 0.25))
                          }
                          disabled={pdfScale >= 5}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                          title="Zoom in"
                        >
                          <Icon icon="ph:plus" className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center box-border border border-[#27272a] rounded overflow-hidden">
                        <button
                          onClick={() => {
                            const page = document.getElementById(
                              `pdf-page-${Math.max(1, currentPdfPage - 1)}`,
                            );
                            if (page) page.scrollIntoView({ behavior: "smooth" });
                          }}
                          disabled={currentPdfPage <= 1}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                        >
                          <Icon icon="ph:caret-up" className="w-4 h-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-[#27272a]" />
                        <button
                          onClick={() => {
                            const page = document.getElementById(
                              `pdf-page-${Math.min(pdfNumPages || 1, currentPdfPage + 1)}`,
                            );
                            if (page) page.scrollIntoView({ behavior: "smooth" });
                          }}
                          disabled={currentPdfPage >= (pdfNumPages || 1)}
                          className="w-7 h-7 flex items-center justify-center bg-[#1e1e1e] hover:bg-[#27272a] hover:text-white text-zinc-400 disabled:opacity-30 disabled:hover:bg-[#1e1e1e] disabled:hover:text-zinc-400 transition-colors"
                        >
                          <Icon icon="ph:caret-down" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  <div className="flex items-center gap-3">
                    {!isSidePanelOpen && (
                      <button
                        onClick={() => setIsSidePanelOpen(true)}
                        className="p-1.5 text-[#a1a1aa] hover:text-[#f4f4f5] transition-all cursor-pointer rounded-md hover:bg-[#27272a]"
                        title="Toggle Side Panel"
                        id="pdf-panel-toggle"
                      >
                        <SidebarMinimalistic weight="BoldDuotone" color="currentColor" className="w-[20px] h-[20px]" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 w-full bg-[#1e1e1e] relative min-h-0 overflow-hidden">
                  <div
                    className="w-full h-full overflow-y-auto bg-[#0f0f10] custom-scrollbar-v"
                    onMouseUp={handlePdfMouseUp}
                    onContextMenu={handlePdfContextMenu}
                    id="pdf-scroll-container"
                  >
                    {isBlobLoading || !activePdfBlobUrl ? (
                      <div className="text-zinc-500 font-mono text-sm py-12 flex items-center justify-center gap-3">
                        <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                        Loading Cached PDF...
                      </div>
                    ) : (
                      <Document
                        file={activePdfBlobUrl}
                        onLoadSuccess={({ numPages }) => setPdfNumPages(numPages)}
                        className="flex flex-col items-center py-8 gap-6"
                        loading={
                          <div className="text-zinc-500 font-mono text-sm py-12 flex items-center justify-center gap-3">
                            <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                            Loading PDF Renderer...
                          </div>
                        }
                        error={
                          <div className="text-red-400 py-12">
                            Failed to load PDF file.
                          </div>
                        }
                      >
                        {Array.from(new Array(pdfNumPages || 0), (el, index) => (
                          <div
                            key={`page_container_${index + 1}`}
                            id={`pdf-page-${index + 1}`}
                            className="relative pdf-page-wrapper"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePdfContextMenu(e);
                            }}
                            style={{ transformOrigin: "top center" }}
                          >
                            <Page
                              pageNumber={index + 1}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              className="bg-[#18181b] border border-[#27272a] text-[#e4e4e7] relative"
                              width={800}
                              scale={pdfScale}
                            />
                          </div>
                        ))}
                      </Document>
                    )}
                  </div>

                  {/* Popover UI over PDF text selection */}
                  {selectionText && selectionPos && (
                    <div
                      className="absolute z-50 pdf-annotation-popover bg-[#161618] border border-[#2d2d30] rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[280px] max-w-sm"
                      style={{
                        left: `${selectionPos.x}px`,
                        top: `${selectionPos.y}px`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div className="text-[11px] font-mono text-zinc-400 select-none pb-1.5 border-b border-[#2d2d30] flex items-center justify-between">
                        <span>Page {selectedPageNum || 1} Annotation</span>
                        <button
                          onClick={() => {
                            setSelectionText("");
                            setSelectionPos(null);
                          }}
                          className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-0.5"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="bg-[#121212]/50 text-[11px] italic text-zinc-300 p-2 rounded border border-[#222224] max-h-24 overflow-y-auto select-none break-words whitespace-pre-wrap">
                        "{selectionText}"
                      </div>

                      {/* Highlights selection color */}
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-[10px] text-zinc-500 font-medium select-none">
                          Color:
                        </span>
                        <div className="flex items-center gap-1">
                          {[
                            {
                              name: "Yellow",
                              value: "#fef08a",
                              class: "bg-yellow-200",
                            },
                            {
                              name: "Green",
                              value: "#bbf7d0",
                              class: "bg-green-200",
                            },
                            {
                              name: "Blue",
                              value: "#bfdbfe",
                              class: "bg-blue-200",
                            },
                            {
                              name: "Pink",
                              value: "#fbcfe8",
                              class: "bg-pink-200",
                            },
                          ].map((clr) => (
                            <button
                              key={clr.value}
                              onClick={() => setActiveHighlightColor(clr.value)}
                              className={`w-4 h-4 rounded-full transition-transform cursor-pointer border ${activeHighlightColor === clr.value ? "ring-1 ring-zinc-400 border-white scale-110" : "border-transparent hover:scale-105"} ${clr.class}`}
                              title={clr.name}
                            />
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Type your comment or thesis notes..."
                        className="w-full bg-[#121212] border border-[#27272a] focus:border-zinc-700 rounded-lg p-2 text-[12px] text-[#f4f4f5] outline-none transition-colors resize-none placeholder:text-zinc-650"
                      />

                      <button
                        onClick={async () => {
                          if (!selectionText) return;

                          const newAnno = {
                            id: `anno-${Date.now()}`,
                            fileId: activeTab.fileId || activeTab.id,
                            text: selectionText,
                            comment: commentDraft.trim(),
                            page: selectedPageNum || 1,
                            color: activeHighlightColor,
                            timestamp: Date.now(),
                          };

                          const storageKey = `annotations_${activeTab.fileId || activeTab.id}`;
                          const currentAnnosStr =
                            localStorage.getItem(storageKey) || "[]";
                          let currentAnnos = [];
                          try {
                            currentAnnos = JSON.parse(currentAnnosStr);
                          } catch (_) {}
                          const updated = [...currentAnnos, newAnno];
                          localStorage.setItem(
                            storageKey,
                            JSON.stringify(updated),
                          );

                          window.dispatchEvent(new Event("annotationsUpdated"));

                          if (currentUser && storageMode === "database") {
                            try {
                              await setDoc(
                                doc(
                                  db,
                                  "users",
                                  currentUser.uid,
                                  "annotations",
                                  newAnno.id,
                                ),
                                {
                                  ...newAnno,
                                  uid: currentUser.uid,
                                },
                              );
                            } catch (err) {
                              handleFirestoreError(
                                err,
                                OperationType.WRITE,
                                `users/${currentUser.uid}/annotations/${newAnno.id}`,
                              );
                            }
                          }

                          setSelectionText("");
                          setSelectionPos(null);
                          setSelectedPageNum(null);
                          setCommentDraft("");

                          setTimeout(highlightPDFSpans, 100);
                        }}
                        className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 font-bold text-white text-[11px] rounded-lg transition-colors cursor-pointer text-center select-none"
                      >
                        Save Annotation
                      </button>
                    </div>
                  )}

                  {pdfContextMenu && (
                    <div
                      className="fixed z-[100] bg-[#161618] border border-[#2d2d30] rounded-xl p-1.5 shadow-2xl min-w-[200px] select-none pdf-context-menu-popover flex flex-col gap-0.5"
                      style={{
                        left: `${pdfContextMenu.x}px`,
                        top: `${pdfContextMenu.y}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          if (selectionText) {
                            navigator.clipboard.writeText(selectionText);
                            showToast("Selection copied to clipboard", "success");
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            icon="ph:copy"
                            className="w-4 h-4 text-zinc-500 group-hover:text-white"
                          />
                          <span>Copy Selection</span>
                        </div>
                        <span className="text-[9px] text-zinc-600 font-mono">
                          ⌘C
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText && !selectionPos) {
                            const outerWorkspace = document.getElementById(
                              "pdf-viewer-workspace",
                            );
                            if (outerWorkspace) {
                              const containerRect =
                                outerWorkspace.getBoundingClientRect();
                              let posX = pdfContextMenu!.x - containerRect.left;
                              let posY =
                                pdfContextMenu!.y - containerRect.top - 180; // Offset up

                              // Intelligence: keep popover in container bounds
                              const popWidth = 280;
                              if (posX - popWidth / 2 < 10)
                                posX = popWidth / 2 + 10;
                              if (
                                posX + popWidth / 2 >
                                containerRect.width - 10
                              )
                                posX = containerRect.width - popWidth / 2 - 10;
                              if (posY < 10)
                                posY =
                                  pdfContextMenu!.y - containerRect.top + 20; // Flip to bottom if too high

                              setSelectionPos({ x: posX, y: posY });
                            }
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:note-pencil"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Annotate</span>
                      </button>

                      <button
                        onClick={async () => {
                          if (!selectionText) return;
                          const newAnno = {
                            id: `anno-${Date.now()}`,
                            fileId: activeTab.fileId || activeTab.id,
                            text: selectionText,
                            comment: "",
                            page: selectedPageNum || 1,
                            color: activeHighlightColor,
                            timestamp: Date.now(),
                          };
                          const storageKey = `annotations_${activeTab.fileId || activeTab.id}`;
                          const currentAnnosStr =
                            localStorage.getItem(storageKey) || "[]";
                          let currentAnnos = [];
                          try {
                            currentAnnos = JSON.parse(currentAnnosStr);
                          } catch (_) {}
                          localStorage.setItem(
                            storageKey,
                            JSON.stringify([...currentAnnos, newAnno]),
                          );
                          window.dispatchEvent(new Event("annotationsUpdated"));
                          if (currentUser && storageMode === "database") {
                            try {
                              await setDoc(
                                doc(
                                  db,
                                  "users",
                                  currentUser.uid,
                                  "annotations",
                                  newAnno.id,
                                ),
                                {
                                  ...newAnno,
                                  uid: currentUser.uid,
                                },
                              );
                            } catch {}
                          }
                          setPdfContextMenu(null);
                          setSelectionText("");
                          setSelectionPos(null);
                          setTimeout(highlightPDFSpans, 100);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:highlighter"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Quick Highlight</span>
                      </button>

                      <div className="h-[1px] bg-[#2d2d30] mx-2 my-1" />

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://www.google.com/search?q=${encodeURIComponent(selectionText)}`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="logos:google-icon"
                          className="w-4 h-4"
                        />
                        <span>Google Search</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            setChatInput(
                              `Summarize this selection from the PDF: "${selectionText}"`,
                            );
                            if (!isSidePanelOpen) setIsSidePanelOpen(true);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:text-align-left"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Summarize Selection</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            setAssistantInput(
                              `I found this interesting in the text: "${selectionText}". Can you explain it or link it to my existing research?`,
                            );
                            setIsAssistantOpen(true);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:sparkle"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Agent</span>
                      </button>

                      <div className="h-[1px] bg-[#2d2d30] mx-2 my-1" />

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(selectionText)}&op=translate`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:translate"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Translate Selection</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(selectionText)}`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="simple-icons:wikipedia"
                          className="w-4 h-4 text-[#f8f9fa]"
                        />
                        <span>Wikipedia Search</span>
                      </button>

                      <button
                        onClick={() => {
                          if (selectionText) {
                            window.open(
                              `https://www.merriam-webster.com/dictionary/${encodeURIComponent(selectionText)}`,
                              "_blank",
                            );
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <NotebookBookmark
                          weight="Linear"
                          size={16}
                          className="w-4 h-4 text-zinc-500 group-hover:text-white shrink-0"
                        />
                        <span>Define / Dictionary</span>
                      </button>

                      <div className="h-[1px] bg-[#2d2d30] mx-2 my-1" />

                      <button
                        onClick={() => {
                          if (selectionText) {
                            const utterance = new SpeechSynthesisUtterance(
                              selectionText,
                            );
                            window.speechSynthesis.speak(utterance);
                          }
                          setPdfContextMenu(null);
                        }}
                        disabled={!selectionText}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent group"
                      >
                        <Icon
                          icon="ph:speaker-high"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Read Selection</span>
                      </button>

                      <button
                        onClick={() => {
                          window.print();
                          setPdfContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-[#2c2c2e] hover:text-white transition-colors group"
                      >
                        <Icon
                          icon="ph:printer"
                          className="w-4 h-4 text-zinc-500 group-hover:text-white"
                        />
                        <span>Print Page</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : true ? (
              <DocumentEditor
                activeTabId={activeTabId}
                tab={activeTab}
                isReadOnly={isReadOnly}
                currentUser={currentUser}
                editorRef={editorRef}
                editorFont={editorFont}
                editorFontSize={editorFontSize}
                setEditorFontSize={setEditorFontSize}
                editorAlign={editorAlign}
                setEditorAlign={setEditorAlign}
                setEditorFont={setEditorFont}
                docSaveStatus={docSaveStatus}
                setDocSaveStatus={setDocSaveStatus}
                autoDraftEnabled={autoDraftEnabled}
                saveDraftToLibrary={saveDraftToLibrary}
                onTabUpdate={onTabUpdate}
                markdownToHtml={markdownToHtml}
                isChartModalOpen={isChartModalOpen}
                setIsChartModalOpen={setIsChartModalOpen}
                chartBeingEdited={chartBeingEdited}
                setChartBeingEdited={setChartBeingEdited}
                setTabs={setTabs}
                isSidePanelOpen={isSidePanelOpen}
                setIsSidePanelOpen={setIsSidePanelOpen}
              />
            ) : (
              <div className="relative flex-1 flex flex-col h-full overflow-hidden">
                <DocumentToolbar
                  editorFont={editorFont}
                  setEditorFont={setEditorFont}
                  currentSelectionSize={currentSelectionSize}
                  changeSelectedFontSize={changeSelectedFontSize}
                  applySpecificFontSize={applySpecificFontSize}
                  handleFormat={handleFormat}
                  editorAlign={editorAlign}
                  setEditorAlign={setEditorAlign}
                  setIsTablePickerOpen={setIsTablePickerOpen}
                  isTablePickerOpen={isTablePickerOpen}
                  tableGrid={tableGrid}
                  setTableGrid={setTableGrid}
                  handleInsertTable={handleInsertTable}
                  setIsChartModalOpen={setIsChartModalOpen}
                  setChartBeingEdited={setChartBeingEdited}
                />
                {/* Document Editor Header Tools */}
                <div
                  className="absolute top-2.5 right-3 z-30 flex items-center gap-3 select-none"
                >
                  <span className="text-zinc-500 text-[11px] font-medium mr-1 select-none hidden sm:inline-block">
                    {saveMessage === "Saving..." ? (appLanguage === "fr" ? "Enregistrement..." : "Saving...") :
                     saveMessage === "Saved just now" || saveMessage === "Saved a few seconds ago" ? t("saveMessage") :
                     saveMessage.startsWith("Saved ") ? 
                       (appLanguage === "fr" ? saveMessage.replace("Saved ", "Enregistré il y a ").replace("m ago", " min") : saveMessage) : 
                     saveMessage}
                  </span>

                  <div className="flex items-center gap-0.5">
                    <button 
                      onClick={() => {
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.id === activeTabId
                              ? { ...t, starred: !t.starred }
                              : t
                          )
                        );
                        showToast(
                          activeTab?.starred 
                            ? "Removed from starred documents" 
                            : "Added to starred documents", 
                          "success"
                        );
                      }}
                      className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                        activeTab?.starred 
                          ? "text-yellow-400 hover:text-yellow-300" 
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a]"
                      }`}
                      title={activeTab?.starred ? "Unstar Document" : "Star Document"}
                    >
                      <Icon icon={activeTab?.starred ? "ph:star-fill" : "ph:star-bold"} className="w-[18px] h-[18px]" />
                    </button>

                    <div className="relative">
                      <button 
                        onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                        className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${isMoreMenuOpen ? "bg-[#27272a] text-zinc-200" : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a]"}`} 
                        title="More Options"
                      >
                        <MenuDots weight="Linear" className="w-[18px] h-[18px] shrink-0" />
                      </button>
                      
                      <AnimatePresence>
                        {isMoreMenuOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-40 bg-transparent" 
                              onClick={() => setIsMoreMenuOpen(false)}
                            />
                            
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.95 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 mt-1.5 z-50 bg-[#18181b] border border-[#27272a] rounded-xl p-1.5 w-[190px] shadow-xl text-left flex flex-col gap-0.5"
                            >
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  const text = editorRef.current?.innerText || "";
                                  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                                  const chars = text.length;
                                  showToast(`Stats: ${words} words, ${chars} characters`, "success");
                                }}
                                className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                              >
                                <Icon icon="ph:info-bold" className="w-[15px] h-[15px] text-zinc-500 group-hover:text-zinc-300" />
                                <span className="font-medium">Document Stats</span>
                              </button>
                              
                              <div
                                className="relative w-full"
                                onMouseEnter={() => setIsExportSubmenuOpen(true)}
                                onMouseLeave={() => setIsExportSubmenuOpen(false)}
                              >
                                <button
                                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon icon="ph:download-simple-bold" className="w-[15px] h-[15px] text-zinc-500 group-hover:text-zinc-300" />
                                    <span className="font-medium">Export</span>
                                  </div>
                                  <Icon 
                                    icon="ph:caret-right-bold" 
                                    className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" 
                                  />
                                </button>

                                <AnimatePresence>
                                  {isExportSubmenuOpen && (
                                    <motion.div 
                                      initial={{ opacity: 0, x: -5, scale: 0.95 }}
                                      animate={{ opacity: 1, x: 0, scale: 1 }}
                                      exit={{ opacity: 0, x: -5, scale: 0.95 }}
                                      transition={{ duration: 0.1 }}
                                      className="absolute right-full top-0 mr-1.5 w-[180px] bg-[#18181b] border border-[#27272a] rounded-xl p-1.5 shadow-xl flex flex-col gap-0.5 z-50 text-left"
                                    >
                                      {/* Export to Word with MS Word Logo icon */}
                                      <button
                                        onClick={() => {
                                          setIsMoreMenuOpen(false);
                                          setIsExportSubmenuOpen(false);
                                          handleExportWord();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group shrink-0"
                                      >
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e8/Microsoft_Office_Word_%282025%E2%80%93present%29.svg" alt="Word" className="w-4 h-4 shrink-0 object-contain" />
                                        <span className="font-medium">Word Document</span>
                                      </button>

                                      {/* Export PDF */}
                                      <button
                                        onClick={() => {
                                          setIsMoreMenuOpen(false);
                                          setIsExportSubmenuOpen(false);
                                          handleExportPDF();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group shrink-0"
                                      >
                                        <Icon icon="ph:file-pdf-fill" className="w-4 h-4 shrink-0 text-red-500" />
                                        <span className="font-medium">Export PDF</span>
                                      </button>

                                      {/* Export Markdown */}
                                      <button
                                        onClick={() => {
                                          setIsMoreMenuOpen(false);
                                          setIsExportSubmenuOpen(false);
                                          handleExportMarkdown();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group shrink-0"
                                      >
                                        <Icon icon="ph:markdown-logo-fill" className="w-4 h-4 shrink-0 text-sky-500" />
                                        <span className="font-medium">Markdown (.md)</span>
                                      </button>

                                      {/* Export .txt */}
                                      <button
                                        onClick={() => {
                                          setIsMoreMenuOpen(false);
                                          setIsExportSubmenuOpen(false);
                                          handleExportTXT();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group shrink-0"
                                      >
                                        <Icon icon="ph:file-txt-bold" className="w-4 h-4 shrink-0 text-zinc-400" />
                                        <span className="font-medium">Plain Text (.txt)</span>
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>

                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  if (confirm("Are you sure you want to clear your current document content? This cannot be undone.")) {
                                    if (editorRef.current) {
                                      editorRef.current.innerHTML = "";
                                      setDocumentContent("");
                                      saveDraftToLibrary({
                                        ...activeTab,
                                        content: ""
                                      });
                                    }
                                  }
                                }}
                                className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors cursor-pointer group border-t border-zinc-800/40 mt-1 pt-1.5"
                              >
                                <Icon icon="ph:trash-bold" className="w-[15px] h-[15px] text-red-500/80 group-hover:text-red-400" />
                                <span className="font-medium">Clear Content</span>
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                      className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                        isSidePanelOpen 
                          ? "text-zinc-200 bg-[#27272a]" 
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a]"
                      }`}
                      title={isSidePanelOpen ? "Collapse Side Panel" : "Expand Side Panel"}
                    >
                      <SidebarMinimalistic weight="BoldDuotone" color="currentColor" className="w-[20px] h-[20px]" />
                    </button>
                  </div>
                </div>
                {/* Independent Scrollable Document Surface */}
                <div className="flex-1 overflow-y-auto p-8 pb-24 md:p-14 md:pb-28 lg:p-20 lg:pb-32 focus:outline-none scroll-smooth">
                  <div
                    className={`max-w-[720px] mx-auto space-y-[1.5rem] ${editorFont} text-[#d4d4d8]`}
                    style={{
                      fontSize: `${editorFontSize}px`,
                      textAlign: editorAlign,
                    }}
                  >
                    {/* Main Document Title */}
                    <TextareaAutosize
                      key={`doc-title-${activeTabId}`}
                      id={`doc-title-${activeTabId}`}
                      name={`doc-title-${activeTabId}`}
                      autoComplete="off"
                      readOnly={isReadOnly}
                      value={documentTitle}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        lastLocalEditTimeRef.current = Date.now();
                        setDocumentTitle(newTitle);
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.id === activeTabId
                              ? { ...t, title: newTitle }
                              : t,
                          ),
                        );
                        setDocSaveStatus("saving");
                      }}
                      onBlur={(e) => {
                        const currentTab = tabs.find(
                          (t) => t.id === activeTabId,
                        );
                        if (currentTab)
                          saveDraftToLibrary({
                            ...currentTab,
                            title: e.target.value,
                          });
                      }}
                      placeholder="Untitled"
                      className="w-full bg-transparent text-[#f4f4f5] tracking-tight font-normal pb-2 resize-none outline-none leading-[1.25] text-[2.2rem] md:text-[2.6rem] placeholder:text-[#3f3f46] font-jakarta"
                    />

                    {/* Main Document Content Area */}
                    <div className="min-h-[400px]">
                      <div
                        ref={editorRef}
                        contentEditable={!isReadOnly}
                        suppressContentEditableWarning
                        data-placeholder={isReadOnly ? "" : "Start writing..."}
                        className="w-full bg-transparent text-inherit outline-none min-h-[400px] leading-relaxed focus:outline-none markdown-body"
                        onDragStart={(e) => {
                          const target = e.target as HTMLElement;
                          const draggableElement = target.closest(".table-embed-wrapper, .chart-embed-wrapper") as HTMLElement | null;
                          if (draggableElement) {
                            const tempId = "drag-" + Date.now();
                            draggableElement.setAttribute("data-drag-id", tempId);
                            e.dataTransfer.setData("text/plain", tempId);
                            e.dataTransfer.effectAllowed = "move";
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          const tempId = e.dataTransfer.getData("text/plain");
                          if (tempId && tempId.startsWith("drag-")) {
                            e.preventDefault();
                            pushToUndo();
                            
                            const draggedEl = editorRef.current?.querySelector(`[data-drag-id="${tempId}"]`) as HTMLElement | null;
                            if (draggedEl) {
                              let range: Range | null = null;
                              if (document.caretRangeFromPoint) {
                                range = document.caretRangeFromPoint(e.clientX, e.clientY);
                              } else if ((e as any).rangeParent) {
                                range = document.createRange();
                                range.setStart((e as any).rangeParent, (e as any).rangeOffset);
                                range.collapse(true);
                              }
                              
                              if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
                                draggedEl.removeAttribute("data-drag-id");
                                draggedEl.remove();
                                range.insertNode(draggedEl);
                                
                                const sel = window.getSelection();
                                if (sel) {
                                  sel.removeAllRanges();
                                  const newRange = document.createRange();
                                  newRange.selectNode(draggedEl);
                                  sel.addRange(newRange);
                                }
                                
                                const html = editorRef.current.innerHTML;
                                lastContentRef.current = html;
                                setDocumentContent(html);
                                setTabs((prev) =>
                                  prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
                                );
                                setDocSaveStatus("saving");
                              } else {
                                draggedEl.removeAttribute("data-drag-id");
                              }
                            }
                          }
                        }}
                        onInput={(e) => {
                          if (editorRef.current) {
                            const tableWrappers = editorRef.current.querySelectorAll(".table-embed-wrapper");
                            tableWrappers.forEach((wrapper) => {
                              if (!wrapper.querySelector("table")) {
                                wrapper.remove();
                              }
                            });
                            const chartWrappers = editorRef.current.querySelectorAll(".chart-embed-wrapper");
                            chartWrappers.forEach((wrapper) => {
                              if (!wrapper.querySelector("svg") && !wrapper.querySelector("img")) {
                                wrapper.remove();
                              }
                            });
                          }

                          const html = e.currentTarget.innerHTML;
                          
                          // Typing session manager for undo/redo snapshots
                          if (!isTypingRef.current) {
                            pushToUndo();
                            isTypingRef.current = true;
                          }
                          if (typingTimerRef.current) {
                            clearTimeout(typingTimerRef.current);
                          }
                          typingTimerRef.current = setTimeout(() => {
                            isTypingRef.current = false;
                          }, 1200);

                          lastContentRef.current = html;
                          lastLocalEditTimeRef.current = Date.now();
                          setDocumentContent(html);
                          setTabs((prev) =>
                            prev.map((t) =>
                              t.id === activeTabId
                                ? { ...t, content: html }
                                : t,
                            ),
                          );
                          setDocSaveStatus("saving");
                        }}
                        onKeyDown={(e) => {
                          const isMod = e.metaKey || e.ctrlKey;
                          if (isMod && e.key.toLowerCase() === "z") {
                            e.preventDefault();
                            if (e.shiftKey) {
                              handleRedo();
                            } else {
                              handleUndo();
                            }
                          } else if (isMod && e.key.toLowerCase() === "y") {
                            e.preventDefault();
                            handleRedo();
                          }
                        }}
                        onKeyUp={(e) => {
                          if (e.key === "Backspace" || e.key === "Delete") {
                            if (editorRef.current) {
                              let mutated = false;
                              const tableWrappers = editorRef.current.querySelectorAll(".table-embed-wrapper");
                              tableWrappers.forEach((wrapper) => {
                                if (!wrapper.querySelector("table")) {
                                  wrapper.remove();
                                  mutated = true;
                                }
                              });
                              const chartWrappers = editorRef.current.querySelectorAll(".chart-embed-wrapper");
                              chartWrappers.forEach((wrapper) => {
                                if (!wrapper.querySelector("svg") && !wrapper.querySelector("img")) {
                                  wrapper.remove();
                                  mutated = true;
                                }
                              });
                              if (mutated) {
                                const html = editorRef.current.innerHTML;
                                lastContentRef.current = html;
                                setDocumentContent(html);
                                setTabs((prev) =>
                                  prev.map((t) =>
                                    t.id === activeTabId ? { ...t, content: html } : t
                                  )
                                );
                                setDocSaveStatus("saving");
                              }
                            }
                          }
                        }}
                        onBlur={() => {
                          isTypingRef.current = false;
                          if (typingTimerRef.current) {
                            clearTimeout(typingTimerRef.current);
                          }
                          if (editorRef.current) {
                            const originalHtml = editorRef.current.innerHTML;
                            const html = linkifyHtml(originalHtml);
                            if (html !== originalHtml) {
                              editorRef.current.innerHTML = html;
                            }
                            lastContentRef.current = html;
                            setDocumentContent(html);
                            setTabs((prev) =>
                              prev.map((t) =>
                                t.id === activeTabId
                                  ? { ...t, content: html }
                                  : t,
                              ),
                            );
                            const currentTab = tabs.find(
                              (t) => t.id === activeTabId,
                            );
                            if (currentTab)
                              saveDraftToLibrary({
                                ...currentTab,
                                content: html,
                              });
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          pushToUndo();
                          isTypingRef.current = false;
                          if (typingTimerRef.current) {
                            clearTimeout(typingTimerRef.current);
                          }
                          const text = e.clipboardData.getData("text/plain");
                          if (text) {
                            const urlPattern =
                              /^(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]$|^(?:www\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])$/i;
                            let htmlToInsert = "";
                            if (urlPattern.test(text.trim())) {
                              const href = text
                                .trim()
                                .toLowerCase()
                                .startsWith("www.")
                                ? `http://${text.trim()}`
                                : text.trim();
                              htmlToInsert = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline cursor-pointer">${text.trim()}</a>`;
                            } else {
                              htmlToInsert = linkifyHtml(
                                text
                                  .replace(/&/g, "&amp;")
                                  .replace(/</g, "&lt;")
                                  .replace(/>/g, "&gt;"),
                              );
                            }
                            document.execCommand(
                              "insertHTML",
                              false,
                              htmlToInsert,
                            );
                          }
                        }}
                        onContextMenu={(e) => {
                          const target = e.target as HTMLElement;
                          const anchor = target.closest("a");
                          const table = target.closest("table") as HTMLTableElement | null;
                          const chart = target.closest(".chart-embed-wrapper") as HTMLElement | null;
                          
                          if (anchor) {
                            e.preventDefault();
                            e.stopPropagation();
                            setTableContextMenu(null);
                            setChartContextMenu(null);
                            setLinkContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              target: anchor,
                            });
                          } else if (table) {
                            e.preventDefault();
                            e.stopPropagation();
                            setLinkContextMenu(null);
                            setChartContextMenu(null);
                            const cell = target.closest("th, td") as HTMLTableCellElement | null;
                            setTableContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              target: table,
                              cell: cell,
                            });
                          } else if (chart) {
                            e.preventDefault();
                            e.stopPropagation();
                            setLinkContextMenu(null);
                            setTableContextMenu(null);
                            setChartContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              target: chart,
                            });
                          } else {
                            setLinkContextMenu(null);
                            setTableContextMenu(null);
                            setChartContextMenu(null);
                          }
                        }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          
                          // Handle delete button on embed wrappers (tables and charts)
                          if (target.closest(".embed-delete-btn")) {
                            e.preventDefault();
                            e.stopPropagation();
                            const wrapper = target.closest(".table-embed-wrapper, .chart-embed-wrapper");
                            if (wrapper) {
                              pushToUndo();
                              wrapper.remove();
                              
                              const html = editorRef.current?.innerHTML || "";
                              lastContentRef.current = html;
                              setDocumentContent(html);
                              setTabs((prev) =>
                                prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
                              );
                              setDocSaveStatus("saving");
                            }
                            return;
                          }

                          const anchor = target.closest("a");
                          if (anchor) {
                            const href = anchor.getAttribute("href");
                            if (href) {
                              e.preventDefault();
                              e.stopPropagation();

                              if (href.startsWith("#cite-page-")) {
                                // Custom citation coordinates link
                                const dataStr = href.replace("#cite-page-", "");
                                const firstHyphen = dataStr.indexOf("-");
                                if (firstHyphen !== -1) {
                                  const page = parseInt(
                                    dataStr.substring(0, firstHyphen),
                                  );
                                  const encodedTitle = dataStr.substring(
                                    firstHyphen + 1,
                                  );
                                  try {
                                    const title =
                                      decodeURIComponent(encodedTitle);
                                    handleCitationClick(page, title);
                                  } catch (err) {
                                    console.error(
                                      "Failed parsing citation target",
                                      err,
                                    );
                                  }
                                }
                              } else {
                                // Standard external URL link
                                const tempLink = document.createElement("a");
                                tempLink.href = href;
                                tempLink.target = "_blank";
                                tempLink.rel = "noopener noreferrer";
                                document.body.appendChild(tempLink);
                                tempLink.click();
                                document.body.removeChild(tempLink);
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <AnimatePresence>
            {isSidePanelOpen && activeTab.type === "document" && (
              <SidePanel
                isOpen={true}
                onClose={() => setIsSidePanelOpen(false)}
                tabId={activeTabId}
                activeTab={activeTab}
                papers={papers}
                onUpdatePaper={(updatedPaper) => {
                  dbSetPaper(updatedPaper);
                  if (
                    activeViewingPaper &&
                    activeViewingPaper.title === updatedPaper.title
                  ) {
                    setActiveViewingPaper(updatedPaper);
                  }
                }}
                extractTextFromPdf={extractTextFromPdf}
                currentUser={currentUser}
                storageMode={storageMode}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Section - AI Assistant Window Panel */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`p-[4px] flex h-full shrink-0 overflow-hidden ${isDesktopApp ? "pt-[38px]" : ""}`}
          >
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-[360px] md:w-[420px] bg-[#121212] rounded-2xl flex flex-col h-full shrink-0 overflow-hidden relative"
            >
            <div className={`flex flex-col h-full w-full transition-all duration-300 ${!isOnline ? "blur-[6px] select-none pointer-events-none" : ""}`}>
            {/* Assistant Header */}
            <div className={`h-[52px] flex items-center justify-between px-5 shrink-0 bg-[#121212] relative ${isDesktopApp ? "" : "[-webkit-app-region:drag]"}`}>
              <div className="relative flex-1 min-w-0 pr-4 [-webkit-app-region:no-drag]">
                <button
                  onClick={() =>
                    setIsAssistantChatDropdownOpen(!isAssistantChatDropdownOpen)
                  }
                  className="flex items-center gap-2 text-[#e4e4e7] hover:bg-[#1c1c1f] px-3 py-1.5 rounded-xl transition-colors cursor-pointer group max-w-full"
                >
                  <span className="font-semibold text-[13px] tracking-tight text-[#f4f4f5] truncate max-w-[240px]">
                    {(() => {
                      const chatTabs = tabs.filter((t) => t.type === "chat");
                      const currentChat =
                        chatTabs.find(
                          (t) =>
                            t.id ===
                            (activeAssistantTabId || activeTabIdRef.current),
                        ) || (chatTabs.length > 0 ? chatTabs[0] : null);
                      return currentChat
                        ? currentChat.title
                        : "Research Assistant";
                    })()}
                  </span>
                  <Icon
                    icon="ph:caret-down"
                    className={`w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-transform ${isAssistantChatDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isAssistantChatDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAssistantChatDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1.5 w-[200px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 max-h-72 overflow-y-auto shadow-2xl">
                      {getUniqueChats(allChats).map((chatTab) => (
                        <button
                          key={chatTab.id}
                          onClick={() => {
                            const isOpen = tabs.some(
                              (t) => t.id === chatTab.id,
                            );
                            if (isOpen) {
                              setActiveTabId(chatTab.id);
                              setActiveAssistantTabId(chatTab.id);
                            } else {
                              setTabs((prev) => [...prev, chatTab]);
                              setActiveTabId(chatTab.id);
                              setActiveAssistantTabId(chatTab.id);
                            }
                            setIsAssistantChatDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                            chatTab.id ===
                            (activeAssistantTabId ||
                              tabs.find((t) => t.type === "chat")?.id)
                              ? "bg-[#27272a] text-white"
                              : "text-zinc-400 hover:text-white hover:bg-[#222222]"
                          }`}
                        >
                          <Icon
                            icon="ph:chat-circle"
                            className="w-4 h-4 shrink-0 text-zinc-500"
                          />
                          <span className="text-xs font-medium truncate">
                            {translateDynamicTitle(chatTab.title)}
                          </span>
                        </button>
                      ))}
                      <div className="border-t border-[#2d2d30] my-1" />
                      <button
                        onClick={() => {
                          const newId = `chat-${Date.now()}`;
                          const newChatTab: Tab = {
                            id: newId,
                            type: "chat" as const,
                            title: "New chat",
                            messages: [],
                          };
                          setTabs([...tabs, newChatTab]);
                          setActiveAssistantTabId(newId);
                          setMessages([]);
                          setIsAssistantChatDropdownOpen(false);
                          saveChatToLibrary(currentUser?.uid || "guest", newChatTab);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
                        title="New Chat"
                      >
                        <MaterialIcon
                          name="add"
                          className="text-[18px] shrink-0 text-zinc-500"
                        />
                        <span className="text-xs font-semibold">New Chat</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  const targetId = activeAssistantTabId || tabs.find((t) => t.type === "chat")?.id;
                  if (targetId) {
                    onTabUpdate(targetId, { messages: [] });
                    showToast("Conversation cleared", "success");
                  }
                }}
                className="text-[#52525b] hover:text-[#e4e4e7] transition-colors p-[4px] rounded-md hover:bg-[#1c1c1e] cursor-pointer shrink-0 [-webkit-app-region:no-drag]"
                title="Restart Conversation"
              >
                <Icon icon="ph:arrow-counter-clockwise" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAssistantOpen(false)}
                className="text-[#52525b] hover:text-[#e4e4e7] transition-colors p-[4px] rounded-md hover:bg-[#1c1c1e] cursor-pointer shrink-0 [-webkit-app-region:no-drag]"
                aria-label="Close Assistant"
                title="Collapse Panel"
              >
                <Icon icon="ph:caret-double-right" className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Conversation Stream Pane (Scrollable completely independently from Left Editor view) */}
            <div 
              ref={chatScrollContainerRef}
              onScroll={(e) => {
                if (activeAssistantTabId) {
                  chatScrollPositionsRef.current[activeAssistantTabId] = e.currentTarget.scrollTop;
                }
              }}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121212] flex flex-col min-h-0"
            >
              {messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-12">
                  <img
                    src="/cosmi.png"
                    alt="Cosmi Logo"
                    className="w-24 h-24 md:w-32 md:h-32 opacity-25 select-none grayscale invert animate-fade-in"
                  />
                </div>
              ) : (
                messages
                  .filter((m) => !m.isHidden)
                  .reduce((acc: ChatMessage[], m) => {
                    if (!acc.some((x) => x.id === m.id)) {
                      acc.push(m);
                    }
                    return acc;
                  }, [])
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col w-full ${
                        m.role === "user" ? "items-end" : "items-start"
                      } gap-1.5`}
                    >
                      {/* Separate Attachment Bubble */}
                      {m.role === "user" && m.attachment && (
                        <div className="mb-0.5 w-fit self-end flex justify-end">
                          {m.attachment.mimetype?.startsWith("image/") ? (
                            <img 
                              src={m.attachment.url} 
                              alt="attachment" 
                              className="w-40 h-auto max-h-56 object-cover rounded-xl border border-zinc-800 pointer-events-auto cursor-zoom-in"
                              onClick={() => window.open(m.attachment!.url, "_blank")}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="max-w-[88%] bg-[#262626] text-white rounded-xl p-1.5 border border-zinc-800 flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0">
                                <Icon icon="ph:file-text" className="w-[18px] h-[18px]" />
                              </div>
                              <div className="min-w-0 flex-1 pr-2 mt-0.5">
                                <p className="text-[11px] font-semibold text-zinc-300 truncate pr-2 max-w-[130px]">{m.attachment.fileName}</p>
                                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wide">
                                  DOCUMENT FILE
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text message bubble */}
                      {(!m.attachment || (m.content && m.content.trim().length > 0) || m.role !== "user") && (
                        <div
                          className={`${
                            m.role === "user"
                              ? "self-end max-w-[88%] bg-[#262626] text-white rounded-[22px] px-6 py-3.5"
                              : "self-start max-w-full bg-transparent text-[#d4d4d8] py-2"
                          } text-[13px] leading-relaxed transition-all`}
                        >
                          {m.role === "assistant" && m.thought && (
                            <div className="mb-3">
                              <details className="group [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#71717a] hover:text-[#a1a1aa] transition-colors select-none w-fit">
                                  <Icon
                                    icon="ph:lightbulb"
                                    className="w-3.5 h-3.5"
                                  />
                                  <span>Thinking</span>
                                  <Icon
                                    icon="ph:caret-right"
                                    className="w-[10px] h-[10px] group-open:rotate-90 transition-transform"
                                  />
                                </summary>
                                <div className="mt-2 pl-3 border-l border-zinc-800 text-xs text-zinc-400 font-sans leading-relaxed markdown-body">
                                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(m.thought)}</ReactMarkdown>
                                </div>
                              </details>
                            </div>
                          )}
                          <div
                            className={`select-text ${m.role === "user" ? "break-words whitespace-pre-wrap" : "break-words markdown-body text-[#d4d4d8]"}`}
                          >
                            {m.role === "user" ? (
                              renderLinkifiedText(m.content)
                            ) : (
                              <TypewriterMarkdown
                                content={m.content}
                                timestamp={m.timestamp}
                                onCitationClick={handleCitationClick}
                                isStreaming={
                                  isAiTyping &&
                                  m.id === messages[messages.length - 1]?.id
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              )}

              {/* Streaming loading animation state */}
              {(isAiTyping || researchStatus) && !(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content?.trim() && !researchStatus) && (
                <div className="self-start bg-transparent py-2 max-w-full text-[13px] leading-relaxed select-none">
                  <DynamicShimmer
                    isAiTyping={isAiTyping}
                    researchStatus={researchStatus}
                    messages={messages}
                    webSearchEnabled={webSearchEnabled}
                  />
                </div>
              )}

              {/* Dummy Anchor for list focus */}
              <div ref={messagesEndRef} />
            </div>

            {/* Workspace Assistant Prompt Input Bar (Fixed at layout bottom) */}
            <div className="p-3.5 shrink-0 bg-[#121212]">
              {attachedFile && (
                <div className="mb-2 w-fit px-1 pt-1 animate-fade-in">
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
                        className="absolute -top-2 -right-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md hover:bg-zinc-700 font-semibold cursor-pointer"
                        title="Remove image"
                      >
                        <Icon icon="ph:x" className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#1a1a1c] border border-zinc-800 rounded-2xl px-3 py-2 flex items-center justify-between gap-3 shadow-sm max-w-[240px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0 shadow-inner">
                          <Icon icon="ph:file-text" className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 pr-2 flex flex-col justify-center">
                          <p className="text-[12px] font-semibold text-zinc-200 truncate pr-1">{attachedFile.fileName}</p>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                            DOCUMENT FILE
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAttachedFile(null)}
                        className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700"
                        title="Remove file"
                      >
                        <Icon icon="ph:x" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-[#222222] rounded-[10px] flex flex-col border border-transparent transition-colors relative">
                {/* Mention dropdown */}
                <AnimatePresence>
                  {agentMentionState.show && agentFilteredPapers.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute bottom-full left-2 mb-2 w-[300px] bg-[#222222] border border-zinc-800 rounded-2xl p-1.5 shadow-xl z-[150] flex flex-col gap-0.5 max-h-[180px] overflow-y-auto"
                    >
                      <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-[#2d2d30] mb-1">
                        Your Library Documents ({agentFilteredPapers.length})
                      </div>
                      {agentFilteredPapers.map((p, idx) => {
                        const isSelected = idx === agentMentionState.selectedIndex;
                        return (
                          <button
                            key={p.fileId ? `${p.fileId}-${idx}` : `${p.title}-${idx}`}
                            onClick={() => selectAgentPaper(p)}
                            onMouseEnter={() => setAgentMentionState(prev => ({ ...prev, selectedIndex: idx }))}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left ${
                              isSelected ? 'bg-zinc-850 text-white' : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Icon icon="ph:file-pdf" className="w-3.5 h-3.5 text-rose-450 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[12px] font-medium truncate">{p.title}</span>
                              {p.author && (
                                <span className="text-[9px] text-zinc-500 truncate">{p.author}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea
                  ref={assistantInputRef}
                  key={`assistant-chat-input-${activeTabId}`}
                  id={`assistant-chat-input-${activeTabId}`}
                  name={`assistant-chat-input-${activeTabId}`}
                  autoComplete="off"
                  placeholder="Ask about your research, sources, or draft content..."
                  value={assistantInput}
                  onChange={(e) => handleAgentTextareaChange(e.target.value, e.target.selectionStart)}
                  onKeyDown={(e) => {
                    if (agentMentionState.show && agentFilteredPapers.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setAgentMentionState(prev => ({
                          ...prev,
                          selectedIndex: (prev.selectedIndex + 1) % agentFilteredPapers.length
                        }));
                        return;
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setAgentMentionState(prev => ({
                          ...prev,
                          selectedIndex: (prev.selectedIndex - 1 + agentFilteredPapers.length) % agentFilteredPapers.length
                        }));
                        return;
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        selectAgentPaper(agentFilteredPapers[agentMentionState.selectedIndex]);
                        return;
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setAgentMentionState(prev => ({ ...prev, show: false }));
                        return;
                      }
                    }

                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(undefined, { fromSidePanel: true });
                    }
                  }}
                  className="w-full bg-transparent text-[13.5px] text-[#e4e4e7] placeholder-[#71717a] py-3 px-3.5 resize-none focus:outline-none min-h-[70px] leading-relaxed"
                />

                {/* Actions and Paper attachment triggers inside input frame */}
                <div className="flex justify-between items-center px-2 pb-2">
                  <div className="relative shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAgentPlusMenuOpen(!isAgentPlusMenuOpen)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                        isAgentPlusMenuOpen
                          ? "bg-[#222222] text-[#e4e4e7]"
                          : "text-[#71717a] hover:text-[#e4e4e7] bg-transparent hover:bg-[#222222]"
                      }`}
                      title="Upload or Search Options"
                    >
                      <Plus
                        className={`w-5 h-5 transition-transform duration-200 ${isAgentPlusMenuOpen ? "rotate-45" : ""}`}
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

                    {isAgentPlusMenuOpen && (
                      <>
                        {/* Transparent backdrop overlay for safe close */}
                        <div
                          className="fixed inset-0 z-[99] bg-transparent"
                          onClick={() => setIsAgentPlusMenuOpen(false)}
                        />

                        {/* Plus Options Menu */}
                        <div className="absolute bottom-full left-0 mb-2.5 w-[200px] bg-[#1a1a1e] border border-zinc-800/80 rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5">
                          {/* Upload files */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAgentPlusMenuOpen(false);
                              handlePaperclipClick();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-zinc-350 hover:text-white hover:bg-zinc-800/40 transition-none font-sans cursor-pointer"
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
                              setIsAgentPlusMenuOpen(false);
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

                  <div className="flex items-center gap-1">
                    {/* Model Choosing Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (isAgentModelMenuOpen) {
                            setIsAgentThinkingMenuOpen(false);
                          }
                          setIsAgentModelMenuOpen(!isAgentModelMenuOpen);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-colors text-[11px] font-semibold cursor-pointer bg-transparent hover:bg-[#2d2d30] font-jakarta ${
                          isAgentModelMenuOpen ? "text-[#e4e4e7]" : "text-[#71717a]"
                        }`}
                        title="Choose AI Model"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-white font-semibold">
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

                      {isAgentModelMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[99] bg-transparent" 
                            onClick={() => {
                              setIsAgentModelMenuOpen(false);
                              setIsAgentThinkingMenuOpen(false);
                              setIsAgentMoreModelsOpen(false);
                            }}
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute bottom-full right-0 mb-2 w-[220px] bg-[#1e1e22] border border-zinc-800/80 rounded-2xl p-1.5 shadow-2xl z-[100] flex flex-col gap-0.5"
                          >
                            {modelsList.filter(m => !['mistral-large-latest', 'codestral-latest', 'reka-flash', 'mimo-v2.5-pro', 'solar-pro2'].includes(m.id)).map((m) => {
                              const isSelected = selectedModel === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    setSelectedModel(m.id);
                                    setIsAgentModelMenuOpen(false);
                                    setIsAgentThinkingMenuOpen(false);
                                    setIsAgentMoreModelsOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                    isSelected ? 'bg-zinc-800/25 text-white' : 'text-zinc-300 hover:text-white'
                                  }`}
                                >
                                  <div className="w-4 flex items-center justify-center shrink-0">
                                    {isSelected ? (
                                      <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                                    ) : (
                                      <div className="w-3.5" />
                                    )}
                                  </div>
                                  <div className="text-left min-w-0">
                                    <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                      {m.label}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}

                            {/* More Models nested menu */}
                            <div 
                              onClick={() => {
                                setIsAgentMoreModelsOpen(!isAgentMoreModelsOpen);
                                setIsAgentThinkingMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                isAgentMoreModelsOpen ? 'bg-zinc-800/30' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-4 shrink-0 flex items-center justify-center">
                                  {['mistral-large-latest', 'codestral-latest', 'reka-flash', 'mimo-v2.5-pro', 'solar-pro2'].includes(selectedModel) ? (
                                    <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                                  ) : (
                                    <div className="w-3.5" />
                                  )}
                                </div>
                                <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">More models</span>
                              </div>
                              <Icon icon="ph:caret-right-bold" className="w-3 h-3 text-zinc-500 mr-1.5 shrink-0" />
                            </div>

                            <AnimatePresence>
                              {isAgentMoreModelsOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                  transition={{ duration: 0.15, ease: "easeOut" }}
                                  className="absolute inset-0 bg-[#1e1e22] rounded-2xl p-1.5 shadow-2xl z-[101] flex flex-col gap-0.5"
                                >
                                  <div className="flex items-center px-1 mb-1 border-b border-zinc-800/50 pb-1.5">
                                    <button 
                                      onClick={() => setIsAgentMoreModelsOpen(false)}
                                      className="p-1.5 hover:bg-zinc-800/60 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                    >
                                      <Icon icon="ph:caret-left-bold" className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest ml-1">More Models</span>
                                  </div>
                                  <div className="overflow-y-auto max-h-[300px]">
                                    {modelsList.filter(m => ['mistral-large-latest', 'codestral-latest', 'reka-flash', 'mimo-v2.5-pro', 'solar-pro2'].includes(m.id)).map((m) => {
                                      const isSelected = selectedModel === m.id;
                                      return (
                                        <button
                                          key={m.id}
                                          onClick={() => {
                                            setSelectedModel(m.id);
                                            setIsAgentModelMenuOpen(false);
                                            setIsAgentThinkingMenuOpen(false);
                                            setIsAgentMoreModelsOpen(false);
                                          }}
                                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                            isSelected ? 'bg-zinc-800/25 text-white' : 'text-zinc-300 hover:text-white'
                                          }`}
                                        >
                                          <div className="w-4 flex items-center justify-center shrink-0">
                                            {isSelected ? (
                                              <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                                            ) : (
                                              <div className="w-3.5" />
                                            )}
                                          </div>
                                          <div className="text-left min-w-0">
                                            <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                              {m.label}
                                            </span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="border-t border-[#2d2d30]/60 my-1" />

                            <div 
                              onClick={() => {
                                setIsAgentThinkingMenuOpen(!isAgentThinkingMenuOpen);
                                setIsAgentMoreModelsOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                isAgentThinkingMenuOpen ? 'bg-zinc-800/30' : ''
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

                            <AnimatePresence>
                              {isAgentThinkingMenuOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                  transition={{ duration: 0.15, ease: "easeOut" }}
                                  className="absolute inset-0 bg-[#1e1e22] rounded-2xl p-1.5 shadow-2xl z-[101] flex flex-col gap-0.5"
                                >
                                  <div className="flex items-center px-1 mb-1 border-b border-zinc-800/50 pb-1.5">
                                    <button 
                                      onClick={() => setIsAgentThinkingMenuOpen(false)}
                                      className="p-1.5 hover:bg-zinc-800/60 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                    >
                                      <Icon icon="ph:caret-left-bold" className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Thinking Level</span>
                                  </div>
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
                                          setIsAgentThinkingMenuOpen(false);
                                          setIsAgentModelMenuOpen(false);
                                        }}
                                        className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer font-jakarta hover:bg-zinc-800/40 ${
                                          isSelected ? 'bg-zinc-800/25 text-white' : 'text-zinc-300 hover:text-white'
                                        }`}
                                      >
                                        <div className="w-4 flex items-center justify-center shrink-0 pt-0.5">
                                          {isSelected ? (
                                            <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100 font-bold" />
                                          ) : (
                                            <div className="w-3.5" />
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-left min-w-0">
                                          <span className="text-[13.5px] font-semibold text-zinc-100 font-jakarta leading-tight">
                                            {opt.label}
                                          </span>
                                          <span className="text-[11.5px] text-zinc-400 font-jakarta leading-tight">
                                            {opt.desc}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </>
                      )}
                    </div>

                    {isAiTyping ? (
                      <button
                        onClick={() => {
                          abortControllerRef.current?.abort();
                          setIsAiTyping(false);
                          updateChatMessages((prev) => prev, false);
                        }}
                        className="text-[#f4f4f5] hover:bg-[#2d2d30] transition-colors p-[6px] rounded-md cursor-pointer"
                        title="Stop Generating"
                      >
                        <Icon
                          icon="ph:stop-fill"
                          className="w-5 h-5"
                        />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleSendMessage(undefined, { fromSidePanel: true })
                        }
                        disabled={!assistantInput.trim()}
                        className={`transition-colors p-[6px] rounded-md cursor-pointer ${
                          assistantInput.trim()
                            ? "text-[#f4f4f5] hover:bg-[#2d2d30]"
                            : "text-[#52525b] cursor-not-allowed"
                        }`}
                      >
                        <Plain2 weight="Linear" size={18} color="currentColor" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            </div>

            {!isOnline && (
              <div className="absolute inset-0 bg-transparent z-[99] flex flex-col items-center justify-center p-6 text-center animate-fade-in pointer-events-auto">
                <div className="bg-[#1a1a1a]/95 border border-zinc-800 rounded-2xl p-6 max-w-xs flex flex-col items-center gap-3.5 shadow-xl select-none">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {linkContextMenu && (
        <div
          id="link-context-menu"
          className="fixed z-[9999] bg-[#121212] border border-[#27272a] rounded-lg py-1 min-w-[160px] text-[#e4e4e7] select-none text-xs font-medium"
          style={{
            top: `${linkContextMenu.y}px`,
            left: `${linkContextMenu.x}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          <button
            id="btn-rename-hyperlink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const t = linkContextMenu.target;
              setLinkToRename({
                target: t,
                initialText: t.innerText || t.textContent || "",
                initialUrl: t.getAttribute("href") || "",
              });
              setRenameText(t.innerText || t.textContent || "");
              setRenameUrl(t.getAttribute("href") || "");
              setShowLinkRenameModal(true);
              setLinkContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-3 text-zinc-300 cursor-pointer text-xs font-medium group"
          >
            <Edit2 size={14} className="text-zinc-500 group-hover:text-zinc-300" />
            <span>Rename hyperlink</span>
          </button>

          <button
            id="btn-open-hyperlink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const href = linkContextMenu.target.getAttribute("href");
              if (href) {
                const tempLink = document.createElement("a");
                tempLink.href = href;
                tempLink.target = "_blank";
                tempLink.rel = "noopener noreferrer";
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);
              }
              setLinkContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-3 text-zinc-300 cursor-pointer border-t border-[#1a1a1c] mt-1 text-xs font-medium group"
          >
            <ExternalLink size={14} className="text-zinc-500 group-hover:text-zinc-300" />
            <span>Open link</span>
          </button>

          <button
            id="btn-remove-hyperlink"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const t = linkContextMenu.target;
              if (t) {
                // Remove anchor tag, keeping the inline text content
                const parent = t.parentNode;
                if (parent) {
                  while (t.firstChild) {
                    parent.insertBefore(t.firstChild, t);
                  }
                  parent.removeChild(t);
                }

                // Sync to state
                if (editorRef.current) {
                  const html = editorRef.current.innerHTML;
                  lastContentRef.current = html;
                  setDocumentContent(html);
                }
              }
              setLinkContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 border-t border-[#1a1a1c] cursor-pointer"
          >
            <Unlink size={13} />
            <span>Remove link</span>
          </button>
        </div>
      )}

      {tableContextMenu && (
        <div
          id="table-context-menu"
          className="fixed z-[9999] bg-[#121212] border border-[#27272a] rounded-lg py-1 min-w-[180px] text-[#e4e4e7] select-none text-xs font-medium shadow-2xl"
          style={{
            top: `${tableContextMenu.y}px`,
            left: `${tableContextMenu.x}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          {tableContextMenu.cell && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const curRow = targetCell?.closest("tr");
                  if (curRow && editorRef.current) {
                    const numCells = curRow.children.length;
                    const isHeader = curRow.closest("thead") !== null;
                    const newRow = document.createElement("tr");
                    newRow.style.borderBottom = "1px solid #27272a";
                    for (let i = 0; i < numCells; i++) {
                      const cellTag = isHeader ? "th" : "td";
                      const newCell = document.createElement(cellTag);
                      newCell.style.padding = "10px 12px";
                      newCell.style.color = isHeader ? "#e4e4e7" : "#d4d4d8";
                      if (isHeader) {
                        newCell.style.fontWeight = "600";
                        newCell.style.textAlign = "left";
                      }
                      if (i < numCells - 1) {
                        newCell.style.borderRight = "1px solid #27272a";
                      }
                      newCell.innerHTML = isHeader ? `Header` : `Cell`;
                      newRow.appendChild(newCell);
                    }
                    curRow.parentNode?.insertBefore(newRow, curRow);
                    
                    const html = editorRef.current.innerHTML;
                    lastContentRef.current = html;
                    setDocumentContent(html);
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTabId ? { ...tb, content: html } : tb,
                      ),
                    );
                    setDocSaveStatus("saving");
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-3 cursor-pointer text-zinc-300 text-xs font-medium group"
              >
                <Icon icon="ph:arrow-fat-up-light" className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                <span>Insert Row Above</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const curRow = targetCell?.closest("tr");
                  if (curRow && editorRef.current) {
                    const numCells = curRow.children.length;
                    const newRow = document.createElement("tr");
                    newRow.style.borderBottom = "1px solid #27272a";
                    for (let i = 0; i < numCells; i++) {
                      const cellTag = "td";
                      const newCell = document.createElement(cellTag);
                      newCell.style.padding = "10px 12px";
                      newCell.style.color = "#d4d4d8";
                      if (i < numCells - 1) {
                        newCell.style.borderRight = "1px solid #27272a";
                      }
                      newCell.innerHTML = `Cell`;
                      newRow.appendChild(newCell);
                    }
                    curRow.parentNode?.insertBefore(newRow, curRow.nextSibling);
                    
                    const html = editorRef.current.innerHTML;
                    lastContentRef.current = html;
                    setDocumentContent(html);
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTabId ? { ...tb, content: html } : tb,
                      ),
                    );
                    setDocSaveStatus("saving");
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-3 cursor-pointer text-zinc-300 text-xs font-medium group"
              >
                <Icon icon="ph:arrow-fat-down-light" className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                <span>Insert Row Below</span>
              </button>

              <div className="h-[1px] bg-[#2d2d30] my-1 mx-1" />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const table = tableContextMenu.target;
                  if (targetCell && table && editorRef.current) {
                    const colIndex = targetCell.cellIndex;
                    if (colIndex !== undefined && colIndex !== -1) {
                      const rows = table.querySelectorAll("tr");
                      rows.forEach((r) => {
                        const cells = Array.from(r.children);
                        const originCell = cells[colIndex];
                        if (originCell) {
                          const isHeader = originCell.nodeName === "TH";
                          const newCell = document.createElement(isHeader ? "th" : "td");
                          newCell.style.padding = "10px 12px";
                          newCell.style.color = isHeader ? "#e4e4e7" : "#d4d4d8";
                          newCell.innerHTML = isHeader ? "Header" : "Cell";
                          if (isHeader) {
                            newCell.style.fontWeight = "600";
                            newCell.style.textAlign = "left";
                          }
                          r.insertBefore(newCell, originCell);
                        }
                      });

                      table.querySelectorAll("tr").forEach((r) => {
                        const cells = Array.from(r.children) as HTMLElement[];
                        cells.forEach((cell, idx) => {
                          cell.style.borderRight = idx === cells.length - 1 ? "none" : "1px solid #27272a";
                        });
                      });

                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                      setTabs((prev) =>
                        prev.map((tb) =>
                          tb.id === activeTabId ? { ...tb, content: html } : tb,
                        ),
                      );
                      setDocSaveStatus("saving");
                    }
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-3 cursor-pointer text-zinc-300 text-xs font-medium group"
              >
                <Icon icon="ph:arrow-fat-left-light" className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                <span>Insert Column Left</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const table = tableContextMenu.target;
                  if (targetCell && table && editorRef.current) {
                    const colIndex = targetCell.cellIndex;
                    if (colIndex !== undefined && colIndex !== -1) {
                      const rows = table.querySelectorAll("tr");
                      rows.forEach((r) => {
                        const cells = Array.from(r.children);
                        const originCell = cells[colIndex];
                        if (originCell) {
                          const isHeader = originCell.nodeName === "TH";
                          const newCell = document.createElement(isHeader ? "th" : "td");
                          newCell.style.padding = "10px 12px";
                          newCell.style.color = isHeader ? "#e4e4e7" : "#d4d4d8";
                          newCell.innerHTML = isHeader ? "Header" : "Cell";
                          if (isHeader) {
                            newCell.style.fontWeight = "600";
                            newCell.style.textAlign = "left";
                          }
                          r.insertBefore(newCell, originCell.nextSibling);
                        }
                      });

                      table.querySelectorAll("tr").forEach((r) => {
                        const cells = Array.from(r.children) as HTMLElement[];
                        cells.forEach((cell, idx) => {
                          cell.style.borderRight = idx === cells.length - 1 ? "none" : "1px solid #27272a";
                        });
                      });

                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                      setTabs((prev) =>
                        prev.map((tb) =>
                          tb.id === activeTabId ? { ...tb, content: html } : tb,
                        ),
                      );
                      setDocSaveStatus("saving");
                    }
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-3 cursor-pointer text-zinc-300 text-xs font-medium group"
              >
                <Icon icon="ph:arrow-fat-right-light" className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
                <span>Insert Column Right</span>
              </button>

              <div className="h-[1px] bg-[#2d2d30] my-1 mx-1" />

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const curRow = targetCell?.closest("tr");
                  const table = tableContextMenu.target;
                  if (curRow && table && editorRef.current) {
                    curRow.remove();
                    if (table.querySelectorAll("tr").length === 0) {
                      table.remove();
                    }
                    
                    const html = editorRef.current.innerHTML;
                    lastContentRef.current = html;
                    setDocumentContent(html);
                    setTabs((prev) =>
                      prev.map((tb) =>
                        tb.id === activeTabId ? { ...tb, content: html } : tb,
                      ),
                    );
                    setDocSaveStatus("saving");
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-3 cursor-pointer text-xs font-medium group"
              >
                <Icon icon="ph:minus" className="w-4 h-4" />
                <span>Remove Current Row</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pushToUndo();
                  const targetCell = tableContextMenu.cell;
                  const table = tableContextMenu.target;
                  if (targetCell && table && editorRef.current) {
                    const colIndex = targetCell.cellIndex;
                    if (colIndex !== undefined && colIndex !== -1) {
                      const rows = table.querySelectorAll("tr");
                      rows.forEach((r) => {
                        const cells = Array.from(r.children);
                        if (cells[colIndex]) {
                          cells[colIndex].remove();
                        }
                      });

                      const firstRow = table.querySelector("tr");
                      if (!firstRow || firstRow.children.length === 0) {
                        table.remove();
                      } else {
                        table.querySelectorAll("tr").forEach((r) => {
                          const cells = Array.from(r.children) as HTMLElement[];
                          cells.forEach((cell, idx) => {
                            cell.style.borderRight = idx === cells.length - 1 ? "none" : "1px solid #27272a";
                          });
                        });
                      }

                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                      setTabs((prev) =>
                        prev.map((tb) =>
                          tb.id === activeTabId ? { ...tb, content: html } : tb,
                        ),
                      );
                      setDocSaveStatus("saving");
                    }
                  }
                  setTableContextMenu(null);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-3 cursor-pointer text-xs font-medium group"
              >
                <Icon icon="ph:columns-light" className="w-4 h-4" />
                <span>Remove Current Column</span>
              </button>

              <div className="h-[1px] bg-[#2d2d30] my-1 mx-1" />
            </>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pushToUndo();
              const t = tableContextMenu.target;
              if (t) {
                t.remove();
                if (editorRef.current) {
                  const html = editorRef.current.innerHTML;
                  lastContentRef.current = html;
                  setDocumentContent(html);
                  setTabs((prev) =>
                    prev.map((tb) =>
                      tb.id === activeTabId ? { ...tb, content: html } : tb,
                    ),
                  );
                  setDocSaveStatus("saving");
                }
              }
              setTableContextMenu(null);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-3 cursor-pointer text-xs font-semibold group"
          >
            <Icon icon="ph:trash" className="w-4 h-4" />
            <span>Remove Entire Table</span>
          </button>
        </div>
      )}

      {chartContextMenu && (
        <div
          id="chart-context-menu"
          className="fixed z-[9999] bg-[#121212] border border-[#27272a] rounded-lg py-1 min-w-[180px] text-[#e4e4e7] select-none text-xs font-medium shadow-2xl"
          style={{
            top: `${chartContextMenu.y}px`,
            left: `${chartContextMenu.x}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const t = chartContextMenu.target;
              if (t) {
                const rawState = t.getAttribute('data-chart-state');
                if (rawState) {
                  try {
                    const decoded = JSON.parse(decodeURIComponent(atob(rawState)));
                    if (decoded.chartType) setChartType(decoded.chartType);
                    if (decoded.chartTitle !== undefined) setChartTitle(decoded.chartTitle);
                    if (decoded.chartDataColor) setChartDataColor(decoded.chartDataColor);
                    if (decoded.chartLabels) setChartLabels(decoded.chartLabels);
                    if (decoded.chartValues) setChartValues(decoded.chartValues);
                    if (decoded.chartIndividualColors) {
                      setChartIndividualColors(decoded.chartIndividualColors);
                    } else {
                      setChartIndividualColors([]);
                    }
                    setOpenRowColorPickerIdx(null);
                  } catch (err) {
                    console.warn("Could not decode chart state");
                  }
                }
                t.setAttribute('data-is-editing', 'true');
                setChartBeingEdited(t);
                setIsChartModalOpen(true);
              }
              setChartContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Edit2 size={13} />
            <span>Modify Chart</span>
          </button>
          
          <div className="h-[1px] bg-[#1a1a1c] w-full" />
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pushToUndo();
              const t = chartContextMenu.target;
              if (t) {
                // If it is followed by an empty p tag, maybe remove that too (optional, let's keep it simple)
                t.remove();
                if (editorRef.current) {
                  const html = editorRef.current.innerHTML;
                  lastContentRef.current = html;
                  setDocumentContent(html);
                  setTabs((prev) =>
                    prev.map((tb) =>
                      tb.id === activeTabId ? { ...tb, content: html } : tb,
                    ),
                  );
                  setDocSaveStatus("saving");
                }
              }
              setChartContextMenu(null);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-[#202022] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 cursor-pointer font-semibold"
          >
            <Icon icon="ph:trash" className="w-[14px] h-[14px]" />
            <span>Remove Chart</span>
          </button>
        </div>
      )}

      {showLinkRenameModal && linkToRename && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 select-none"
          onClick={() => {
            setShowLinkRenameModal(false);
            setLinkToRename(null);
          }}
        >
          <div
            className="bg-[#121212] border border-[#27272a] rounded-xl p-5 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[#f4f4f5] font-medium text-base mb-4 flex items-center gap-2 border-b border-[#222224] pb-2">
              <LinkIcon size={16} className="text-blue-400" />
              Rename Hyperlink
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Display Word/Text
                </label>
                <input
                  type="text"
                  className="w-full bg-[#1e1e1e] border border-[#27272a] rounded-lg px-3 py-2.5 text-zinc-200 text-xs focus:border-zinc-500 focus:outline-none placeholder:text-zinc-600 transition-colors"
                  placeholder="e.g., Disney History"
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const anchor = linkToRename.target;
                      if (anchor) {
                        anchor.innerText =
                          renameText.trim() || renameUrl.trim();
                        anchor.setAttribute("href", renameUrl.trim());
                        if (editorRef.current) {
                          const html = editorRef.current.innerHTML;
                          lastContentRef.current = html;
                          setDocumentContent(html);
                        }
                      }
                      setShowLinkRenameModal(false);
                      setLinkToRename(null);
                    }
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  URL Destination
                </label>
                <input
                  type="text"
                  className="w-full bg-[#1e1e1e] border border-[#27272a] rounded-lg px-3 py-2.5 text-zinc-200 text-xs focus:border-zinc-500 focus:outline-none placeholder:text-zinc-600 transition-colors cursor-text"
                  placeholder="https://..."
                  value={renameUrl}
                  onChange={(e) => setRenameUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const anchor = linkToRename.target;
                      if (anchor) {
                        anchor.innerText =
                          renameText.trim() || renameUrl.trim();
                        anchor.setAttribute("href", renameUrl.trim());
                        if (editorRef.current) {
                          const html = editorRef.current.innerHTML;
                          lastContentRef.current = html;
                          setDocumentContent(html);
                        }
                      }
                      setShowLinkRenameModal(false);
                      setLinkToRename(null);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-[#222224]">
              <button
                onClick={() => {
                  setShowLinkRenameModal(false);
                  setLinkToRename(null);
                }}
                className="px-3.5 py-2 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const anchor = linkToRename.target;
                  if (anchor) {
                    anchor.innerText = renameText.trim() || renameUrl.trim();
                    anchor.setAttribute("href", renameUrl.trim());

                    if (editorRef.current) {
                      const html = editorRef.current.innerHTML;
                      lastContentRef.current = html;
                      setDocumentContent(html);
                    }
                  }
                  setShowLinkRenameModal(false);
                  setLinkToRename(null);
                  showToast("Hyperlink updated successfully", "success");
                }}
                className="px-3.5 py-2 rounded-lg text-xs bg-zinc-100 hover:bg-white text-black font-semibold transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Deletion Confirmation Modal - Now Handled by ModalManager */}

      {isLoggingOut && (
        <div className="fixed inset-0 z-[20000] bg-black flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center"
          >
            <h2
              className="text-lg font-medium tracking-tight text-white shimmer-text"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              Logging out...
            </h2>
          </motion.div>
        </div>
      )}



      {/* Zero-Glow Multi-User Share Modal */}
      {isShareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
        >
          <div className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 relative animate-scale-up text-zinc-300">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer focus:outline-none"
            >
              <Icon icon="ph:x" className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1.5 text-[#f4f4f5]">
              <Icon
                icon="ph:share-network-fill"
                className="w-5 h-5 text-zinc-400"
              />
              <h3 className="text-base font-semibold leading-normal truncate">
                Share &ldquo;{documentTitle || "Untitled Document"}&rdquo;
              </h3>
            </div>
            <p className="text-zinc-400 text-xs mb-5">
              Generate a shareable link to this document.
            </p>

            {/* General Access removed as per user request to only share documents and owner only typing */}

            {/* Copier Input Bar */}
            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Shareable link
              </label>
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <Icon
                    icon="ph:link"
                    className="w-[15px] h-[15px] text-zinc-500 shrink-0"
                  />
                  {isSharingLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-[11px] font-mono">
                      <Icon
                        icon="ph:spinner-gap"
                        className="w-3.5 h-3.5 animate-spin text-zinc-500"
                      />
                      <span>Generating shareable path...</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="bg-transparent text-[#f4f4f5] font-mono text-[11px] outline-none border-none p-0 w-full select-all cursor-text focus:outline-none"
                      placeholder="Link will be populated below"
                    />
                  )}
                </div>
                {!isSharingLoading && generatedLink && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      showToast("Copied link to clipboard!", "success");
                    }}
                    className="shrink-0 bg-zinc-200 hover:bg-white text-[#09090b] font-semibold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors focus:outline-none"
                  >
                    Copy Link
                  </button>
                )}
              </div>
            </div>

            {/* People with Access Display */}
            <div className="border-t border-[#27272a] pt-4 mb-5">
              <h4 className="text-[11.5px] font-semibold text-[#f4f4f5] mb-3">
                People with access
              </h4>

              <div className="max-h-[140px] overflow-y-auto custom-scrollbar-v space-y-2.5 pr-1">
                {/* Current User */}
                <div className="flex items-center justify-between py-1 px-1 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 border border-[#27272a] overflow-hidden text-[#e4e4e7]">
                      {localStorage.getItem(`cosmi_settings_avatar_url_${currentUser?.uid || "guest"}`) || currentUser?.photoURL ? (
                        <img
                          src={localStorage.getItem(`cosmi_settings_avatar_url_${currentUser?.uid || "guest"}`) || currentUser?.photoURL || ""}
                          alt="You"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-xs font-bold uppercase">
                          {
                            (localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                              currentUser?.displayName ||
                              currentUser?.email?.split("@")[0] ||
                              "Y")[0]
                          }
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#f4f4f5] leading-none mb-1">
                        {localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                          currentUser?.displayName ||
                          currentUser?.email?.split("@")[0] ||
                          "Guest user"}{" "}
                        (You)
                      </p>
                      <p className="text-[9.5px] text-zinc-500">
                        {currentUser?.email || "Guest Session"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/40 px-2 py-0.5 rounded border border-[#27272a]">
                    Owner
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#27272a]">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 bg-[#27272a] hover:bg-[#323235] text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors focus:outline-none"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isKeyboardShortcutsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsKeyboardShortcutsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-2xl border border-zinc-800 flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
                <h2 className="text-xl font-semibold text-white">Keyboard shortcuts</h2>
                <button
                  onClick={() => setIsKeyboardShortcutsOpen(false)}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-700"
                >
                  <Icon icon="ph:x" className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 overflow-y-auto custom-scrollbar flex flex-col gap-8 px-6 py-6">
                
                <div className="space-y-4">
                  <h3 className="text-[13px] font-semibold text-zinc-400">General</h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Switch tabs (1-9)</span>
                    <div className="flex gap-1.5">
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Num</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">New tab</span>
                    <div className="flex gap-1.5">
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">T</kbd>
                    </div>
                  </div>

                  {isDesktopApp && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">Close current tab</span>
                        <div className="flex gap-1.5">
                          <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                          <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">W</kbd>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">Close app</span>
                        <div className="flex gap-1.5">
                          <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Alt</kbd>
                          <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">F4</kbd>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-[13px] font-semibold text-zinc-400">Editor</h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Toggle side panel</span>
                    <div className="flex gap-1.5">
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">P</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Undo</span>
                    <div className="flex gap-1.5">
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Z</kbd>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Redo</span>
                    <div className="flex gap-1.5 flex-col items-end">
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                        <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Y</kbd>
                      </div>
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Ctrl</kbd>
                        <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Shift</kbd>
                        <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Z</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[13px] font-semibold text-zinc-400">In chats</h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Send message</span>
                    <div className="flex gap-1.5">
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Enter</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">New line in message</span>
                    <div className="flex gap-1.5">
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Shift</kbd>
                      <kbd className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/80 rounded text-[13px] font-medium text-zinc-300">Enter</kbd>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsModalOpen && (
          <Settings 
            currentUser={currentUser} 
            onClose={() => setIsSettingsModalOpen(false)} 
            webSearchEnabled={webSearchEnabled}
            setWebSearchEnabled={setWebSearchEnabled}
            latexEnabled={latexEnabled}
            setLatexEnabled={setLatexEnabled}
            autoDraftEnabled={autoDraftEnabled}
            setAutoDraftEnabled={setAutoDraftEnabled}
            editorFont={editorFont}
            setEditorFont={setEditorFont}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            callMe={callMe}
            setCallMe={setCallMe}
            storageMode={storageMode}
            setStorageMode={setStorageMode}
            appearanceTheme={appearanceTheme}
            setAppearanceTheme={setAppearanceTheme}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isChartModalOpen && (
          <ChartModal
            closeChartModal={closeChartModal}
            chartType={chartType}
            setChartType={setChartType}
            chartTitle={chartTitle}
            setChartTitle={setChartTitle}
            chartDataColor={chartDataColor}
            setChartDataColor={setChartDataColor}
            chartLabels={chartLabels}
            setChartLabels={setChartLabels}
            chartValues={chartValues}
            setChartValues={setChartValues}
            chartIndividualColors={chartIndividualColors}
            setChartIndividualColors={setChartIndividualColors}
            handleInsertChart={handleInsertChart}
            chartBeingEdited={chartBeingEdited}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/75 z-[110] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 relative text-zinc-300"
            >
              <button
                onClick={() => {
                  if (!isAnalyzingLink) {
                    setImportModalOpen(false);
                  }
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer disabled:opacity-50"
                disabled={isAnalyzingLink}
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-1.5">
                {importType === "youtube" ? (
                  <img
                    src="https://www.gstatic.com/images/branding/product/1x/youtube_64dp.png"
                    alt="YouTube"
                    className="w-5 h-5 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : importType === "gdoc" ? (
                  <img
                    src="https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png"
                    alt="Google Docs"
                    className="w-5 h-5 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Icon
                    icon="ph:link"
                    className="w-5 h-5 text-zinc-400"
                  />
                )}
                <h3 className="text-[#f4f4f5] text-lg font-medium">
                  {importType === "youtube"
                    ? "Import & Summarize YouTube Video"
                    : importType === "gdoc"
                      ? "Import & Summarize Google Doc"
                      : "Import & Summarize Public URL"}
                </h3>
              </div>
              <p className="text-[#71717a] text-xs mb-5">
                {importType === "youtube"
                  ? "Input any public video link. We will resolve its title, channel name, and use the Gemini Success Mentor model to produce an academic summary."
                  : importType === "gdoc"
                    ? 'Paste a public Google Doc link. Ensure link sharing is enabled as "Anyone with the link can view". We will download and structure the text content.'
                    : "Paste any webpage, paper link, or blog article. We will crawl the clean document text and synthesize it into a library literature note."}
              </p>

              <form
                onSubmit={handleLinkImportSubmit}
                className="space-y-4 text-xs font-sans"
              >
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    {importType === "youtube"
                      ? "YouTube Video Link"
                      : importType === "gdoc"
                        ? "Google Doc URL"
                        : "Public URL"}
                  </label>
                  <input
                    type="url"
                    required
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    disabled={isAnalyzingLink}
                    placeholder={
                      importType === "youtube"
                        ? "https://www.youtube.com/watch?v=F3GCo2Y-A9o"
                        : importType === "gdoc"
                          ? "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvGdBAnlgY5iK1mJH/edit"
                          : "https://en.wikipedia.org/wiki/Neuroplasticity"
                    }
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2.5 text-zinc-200 text-xs focus:border-zinc-500 focus:outline-none placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                  />
                </div>

                {linkAnalyzeError && (
                  <div className="flex gap-2.5 items-start p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl">
                    <Icon
                      icon="ph:warning-circle"
                      className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                    />
                    <span className="text-red-400 text-xs leading-relaxed font-medium">
                      {linkAnalyzeError}
                    </span>
                  </div>
                )}

                {isAnalyzingLink && (
                  <div className="flex flex-col gap-2.5 items-center justify-center p-6 bg-[#18181b] border border-[#27272a] rounded-xl text-center">
                    <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                    <div className="text-zinc-300 font-medium text-xs">
                      Analyzing and Synthesizing Link Source...
                    </div>
                    <div className="text-[10px] font-mono text-[#71717a] max-w-sm leading-relaxed">
                      {linkAnalyzeStatus}
                    </div>
                  </div>
                )}

                {!isAnalyzingLink && (
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(false)}
                      className="flex-1 py-2.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-zinc-200 hover:bg-white text-zinc-950 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                    >
                      Import & Summarize
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}

        {activeViewingPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/75 z-[105] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-2xl p-6 relative text-zinc-300"
            >
              <button
                onClick={() => setActiveViewingPaper(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <h3 className="text-[#f4f4f5] text-xl font-medium leading-snug mb-1">
                {activeViewingPaper.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#71717a] border-b border-[#27272a] pb-4 mb-4">
                {activeViewingPaper.author && (
                  <div className="flex items-center gap-1">
                    <Icon
                      icon="ph:user"
                      className="w-3.5 h-3.5 text-zinc-500"
                    />
                    <span>{activeViewingPaper.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Icon
                    icon="ph:calendar"
                    className="w-3.5 h-3.5 text-zinc-500"
                  />
                  <span>
                    Added: {activeViewingPaper.added || "Today"}
                  </span>
                </div>
                {activeViewingPaper.url && (
                  <a
                    href={activeViewingPaper.url}
                    target="_blank"
                    rel="noreferrer"
                    referrerPolicy="no-referrer"
                    className="flex items-center gap-1 text-[#0070f3] hover:underline"
                  >
                    <Icon icon="ph:link" className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">
                      {activeViewingPaper.url}
                    </span>
                  </a>
                )}
              </div>

              <div className="space-y-4 text-sm leading-relaxed max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {activeViewingPaper.summary ? (
                  <div className="markdown-body prose prose-invert max-w-none text-sm text-[#d4d4d8] font-sans">
                    <ReactMarkdown>
                      {formatAbstractText(
                        activeViewingPaper.summary,
                      ).replace(/\\n/g, "\n")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[#d4d4d8] font-sans whitespace-pre-wrap">
                    {activeViewingPaper.description
                      ? formatAbstractText(
                          activeViewingPaper.description,
                        ).replace(/\\n/g, "\n")
                      : ""}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-[#27272a]">
                <button
                  onClick={() => {
                    const summaryText =
                      activeViewingPaper.summary ||
                      activeViewingPaper.description;
                    navigator.clipboard.writeText(summaryText);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#27272a] hover:bg-[#1a1a1a] rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Icon icon="ph:copy" className="w-3.5 h-3.5" />
                  <span>Copy Summary</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveViewingPaper(null)}
                    className="px-5 py-2.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        <ModalManager
          activeModal={activeModal}
          onClose={handleCloseModal}
          folderToDelete={folderToDelete}
          onDeleteFolderConfirm={() => {
            if (folderToDelete) {
              dbDeleteFolder(folderToDelete.id);
              setIsDeleteFolderModalOpen(false);
              setFolderToDelete(null);
            }
          }}
          tabIdToDelete={tabIdToDelete}
          onCloseTabConfirm={() => {
            if (tabIdToDelete) {
              closeTab(tabIdToDelete);
            }
            setIsDeleteConfirmOpen(false);
            setTabIdToDelete(null);
          }}
          chatIdToDelete={chatIdToDelete}
          onDeleteChatConfirm={() => {
            if (chatIdToDelete) {
              deleteChatPermanently(chatIdToDelete);
              setChatIdToDelete(null);
            }
          }}
          selectedPapersCount={selectedPapers.length}
          onDeleteSelectionConfirm={() => {
            selectedPapers.forEach((title) => dbDeletePaper(title));
            setSelectedPapers([]);
            setIsDeleteSelectionConfirmOpen(false);
          }}
          onExitAppConfirm={() => {
            setIsExitConfirmOpen(false);
            handleCloseApp();
          }}
        />

        {addModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 z-[105] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 relative"
            >
              <button
                onClick={() => setAddModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <h3 className="text-[#f4f4f5] text-lg font-medium mb-1">
                Add Library Entry
              </h3>
              <p className="text-[#71717a] text-xs mb-5">
                Manually record a dissertation reference summary or raw
                project findings
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPaperTitle.trim()) return;

                  const newlyCreated: PaperItem = {
                    title: newPaperTitle,
                    author: newPaperAuthors.trim() || "",
                    fileType: newPaperType,
                    description:
                      newPaperDescription.trim() ||
                      "Manually inserted student draft documentation.",
                    added: "Today",
                    fullTextStatus: "Available",
                    viewed: "Just now",
                    summary: "",
                  };

                  dbSetPaper(newlyCreated);

                  // Create and switch to a new document tab with the content
                  const newTabId = `manual-${Date.now()}`;
                  setTabs((prev) => [
                    ...prev,
                    {
                      id: newTabId,
                      type: "document",
                      title: newPaperTitle,
                      content: `<p>${newlyCreated.description}</p>`,
                    },
                  ]);
                  setActiveTabId(newTabId);

                  setAddModalOpen(false);
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    File type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPaperType("Document")}
                      className={`flex-1 py-2 text-center rounded-xl border font-medium cursor-pointer ${newPaperType === "Document" ? "bg-[#27272a] border-[#52525b] text-white" : "bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200"}`}
                    >
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPaperType("Note")}
                      className={`flex-1 py-2 text-center rounded-xl border font-medium cursor-pointer ${newPaperType === "Note" ? "bg-[#27272a] border-[#52525b] text-white" : "bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-zinc-200"}`}
                    >
                      Note
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newPaperTitle}
                    onChange={(e) => setNewPaperTitle(e.target.value)}
                    placeholder="e.g. Cognitive Rehabilitation Post Stroke"
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    Authors (optional)
                  </label>
                  <input
                    type="text"
                    value={newPaperAuthors}
                    onChange={(e) => setNewPaperAuthors(e.target.value)}
                    placeholder="e.g. Graybiel, et al."
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                    Abstract / Description (optional)
                  </label>
                  <textarea
                    rows={2.5}
                    value={newPaperDescription}
                    onChange={(e) =>
                      setNewPaperDescription(e.target.value)
                    }
                    placeholder="Provide details about findings, hypotheses or methodology parameters..."
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-zinc-200 hover:bg-white text-zinc-950 font-semibold rounded-xl transition-colors cursor-pointer mt-2"
                >
                  Confirm and Add to Grid Structure
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showBuyCoffeeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#2d2d30] rounded-2xl w-full max-w-[420px] p-6 relative flex flex-col overflow-hidden select-none"
            >
              <button
                onClick={() => {
                  setShowBuyCoffeeModal(false);
                  setSupportAmountPaid(null);
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer p-1 rounded-md hover:bg-[#1a1a1c] transition-colors"
                title="Close dialog"
              >
                <XIcon className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center space-y-4 pt-1">
                {/* Coffee cup box */}
                <div className="w-12 h-12 rounded-xl bg-[#221714] border border-[#44312a] flex items-center justify-center text-[#e3a088]">
                  <Mug weight="Outline" className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-100 font-jakarta">
                    Support AI Research Workspace
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-sans font-semibold uppercase tracking-wider">
                    Keep the model intelligence active ☕
                  </p>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed px-1">
                  If our draft optimizer, citation indexers, automatic
                  web synthesis, or study panels have saved you time,
                  consider buying us a coffee by scanning the QR code below.
                </p>

                {/* QR Code Container */}
                <div className="bg-white p-3.5 rounded-2xl flex flex-col items-center justify-center border border-zinc-200 shadow-md my-1 w-[184px] h-[184px]">
                  <svg width="156" height="156" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
                    {/* Finder Pattern Top-Left */}
                    <path d="M0 0h7v7H0V0zm1 1v5h5V1H1zm1 1h3v3H2V2z" fill="currentColor"/>
                    {/* Finder Pattern Top-Right */}
                    <path d="M22 0h7v7h-7V0zm1 1v5h5V1h-1zm1 1h3v3h-3V2z" fill="currentColor"/>
                    {/* Finder Pattern Bottom-Left */}
                    <path d="M0 22h7v7H0v-7zm1 1v5h5v-5H1zm1 1h3v3H2v-3z" fill="currentColor"/>
                    {/* Alignment Pattern Bottom-Right */}
                    <path d="M20 20h5v5h-5v-5zm1 1v3h3v-3h-3zm1 1h1v1h-1v-1z" fill="currentColor"/>
                    {/* Timing Pattern Horizontal */}
                    <path d="M8 6h1v1H8V6zm2 0h1v1h-1V6zm2 0h1v1h-1V6zm2 0h1v1h-1V6zm2 0h1v1h-1V6zm2 0h1v1h-1V6z" fill="currentColor"/>
                    {/* Timing Pattern Vertical */}
                    <path d="M6 8h1v1H6V8zm0 2h1v1H6v-1zm0 2h1v1H6v-1zm0 4h1v1H6v-1zm0 2h1v1H6v-1zm0 2h1v1H6v-1z" fill="currentColor"/>
                    {/* Data modules */}
                    <path d="M9 0h2v1H9V0zm4 0h1v2h-1V0zm2 0h3v1h-3V0zm1 1h2v1h-2V1zm-4 2h1v1h-1V3zm2 0h2v1h-2V3zm1 1h1v2h-1V4zm-5 1h2v1H9V5zm3 0h1v1h-1V5zm5 0h1v2h-1V5zm-8 3h2v1H9V8zm3 0h3v1h-3V8zm1 1h1v2h-1V9zm-5 2h2v1H9v-1zm3 0h1v1h-1v-1zm3 0h1v3h-1v-3zm3 0h1v1h-1v-1zm-8 3h2v1H9v-1zm3 0h2v1h-2v-1zm3 1h1v1h-1v-1zm2 0h1v2h-1v-2zm-9 2h1v2H8v-2zm3 0h2v1h-2v-1zm4 0h1v1h-1v-1zm2 0h1v1h-1v-1zm-8 3h3v1H9v-1zm4 0h1v1h-1v-1zm2 0h2v1h-2v-1zm1 1h1v2h-1v-2z" fill="currentColor"/>
                    <path d="M9 13h1v1H9v-1zm4 0h1v1h-1v-1zm2 1h1v1h-1v-1zm1 1h1v1h-1v-1zm-3 1h2v1h-2v-1zm5 0h1v1h-1v-1zm1 1h1v1h-1v-1zm-8 2h2v1H9v-1zm4 0h1v1h-1v-1zm2 1h1v2h-1v-2zm-5 2h1v1H8v-1zm3 0h2v1h-2v-1zm4 1h1v1h-1v-1z" fill="currentColor"/>
                  </svg>
                </div>

                <div className="text-[10px] uppercase font-sans font-semibold tracking-wider text-zinc-500 mt-1">
                  SCAN TO DONATE
                </div>

                {/* Direct exterior Support links */}
                <div className="w-full space-y-2 pt-1">
                  <a
                    href="https://buymeacoffee.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 rounded-xl bg-[#e3a088] hover:bg-[#ebd0c5] text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#221714]/20"
                  >
                    <Mug weight="Outline" className="w-3.5 h-3.5" />
                    <span>Support on BuyMeACoffee.com</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>

                  <button
                    onClick={() => {
                      setShowBuyCoffeeModal(false);
                    }}
                    className="w-full py-2 text-[10.5px] text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer"
                  >
                    Maybe next time, thanks!
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isUploadsPanelOpen && (
        <UploadsManager
          tasks={uploadTasks}
          onCancelTask={handleCancelTask}
          onCancelAll={handleCancelAllTasks}
          onClose={() => setIsUploadsPanelOpen(false)}
          isCollapsed={isUploadsPanelCollapsed}
          setIsCollapsed={setIsUploadsPanelCollapsed}
        />
      )}

      <ToastContainer />
    </div>
  );
}
