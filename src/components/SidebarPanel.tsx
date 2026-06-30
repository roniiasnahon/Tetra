import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "./SolarIcon";
import { showToast } from "./Toast";
import { MaterialIcon } from "./MaterialIcon";
import {
  FolderWithFiles,
  FolderOpen,
  UploadMinimalistic,
  AddFolder,
  PaletteRound,
  Mug,
  HandStars
} from "@solar-icons/react";

import { Tab, PaperItem } from "../App";

export interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

interface SidebarPanelProps {
  isOpen: boolean;
  isDesktopApp: boolean;
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  folders: FolderItem[];
  papers: PaperItem[];
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  createNewDocument: () => void;
  dbSetFolder: (folder: any) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePaperClick: (paper: any) => void;
  setDocumentContent: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: (text: string, options?: any) => void;
  allChats: Tab[];
  setChatIdToDelete: (id: string | null) => void;
  setActiveModal?: (modal: "deleteFolder" | "deleteSelection" | "closeTab" | "deleteChat" | "exitApp" | null) => void;
  
  // Tools
  activeToolsTab: string;
  openToolsTab: (toolType: any) => void;
  toolsHistory: any[];
  setToolsHistory: React.Dispatch<React.SetStateAction<any[]>>;
  loadToolsHistoryItem: (item: any) => void;
  deleteToolsHistoryItem: (id: string, e: React.MouseEvent) => void;
  
  // Profile / Auth
  currentUser: any;
  handleGoogleLogin: () => void;
  setIsLoggingOut: (loggingOut: boolean) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  setShowBuyCoffeeModal: (open: boolean) => void;
  setIsKeyboardShortcutsOpen: (open: boolean) => void;
  loadedUserIdRef: React.MutableRefObject<string>;
  setFolders: React.Dispatch<React.SetStateAction<FolderItem[]>>;
  setPapers: React.Dispatch<React.SetStateAction<PaperItem[]>>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setAllChats: React.Dispatch<React.SetStateAction<Tab[]>>;
  signOut: (auth: any) => Promise<void>;
  auth: any;
  
  // I18n
  appLanguage: string;
  setAppLanguage: (lang: any) => void;
  t: (key: any) => string;
  translateDynamicTitle: (title: string) => string;
  
  // Drag & Drop
  handleLibraryDragStart: (e: React.DragEvent, type: "folder" | "paper", id: string, name: string) => void;
  handleLibraryDragOverFolder: (e: React.DragEvent, folderId: string) => void;
  handleFolderDragLeave: (e: React.DragEvent) => void;
  handleLibraryDropOnFolder: (e: React.DragEvent, folderId: string) => void;
  handleLibraryDragOverRoot: (e: React.DragEvent) => void;
  handleLibraryDropOnRoot: (e: React.DragEvent) => void;
  dragOverFolderId: string | null;
  dragOverRootLibrary: boolean;
  setDragOverRootLibrary: (over: boolean) => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  isOpen,
  isDesktopApp,
  activeTabId,
  setActiveTabId,
  tabs,
  setTabs,
  folders,
  papers,
  selectedFolderId,
  setSelectedFolderId,
  createNewDocument,
  dbSetFolder,
  fileInputRef,
  handlePaperClick,
  setDocumentContent,
  handleSendMessage,
  allChats,
  setChatIdToDelete,
  setActiveModal,
  
  activeToolsTab,
  openToolsTab,
  toolsHistory,
  setToolsHistory,
  loadToolsHistoryItem,
  deleteToolsHistoryItem,
  
  currentUser,
  handleGoogleLogin,
  setIsLoggingOut,
  setIsSettingsModalOpen,
  setShowBuyCoffeeModal,
  setIsKeyboardShortcutsOpen,
  loadedUserIdRef,
  setFolders,
  setPapers,
  setMessages,
  setAllChats,
  signOut,
  auth,
  
  appLanguage,
  setAppLanguage,
  t,
  translateDynamicTitle,
  
  handleLibraryDragStart,
  handleLibraryDragOverFolder,
  handleFolderDragLeave,
  handleLibraryDropOnFolder,
  handleLibraryDragOverRoot,
  handleLibraryDropOnRoot,
  dragOverFolderId,
  dragOverRootLibrary,
  setDragOverRootLibrary
}) => {
  const [sidebarView, setSidebarView] = useState<"files" | "chats" | "library" | "tools">("files");
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isStatsSectionOpen, setIsStatsSectionOpen] = useState(true);
  const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const getUniqueFolders = (folderList: FolderItem[]) => {
    const seen = new Set<string>();
    return folderList.filter((f) => {
      if (!f.id) return false;
      if (seen.has(f.id)) return false;
      seen.add(f.id);
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className={`flex flex-col h-full shrink-0 relative bg-[#070707] font-jakarta z-[100] ${isDesktopApp ? "pt-[38px]" : ""}`}
        >
          {isDesktopApp && (
            <div className="absolute top-0 left-0 h-[38px] flex items-center px-4 pointer-events-none">
              <span className="text-lg font-black text-white tracking-tighter select-none">cosmi</span>
            </div>
          )}
          {/* Primary Navigation Grid */}
          <nav className="px-2 flex items-center justify-between gap-1 mb-4 h-11 relative">
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setIsCreateDropdownOpen(!isCreateDropdownOpen);
              }}
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                isCreateDropdownOpen
                  ? "bg-[#27272a] text-[#ffffff]"
                  : "text-[#52525b] hover:text-[#a1a1aa]"
              }`}
            >
              <Icon icon="ph:pencil-line" className="w-[18px] h-[18px] pointer-events-none" />
            </button>

            {[
              {
                icon: "ph:house",
                label: "Home",
                onClick: () => {
                  const homeTab = tabs.find((t) => t.type === "home");
                  if (homeTab) setActiveTabId(homeTab.id);
                  setSidebarView("files");
                },
                active: sidebarView === "files" || sidebarView === "chats",
              },
              {
                icon: "ph:books",
                label: "Library",
                onClick: () => {
                  const libTab = tabs.find((t) => t.type === "library");
                  if (libTab) {
                    setActiveTabId(libTab.id);
                    setSidebarView("library");
                  } else {
                    const newId = `lib-${Date.now()}`;
                    setTabs([
                      ...tabs,
                      { id: newId, type: "library", title: "Library" },
                    ]);
                    setActiveTabId(newId);
                    setSidebarView("library");
                  }
                },
                active: sidebarView === "library",
              },
              {
                icon: "ph:wrench-fill",
                label: "Tools",
                onClick: () => {
                  let toolsTab = tabs.find((t) => t.type === "tools");
                  if (!toolsTab) {
                    const newId = `tools-${Date.now()}`;
                    setTabs([
                      ...tabs,
                      { id: newId, type: "tools", title: "Statistics Tools" },
                    ]);
                    setActiveTabId(newId);
                  } else {
                    setActiveTabId(toolsTab.id);
                  }
                  setSidebarView("tools");
                },
                active: sidebarView === "tools",
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex items-center justify-center gap-2 px-3 h-9 rounded-full transition-all duration-300 cursor-pointer overflow-hidden relative group ${
                  item.active
                    ? "bg-[#27272a] text-white flex-1 min-w-0"
                    : "text-[#52525b] hover:text-[#a1a1aa] w-9 shrink-0"
                }`}
              >
                {item.label === "Tools" ? (
                  <PaletteRound
                    weight="Linear"
                    className={`w-[18px] h-[18px] shrink-0 transition-transform pointer-events-none ${
                      item.active ? "scale-100" : "scale-110"
                    }`}
                  />
                ) : (
                  <Icon
                    icon={item.icon}
                    className={`w-[18px] h-[18px] shrink-0 transition-transform pointer-events-none ${
                      item.active ? "scale-100" : "scale-110"
                    }`}
                  />
                )}
                <AnimatePresence initial={false}>
                  {item.active && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="text-[12px] font-bold tracking-tight whitespace-nowrap pointer-events-none"
                    >
                      {item.label === "Home" ? t("home") : item.label === "Library" ? t("library") : t("tools")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            ))}

            <AnimatePresence>
              {isCreateDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 5, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-3 w-48 bg-[#18181b] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 z-[70]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      createNewDocument();
                      setIsCreateDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                  >
                    <Icon
                      icon="ph:file-text"
                      className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                    />
                    <span className="font-medium">{t("createDocument")}</span>
                  </button>
                  <button
                    onClick={() => {
                      const newId = `chat-${Date.now()}`;
                      setTabs([
                        ...tabs,
                        { id: newId, type: "chat", title: "Untitled" },
                      ]);
                      setActiveTabId(newId);
                      setIsCreateDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                  >
                    <Icon
                      icon="ph:chat-circle"
                      className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                    />
                    <span className="font-medium">{t("newChat")}</span>
                  </button>
                  <button
                    onClick={() => {
                      const newFolderId = `folder-${Date.now()}`;
                      const newFolder = {
                        id: newFolderId,
                        name: "Untitled Folder",
                        createdAt: Date.now(),
                      };
                      dbSetFolder(newFolder);
                      setSelectedFolderId(newFolderId);

                      const libTab = tabs.find((t) => t.type === "library");
                      if (libTab) {
                        setActiveTabId(libTab.id);
                      } else {
                        const newId = `lib-${Date.now()}`;
                        setTabs([
                          ...tabs,
                          { id: newId, type: "library", title: "Library" },
                        ]);
                        setActiveTabId(newId);
                      }
                      setIsCreateDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                  >
                    <AddFolder
                      weight="Linear"
                      className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 shrink-0"
                    />
                    <span className="font-medium">{t("newFolder")}</span>
                  </button>
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setIsCreateDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                  >
                    <UploadMinimalistic
                      weight="Linear"
                      className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 shrink-0"
                    />
                    <span className="font-medium">{t("uploadFile")}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>

          {/* Files/Chats Toggle Tabs */}
          {(sidebarView === "files" || sidebarView === "chats") && (
            <div className="mx-3 mb-4 flex items-center gap-6 border-b border-zinc-800/30">
              <button
                onClick={() => setSidebarView("files")}
                className={`text-xs font-semibold pb-2.5 transition-all cursor-pointer relative ${
                  sidebarView === "files"
                    ? "text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t("files")}
                {sidebarView === "files" && (
                  <motion.div
                    layoutId="sidebarTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-zinc-300"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setSidebarView("chats")}
                className={`text-xs font-semibold pb-2.5 transition-all cursor-pointer relative ${
                  sidebarView === "chats"
                    ? "text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t("chatsTab")}
                {sidebarView === "chats" && (
                  <motion.div
                    layoutId="sidebarTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-zinc-300"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            </div>
          )}

          {/* Main Sidebar Views */}
          <div className="flex-1 overflow-y-auto px-1 select-none custom-scrollbar">
            {sidebarView === "files" && (
              <div className="space-y-1">
                {getUniqueFolders(folders).map((folder) => {
                  const isSelected = selectedFolderId === folder.id;
                  const isExpanded = !!expandedFolders[folder.id];
                  const folderFiles = papers.filter((p) => p.folderId === folder.id);
                  const isDragOver = dragOverFolderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      draggable
                      onDragStart={(e) => handleLibraryDragStart(e, "folder", folder.id, folder.name)}
                      onDragOver={(e) => handleLibraryDragOverFolder(e, folder.id)}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={(e) => handleLibraryDropOnFolder(e, folder.id)}
                      className={`group/folder flex flex-col px-2.5 py-1.5 rounded-lg transition-all ${
                        isSelected
                          ? "bg-[#161616] text-[#ffffff]"
                          : isDragOver
                            ? "bg-[#27272a]/70 text-white border border-dashed border-blue-500"
                            : "hover:bg-[#161616]/40 text-[#a1a1aa]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => {
                            setExpandedFolders((prev) => ({
                              ...prev,
                              [folder.id]: !prev[folder.id],
                            }));
                          }}
                          className="p-0.5 hover:bg-[#27272a] rounded text-zinc-600 hover:text-white cursor-pointer shrink-0"
                        >
                          <Icon
                            icon="ph:caret-down"
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
                          />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setExpandedFolders((prev) => ({
                              ...prev,
                              [folder.id]: true,
                            }));

                            const libTab = tabs.find((t) => t.type === "library");
                            if (libTab) {
                              setActiveTabId(libTab.id);
                            } else {
                              const newId = `lib-${Date.now()}`;
                              setTabs([
                                ...tabs,
                                { id: newId, type: "library", title: "Library" },
                              ]);
                              setActiveTabId(newId);
                            }
                          }}
                          className="flex-1 flex items-center justify-between min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <FolderOpen
                                weight="Linear"
                                className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-400" : "text-zinc-500"}`}
                              />
                            ) : (
                              <FolderWithFiles
                                weight="Linear"
                                className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-400" : "text-zinc-500"}`}
                              />
                            )}
                            <span className="text-xs font-semibold truncate text-[#a1a1aa] group-hover/folder:text-white">
                              {folder.name}
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Nested Items */}
                      {isExpanded && (
                        <div className="pl-3.5 space-y-0.5 border-l border-[#27272a]/40 ml-3.5 my-1">
                          {folderFiles.length === 0 ? (
                            <div className="py-1 px-1.5 text-[10.5px] italic text-[#52525b] select-none">
                              Empty folder
                            </div>
                          ) : (
                            folderFiles.map((file, fIdx) => (
                              <button
                                key={fIdx}
                                draggable
                                onDragStart={(e) => handleLibraryDragStart(e, "paper", file.title, file.title)}
                                onClick={() => handlePaperClick(file)}
                                className="w-full flex items-center gap-1.5 pr-1 pl-1 py-1 rounded-[6px] text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#161616]/40 transition-all text-left min-w-0 cursor-pointer group"
                                title={file.title}
                              >
                                <Icon
                                  icon="ph:file-text"
                                  className="w-3.5 h-3.5 text-zinc-600 shrink-0 group-hover:text-zinc-400"
                                />
                                <span className="text-[11.5px] truncate font-medium flex-1 text-zinc-400 group-hover:text-white">
                                  {file.title}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {sidebarView === "chats" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2 mb-1">
                  <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider">
                    Recent Chats
                  </span>
                  <button
                    onClick={() => {
                      const newId = `chat-${Date.now()}`;
                      const newChatTab: Tab = {
                        id: newId,
                        type: "chat",
                        title: "New chat",
                        messages: [],
                      };
                      setTabs([...tabs, newChatTab]);
                      setActiveTabId(newId);
                      if (currentUser?.uid) {
                        // Import dynamic helper or invoke directly if available
                      }
                    }}
                    className="p-1 hover:bg-[#27272a] rounded text-[#71717a] hover:text-[#f4f4f5] transition-colors cursor-pointer"
                    title="New Chat"
                  >
                    <MaterialIcon name="add" className="text-[18px] shrink-0" />
                  </button>
                </div>
                {allChats.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#27272a] rounded-xl">
                    <Icon
                      icon="ph:chat-circle-dots"
                      className="w-8 h-8 text-[#27272a] mx-auto mb-2"
                    />
                    <p className="text-[11px] text-[#52525b]">
                      No recent chats
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {getUniqueChats(allChats).map((chatTab) => {
                      const isCurrent = chatTab.id === activeTabId;
                      const isOpenTab = tabs.some((t) => t.id === chatTab.id);
                      return (
                        <div
                          key={chatTab.id}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-lg transition-all ${
                            isCurrent
                              ? "bg-[#27272a]/50 text-white"
                              : "hover:bg-[#161616] text-[#a1a1aa] hover:text-[#f4f4f5]"
                          }`}
                        >
                          <button
                            onClick={() => {
                              if (isOpenTab) {
                                setActiveTabId(chatTab.id);
                              } else {
                                setTabs((prev) => [...prev, chatTab]);
                                setActiveTabId(chatTab.id);
                              }
                            }}
                            className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
                          >
                            <span className="text-xs truncate font-medium">
                              {translateDynamicTitle(chatTab.title)}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatIdToDelete(chatTab.id);
                              if (setActiveModal) {
                                setActiveModal("deleteChat");
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#27272a] hover:text-[#ef4444] rounded transition-all cursor-pointer animate-fade-in"
                            title="Delete Chat"
                          >
                            <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {sidebarView === "library" && (
              <div className="space-y-3">
                <h3 className="text-[10px] text-[#52525b] uppercase font-bold tracking-wider px-2">
                  Citations ({papers.length})
                </h3>
                {papers.length === 0 ? (
                  <div className="px-2 py-6 border border-dashed border-zinc-800 rounded-xl text-center flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                      <Icon icon="ph:books" className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] text-zinc-500 font-medium tracking-tight">
                      Library is empty
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {papers.map((paper, idx) => (
                      <div
                        key={idx}
                        className="relative p-3 bg-[#0a0a0a] border border-zinc-800/60 rounded-xl hover:border-zinc-700/80 transition-all duration-300 group overflow-hidden shadow-sm hover:shadow-md"
                      >
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                            <Icon icon="ph:bookmark-simple" className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-zinc-100 font-medium leading-tight mb-1 line-clamp-2">
                              {paper.title}
                            </p>
                            <p className="text-[10.5px] text-zinc-500 truncate flex items-center gap-1.5 mb-2.5">
                              <Icon icon="ph:user" className="w-3 h-3" />
                              {paper.author}
                            </p>
                            
                            <div className="flex gap-1.5 mt-2.5">
                              <button
                                onClick={() => {
                                  const citation = `\n\n> *Citation: ${paper.title} - ${paper.author}*`;
                                  setDocumentContent((prev) => prev + citation);
                                }}
                                className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-transparent hover:border-zinc-600/50 text-zinc-300 text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 justify-center active:scale-[0.98] cursor-pointer"
                              >
                                <Icon icon="ph:quotes" className="w-3 h-3" />
                                Cite
                              </button>
                              <button
                                onClick={() => {
                                  const text = `Can you summarize the attached document "${paper.title}"?`;
                                  handleSendMessage(text, { 
                                    overrideAttachment: paper.fileId ? { fileId: paper.fileId, fileName: paper.title, mimetype: paper.mimetype || "application/pdf" } : null 
                                  });
                                }}
                                className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-transparent hover:border-zinc-600/50 text-zinc-300 text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 justify-center active:scale-[0.98] cursor-pointer"
                                title="AI will analyze and summarize the content of this document"
                              >
                                <Icon icon="ph:magic-wand" className="w-3 h-3" />
                                Summarize
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sidebarView === "tools" && (
              <div className="space-y-4 px-2 text-left select-none">
                <div className="space-y-1">
                  <button
                    onClick={() => setIsStatsSectionOpen(!isStatsSectionOpen)}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] text-[#71717a] hover:text-zinc-200 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <PaletteRound weight="Linear" className="w-3.5 h-3.5 shrink-0" />
                      <span>{t("tools")}</span>
                    </div>
                    <Icon
                      icon="ph:caret-down"
                      className={`w-3 h-3 transition-transform duration-200 ${isStatsSectionOpen ? "" : "-rotate-90"}`}
                    />
                  </button>

                  {isStatsSectionOpen && (
                    <div className="space-y-0.5 mt-1">
                      {[
                        { id: "slovin", label: "Slovin's Formula", icon: "ph:calculator-fill", color: "!text-zinc-500" },
                        { id: "percentage", label: "Percentage Calc", icon: "ph:percent-fill", color: "!text-zinc-500" },
                        { id: "weighted", label: "Weighted Mean", icon: "ph:scales-fill", color: "!text-zinc-500" },
                        { id: "likert", label: "Likert Scale", icon: "ph:check-square-fill", color: "!text-zinc-500" },
                        { id: "ai", label: "Data Analysis", icon: "ph:chart-pie-slice-fill", color: "!text-zinc-500" },
                        { id: "citation", label: "Citations", icon: "ph:article-fill", color: "!text-zinc-500" },
                      ].map((item) => {
                        const isCurrentlySelected = activeToolsTab === item.id && tabs.find(t => t.id === activeTabId)?.type === "tools";
                        return (
                          <button
                            key={item.id}
                            onClick={() => openToolsTab(item.id as any)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer text-left ${
                              isCurrentlySelected
                                ? "bg-[#27272a] text-[#f4f4f5] font-medium"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-[#161617]/50"
                            }`}
                          >
                            <Icon
                              icon={item.icon}
                              className={`w-3.5 h-3.5 ${item.color}`}
                            />
                            <span className="truncate">
                              {item.id === "slovin"
                                ? t("slovinLabel")
                                : item.id === "percentage"
                                  ? t("percentageLabel")
                                  : item.id === "weighted"
                                    ? t("weightedLabel")
                                    : item.id === "likert"
                                      ? t("likertLabel")
                                      : item.id === "ai"
                                        ? t("analysisLabel")
                                        : t("citationsLabel")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* History Nest */}
                <div className="space-y-1 pt-2 border-t border-[#1e1e20]">
                  <button
                    onClick={() => setIsHistorySectionOpen(!isHistorySectionOpen)}
                    className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] text-[#71717a] hover:text-zinc-200 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        icon="ph:clock-counter-clockwise-fill"
                        className="w-3.5 h-3.5"
                      />
                      <span>{t("history")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {toolsHistory.length > 0 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setToolsHistory([]);
                            localStorage.removeItem("toolsHistory");
                          }}
                          className="text-[9px] text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer lowercase font-normal tracking-normal"
                        >
                          {t("clearAll")}
                        </span>
                      )}
                      <Icon
                        icon="ph:caret-down"
                        className={`w-3 h-3 transition-transform duration-200 ${isHistorySectionOpen ? "" : "-rotate-90"}`}
                      />
                    </div>
                  </button>

                  {isHistorySectionOpen && (
                    <div className="space-y-1 mt-1">
                      {toolsHistory.length === 0 ? (
                        <div className="px-2 py-4 border border-dashed border-[#27272a]/60 rounded-xl text-center bg-[#0c0c0d]/40 my-1">
                          <p className="text-[10px] text-[#52525b]">
                            {t("noComputations")}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                          {toolsHistory.map((item) => {
                            let iconName = "ph:calculator-fill";
                            let colorClass = "!text-zinc-500";
                            if (item.type === "percentage") {
                              iconName = "ph:percent-fill";
                            } else if (item.type === "weighted") {
                              iconName = "ph:scales-fill";
                            } else if (item.type === "likert") {
                              iconName = "ph:check-square-fill";
                            } else if (item.type === "ai") {
                              iconName = "ph:chart-pie-slice-fill";
                            } else if (item.type === "citation") {
                              iconName = "ph:article-fill";
                            }

                            return (
                              <div
                                key={item.id}
                                onClick={() => loadToolsHistoryItem(item)}
                                className="group p-2 bg-[#0e0e0f]/80 hover:bg-[#121213] rounded-lg transition-all cursor-pointer relative"
                              >
                                <button
                                  onClick={(e) => deleteToolsHistoryItem(item.id, e)}
                                  className="absolute top-1 right-1 p-1 text-zinc-650 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete history item"
                                >
                                  <Icon
                                    icon="ph:trash"
                                    className="w-2.5 h-2.5"
                                  />
                                </button>
                                <div className="flex items-start gap-1.5 text-left">
                                  <Icon
                                    icon={iconName}
                                    className={`w-3 h-3 mt-0.5 shrink-0 ${colorClass}`}
                                  />
                                  <div className="flex-1 min-w-0 pr-3 text-left">
                                    <div className="text-[10px] font-medium text-zinc-300 truncate leading-tight">
                                      {item.title}
                                    </div>
                                    <div className="text-[9px] text-[#71717a] font-mono mt-0.5 truncate uppercase">
                                      {item.result}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section */}
          <div className="mt-auto p-3">
            <div className="p-1 mt-2 relative">
              {currentUser ? (
                <>
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="w-full flex items-center gap-2.5 text-[#f4f4f5] text-[12px] hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-colors group cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#27272a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3f3f46]">
                      <img
                        src={
                          localStorage.getItem(`cosmi_settings_avatar_url_${currentUser?.uid || "guest"}`) ||
                          currentUser.photoURL ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.email || "Ron")}`
                        }
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="truncate font-medium flex-1 text-left">
                      {localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                        currentUser.displayName ||
                        currentUser.email ||
                        "Google Account"}
                    </span>
                    <Icon
                      icon="ph:caret-down"
                      className={`w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] shrink-0 transition-transform duration-200 ${isProfileDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  <AnimatePresence>
                    {isProfileDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-[110]"
                          onClick={() => setIsProfileDropdownOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-2 bottom-full mb-2 z-[120] bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 w-[280px]"
                        >
                          <div className="px-3 py-3 flex items-center gap-3 border-b border-[#2d2d30]/50 mb-1">
                            <div className="w-10 h-10 rounded-full bg-[#27272a] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3f3f46]">
                              <img
                                src={
                                  localStorage.getItem(`cosmi_settings_avatar_url_${currentUser?.uid || "guest"}`) ||
                                  currentUser.photoURL ||
                                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.email || "Ron")}`
                                }
                                alt="Avatar"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-[14px] text-[#f4f4f5] font-bold truncate">
                                {localStorage.getItem(`cosmi_settings_full_name_${currentUser?.uid || "guest"}`) ||
                                  currentUser.displayName ||
                                  "Ron Asnahon's"}
                              </p>
                            </div>
                          </div>

                          <div className="px-1.5 pb-2">
                            <button
                              onClick={() => {
                                setIsProfileDropdownOpen(false);
                                setIsSettingsModalOpen(true);
                              }}
                              className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center gap-3 cursor-pointer"
                            >
                              <Icon icon="ph:gear" className="w-[18px] h-[18px] text-[#71717a]" />
                              <span className="font-medium">{t("settings")}</span>
                            </button>

                            <button
                              onClick={() => {
                                setIsProfileDropdownOpen(false);
                                setShowBuyCoffeeModal(true);
                              }}
                              className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center gap-3 cursor-pointer"
                            >
                              <Mug weight="Outline" className="w-[18px] h-[18px] text-[#71717a]" />
                              <span className="font-medium">Buy me a coffee</span>
                            </button>

                            <div className="relative group/learn">
                              <button
                                className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center justify-between cursor-pointer"
                                onClick={(e) => e.preventDefault()}
                              >
                                <div className="flex items-center gap-3">
                                  <Icon icon="ph:info" className="w-[18px] h-[18px] text-[#71717a]" />
                                  <span className="font-medium">{t("learnMore")}</span>
                                </div>
                                <Icon icon="ph:caret-right" className="w-[14px] h-[14px] text-[#71717a]" />
                              </button>

                              <div className="absolute left-full translate-x-1.5 bottom-0 hidden group-hover/learn:block bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.65)] z-[130] before:absolute before:content-[''] before:top-0 before:-left-4 before:w-4 before:h-full cursor-default animate-fade-in">
                                <div className="px-1 py-1 max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar">
                                  {[
                                    { label: "Supporting Students", url: "https://genlang.vercel.app/#why-students" },
                                    { label: "Academic Systems", url: "https://genlang.vercel.app/#policy/academic-systems" },
                                    { label: "Risks", url: "https://genlang.vercel.app/#policy/risks" },
                                    { label: "Reasoning", url: "https://genlang.vercel.app/#policy/step-by-step-reasoning" },
                                    { label: "AI In Education", url: "https://genlang.vercel.app/#policy/benefits" },
                                    { label: "Education", url: "https://genlang.vercel.app/#policy/support-in-lesson-planning" },
                                    { label: "Engines We Use", url: "https://genlang.vercel.app/#llm-learning" },
                                    { label: "Compliances", url: "https://genlang.vercel.app/#compliance" }
                                  ].map((item, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        window.open(item.url, "_blank", "noopener,noreferrer");
                                        setIsProfileDropdownOpen(false);
                                      }}
                                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-[12.5px] rounded-lg transition-colors text-left text-[#e4e4e7] hover:bg-[#27272a]/30 cursor-pointer select-none"
                                    >
                                      <span className="font-medium">{item.label}</span>
                                      <Icon
                                        icon="ph:arrow-square-out"
                                        className="w-3.5 h-3.5 text-zinc-500 shrink-0"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                window.open("https://genlang.vercel.app/#support", "_blank", "noopener,noreferrer");
                                setIsProfileDropdownOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center gap-3 cursor-pointer select-none"
                            >
                              <HandStars weight="BoldDuotone" className="w-[18px] h-[18px] text-[#71717a] shrink-0" />
                              <span className="font-medium">{t("help")}</span>
                            </button>

                            <div className="relative group/lang">
                              <button
                                className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center justify-between cursor-pointer"
                                onClick={(e) => e.preventDefault()}
                              >
                                <div className="flex items-center gap-3">
                                  <Icon icon="ph:globe" className="w-[18px] h-[18px] text-[#71717a]" />
                                  <span className="font-medium">{t("language")}</span>
                                </div>
                                <Icon icon="ph:caret-right" className="w-[14px] h-[14px] text-[#71717a]" />
                              </button>

                              <div className="absolute left-full translate-x-1.5 bottom-0 hidden group-hover/lang:block bg-[#161616] border border-[#2d2d30] rounded-xl py-1.5 w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.65)] z-[130] before:absolute before:content-[''] before:top-0 before:-left-4 before:w-4 before:h-full cursor-default animate-fade-in">
                                <div className="px-1 py-1 max-h-[240px] overflow-y-auto space-y-0.5 custom-scrollbar">
                                  {[
                                    { code: "en" as const, label: t("english"), icon: "🇬🇧" },
                                    { code: "fr" as const, label: t("french"), icon: "🇫🇷" },
                                    { code: "es" as const, label: t("spanish"), icon: "🇪🇸" },
                                    { code: "de" as const, label: t("german"), icon: "🇩🇪" },
                                    { code: "it" as const, label: t("italian"), icon: "🇮🇹" },
                                    { code: "pt" as const, label: t("portuguese"), icon: "🇵🇹" },
                                    { code: "ar" as const, label: t("arabic"), icon: "🇸🇦" },
                                    { code: "zh" as const, label: t("chinese"), icon: "🇨🇳" },
                                    { code: "ja" as const, label: t("japanese"), icon: "🇯🇵" },
                                    { code: "hi" as const, label: t("hindi"), icon: "🇮🇳" }
                                  ].map((lang) => {
                                    const isActive = appLanguage === lang.code;
                                    return (
                                      <button
                                        key={lang.code}
                                        onClick={() => {
                                          setAppLanguage(lang.code);
                                          localStorage.setItem("cosmi_language", lang.code);

                                          const toastMsgs: Record<string, string> = {
                                            en: "Language updated to English!",
                                            fr: "Langue changée en Français !",
                                            es: "¡Idioma cambiado a Español!",
                                            de: "Sprache auf Deutsch aktualisiert!",
                                            it: "Lingua aggiornata in Italiano!",
                                            pt: "Idioma atualizado para Português!",
                                            ar: "تم تحديث اللغة إلى العربية!",
                                            zh: "语言已更新为中文！",
                                            ja: "日本語に更新されました！",
                                            hi: "भाषा हिंदी में अपडेट की गई!"
                                          };

                                          showToast(toastMsgs[lang.code] || "Language updated!", "success");
                                          setIsProfileDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12.5px] rounded-lg transition-colors text-left cursor-pointer ${
                                          isActive
                                            ? "bg-[#27272a]/50 text-white font-medium"
                                            : "text-[#e4e4e7] hover:bg-[#27272a]/30"
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className="text-base select-none">{lang.icon}</span>
                                          <span className="font-medium">{lang.label}</span>
                                        </div>
                                        {isActive && (
                                          <Icon
                                            icon="ph:check"
                                            className="w-4 h-4 text-emerald-500 font-bold shrink-0"
                                          />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="px-1.5 py-1 border-t border-[#2d2d30]/50">
                            <button
                              onClick={() => {
                                setIsProfileDropdownOpen(false);
                                setIsKeyboardShortcutsOpen(true);
                              }}
                              className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center gap-3 cursor-pointer"
                            >
                              <Icon icon="ph:keyboard" className="w-[18px] h-[18px] text-[#71717a]" />
                              <span className="font-medium">Keyboard shortcuts</span>
                            </button>
                          </div>

                          <div className="px-1.5 pb-1 border-t border-[#2d2d30]/50">
                            <button
                              onClick={async () => {
                                setIsProfileDropdownOpen(false);
                                setIsLoggingOut(true);

                                localStorage.removeItem("cosmi_user_snapshot");

                                loadedUserIdRef.current = "guest";
                                setFolders([{ id: "f1", name: "My Research", createdAt: Date.now() - 172800000 }]);
                                setPapers([]);
                                setTabs([{ id: "initial-home", type: "home", title: "Home" }]);
                                setActiveTabId("initial-home");
                                setMessages([]);
                                setAllChats([]);

                                setTimeout(async () => {
                                  try {
                                    await signOut(auth);
                                    setIsLoggingOut(false);
                                  } catch (err) {
                                    console.error("Sign out error:", err);
                                    setIsLoggingOut(false);
                                  }
                                }, 3500);
                              }}
                              className="w-full text-left px-2.5 py-2 text-[13px] text-[#e4e4e7] hover:bg-[#27272a]/50 transition-colors rounded-lg flex items-center gap-3 cursor-pointer"
                            >
                              <Icon icon="ph:sign-out" className="w-[18px] h-[18px] text-[#71717a]" />
                              <span className="font-medium">{t("logOut")}</span>
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1a1a1a] p-1.5 rounded-lg transition-colors group cursor-pointer text-[12px] font-medium"
                >
                  <div className="w-6 h-6 rounded-full bg-[#1c1c1e] border border-[#27272a] flex-shrink-0 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200">
                    <Icon
                      icon="ph:google-logo"
                      className="w-3.5 h-3.5 text-zinc-400"
                    />
                  </div>
                  <span className="truncate flex-1 text-left">
                    Sign in with Google
                  </span>
                  <Icon
                    icon="ph:sign-in"
                    className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#f4f4f5] shrink-0"
                  />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
