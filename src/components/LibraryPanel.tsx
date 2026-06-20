import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Tab } from "../App";

interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

interface PaperItem {
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
  folderId?: string;
  notes?: string;
}

interface LibraryPanelProps {
  papers: PaperItem[];
  folders: FolderItem[];
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  dbSetPaper: (paper: PaperItem) => void;
  dbSetFolder: (folder: FolderItem) => void;
  dbDeleteFolder: (id: string) => void;
  dbDeletePaper: (title: string) => void;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  createNewDocument: (targetFolderId?: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Drag and drop handlers passed from App.tsx
  handleLibraryDragStart: (
    e: React.DragEvent,
    type: "paper" | "folder",
    id: string,
    title?: string
  ) => void;
  handleLibraryDragOverFolder: (e: React.DragEvent, folderId: string) => void;
  handleFolderDragLeave: () => void;
  handleLibraryDropOnFolder: (
    e: React.DragEvent,
    targetFolderId: string
  ) => void;
  handleLibraryDragOverRoot: (e: React.DragEvent) => void;
  handleLibraryDropOnRoot: (e: React.DragEvent) => void;

  dragOverFolderId: string | null;
  dragOverRootLibrary: boolean;
  setDragOverRootLibrary: (val: boolean) => void;

  handlePaperClick: (paper: PaperItem) => void;
  formatAbstractText: (text: string) => string;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  papers,
  folders,
  selectedFolderId,
  setSelectedFolderId,
  dbSetPaper,
  dbSetFolder,
  dbDeleteFolder,
  dbDeletePaper,
  tabs,
  setTabs,
  setActiveTabId,
  createNewDocument,
  fileInputRef,

  handleLibraryDragStart,
  handleLibraryDragOverFolder,
  handleFolderDragLeave,
  handleLibraryDropOnFolder,
  handleLibraryDragOverRoot,
  handleLibraryDropOnRoot,

  dragOverFolderId,
  dragOverRootLibrary,
  setDragOverRootLibrary,

  handlePaperClick,
  formatAbstractText,
}) => {
  // Library toolbar and interaction states
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const [displayDensity, setDisplayDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [sortBy, setSortBy] = useState<"title" | "added" | "viewed">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Dropdown States
  const [isDisplayDropdownOpen, setIsDisplayDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [, setAddDropdownNested] = useState<string | null>(null);
  const [activeMoveFolderDropdown, setActiveMoveFolderDropdown] = useState<
    string | null
  >(null);

  // Deletion state managers
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeleteSelectionConfirmOpen, setIsDeleteSelectionConfirmOpen] =
    useState(false);

  // Viewing detail state manager
  const [activeViewingPaper, setActiveViewingPaper] = useState<PaperItem | null>(
    null
  );

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

  // Folder papers for current view
  const folderPapers = selectedFolderId
    ? sortedPapers.filter((p) => p.folderId === selectedFolderId)
    : sortedPapers;

  return (
    <div className="flex-1 overflow-y-auto focus:outline-none bg-[#121212] flex flex-col">
      <div className="w-full px-[1px] py-6 flex-1 flex flex-col">
        {/* Header section */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div>
            <h1 className="text-2xl text-[#f4f4f5] font-medium tracking-tight">
              {selectedFolderId
                ? folders.find((f) => f.id === selectedFolderId)?.name || "Library"
                : "Library"}
            </h1>
            {!selectedFolderId && (
              <p className="text-[#71717a] text-[11px] mt-1">
                Files, research assets, and citation repository
              </p>
            )}
          </div>

          <div className="relative w-64">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search collection..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#27272a] rounded-lg pl-9 pr-3 py-1.5 text-zinc-200 text-xs focus:border-zinc-400 focus:outline-[#1a1a1a] focus:outline-none placeholder:text-zinc-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 select-none relative px-4 text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDisplayDropdownOpen(!isDisplayDropdownOpen);
                  setIsSortDropdownOpen(false);
                  setIsFilterDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isDisplayDropdownOpen
                    ? "bg-[#27272a] text-white border-zinc-500"
                    : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                }`}
              >
                <Icon icon="ph:rows" className="w-3.5 h-3.5" />
                <span>Display</span>
              </button>
              {isDisplayDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDisplayDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-xl z-50 text-xs text-zinc-300">
                    <div className="px-2.5 py-1 text-[9.5px] uppercase font-bold text-[#71717a] tracking-wider mb-0.5">
                      Density
                    </div>
                    <button
                      onClick={() => {
                        setDisplayDensity("comfortable");
                        setIsDisplayDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Comfortable</span>
                      {displayDensity === "comfortable" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setDisplayDensity("compact");
                        setIsDisplayDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Compact</span>
                      {displayDensity === "compact" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortDropdownOpen(!isSortDropdownOpen);
                  setIsDisplayDropdownOpen(false);
                  setIsFilterDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isSortDropdownOpen
                    ? "bg-[#27272a] text-white border-zinc-500"
                    : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                }`}
              >
                <Icon icon="ph:arrows-down-up" className="w-3.5 h-3.5" />
                <span>Sort</span>
              </button>
              {isSortDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSortDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-xl z-50 text-xs text-zinc-300">
                    <button
                      onClick={() => {
                        setSortBy("title");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Title</span>
                      {sortBy === "title" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortBy("added");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Date Added</span>
                      {sortBy === "added" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortBy("viewed");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Last Viewed</span>
                      {sortBy === "viewed" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <div className="h-[1px] bg-[#27272a] my-1" />
                    <button
                      onClick={() => {
                        setSortOrder("asc");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Ascending</span>
                      {sortOrder === "asc" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder("desc");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Descending</span>
                      {sortOrder === "desc" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterDropdownOpen(!isFilterDropdownOpen);
                  setIsDisplayDropdownOpen(false);
                  setIsSortDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isFilterDropdownOpen
                    ? "bg-[#27272a] text-white border-zinc-500"
                    : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                }`}
              >
                <Icon icon="ph:funnel" className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
              {isFilterDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFilterDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-xl z-50 text-xs text-zinc-300">
                    <button
                      onClick={() => {
                        setFilterType("all");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>All Files</span>
                      {filterType === "all" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFilterType("Note");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Notes</span>
                      {filterType === "Note" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFilterType("Document");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>Documents</span>
                      {filterType === "Document" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:ml-auto text-xs w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[#71717a] text-[11px] font-medium mr-1 select-none">
              {sortedPapers.length} files in library
            </span>
            <div className="relative">
              <button
                onClick={() => {
                  setIsAddDropdownOpen(!isAddDropdownOpen);
                  setAddDropdownNested(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 font-semibold rounded-xl transition-all cursor-pointer ${
                  isAddDropdownOpen ? "bg-white text-zinc-950" : "bg-zinc-200 hover:bg-white text-zinc-950"
                }`}
              >
                <span className="text-[11px]">Add</span>
                <Icon
                  icon="ph:caret-down"
                  className={`w-3 h-3 transition-transform ${isAddDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isAddDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAddDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-52 bg-[#18181b] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 z-[60] shadow-2xl"
                    >
                      <button
                        onClick={() => {
                          createNewDocument();
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                      >
                        <Icon
                          icon="ph:file-plus"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                        />
                        <span className="font-medium">New document</span>
                      </button>

                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                      >
                        <Icon
                          icon="ph:upload-simple"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                        />
                        <span className="font-medium">File upload</span>
                      </button>

                      <button
                        onClick={() => {
                          const newFolderId = `folder-${Date.now()}`;
                          dbSetFolder({
                            id: newFolderId,
                            name: "Untitled Folder",
                            createdAt: Date.now(),
                          });
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                      >
                        <Icon
                          icon="ph:folder-plus"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                        />
                        <span className="font-medium">New folder</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Library body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {!selectedFolderId ? (
            // Folder Grid and Directory Layout
            <div className="px-4">
              <h2 className="text-[#a1a1aa] text-[10px] font-bold tracking-widest uppercase mb-4">
                Research Folders
              </h2>

              <div className="bg-[#121212] overflow-x-auto border border-[#27272a] rounded-xl mb-8">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#1a1a1a]/40 text-[#71717a] text-[10.5px] font-jakarta tracking-wider uppercase">
                      <th className="pl-6 pr-3 py-3 font-semibold text-[#8a8a93]">
                        Folder Name
                      </th>
                      <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                        Size
                      </th>
                      <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                        Created
                      </th>
                      <th className="pr-6 pl-3 py-3 w-[120px] text-right font-semibold text-[#8a8a93]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e20] text-xs">
                    {folders.map((folder) => {
                      const folderFiles = papers.filter(
                        (p) => p.folderId === folder.id
                      );
                      return (
                        <tr
                          key={folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          draggable
                          onDragStart={(e) =>
                            handleLibraryDragStart(e, "folder", folder.id)
                          }
                          onDragOver={(e) =>
                            handleLibraryDragOverFolder(e, folder.id)
                          }
                          onDragLeave={handleFolderDragLeave}
                          onDrop={(e) => handleLibraryDropOnFolder(e, folder.id)}
                          className={`transition-colors group cursor-pointer ${
                            dragOverFolderId === folder.id
                              ? "bg-zinc-800/60 border-y border-zinc-500"
                              : "hover:bg-[#1a1a1a]/40"
                          }`}
                        >
                          <td
                            className={`pl-6 pr-3 font-medium ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon
                                icon="ph:folder-open"
                                className="w-4 h-4 text-zinc-400"
                              />
                              <span className="text-[#f4f4f5] max-w-[300px] truncate">
                                {folder.name}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`px-3 text-zinc-400 font-jakarta ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            {folderFiles.length} item{folderFiles.length !== 1 ? "s" : ""}
                          </td>
                          <td
                            className={`px-3 text-zinc-500 ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            {new Date(folder.createdAt).toLocaleDateString()}
                          </td>
                          <td
                            className={`pr-6 pl-3 ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete(folder);
                                  setIsDeleteFolderModalOpen(true);
                                }}
                                className="p-1.5 hover:bg-[#27272a] rounded text-red-400 hover:text-red-350 transition-colors"
                                title="Delete Folder"
                              >
                                <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Deep Folder Contents Viewer
            <div className="flex-1 flex flex-col px-4">
              {/* Navigation Path */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  onDragOver={handleLibraryDragOverRoot}
                  onDragLeave={() => setDragOverRootLibrary(false)}
                  onDrop={handleLibraryDropOnRoot}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors cursor-pointer border ${
                    dragOverRootLibrary
                      ? "border-zinc-500 bg-zinc-800/40 text-white font-semibold"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon icon="ph:caret-left" className="w-3.5 h-3.5" />
                  <span>All Folders</span>
                </button>
                <span className="text-[#27272a] text-xs">/</span>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="ph:folder-open"
                    className="w-3.5 h-3.5 text-zinc-400"
                  />
                  <span className="text-xs font-semibold text-white">
                    {folders.find((f) => f.id === selectedFolderId)?.name ||
                      "Browsing Directory"}
                  </span>
                </div>
              </div>

              {/* Filtered Folder Papers */}
              {folderPapers.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-[#27272a] rounded-xl bg-[#161616]/20">
                  <Icon
                    icon="ph:folder"
                    className="w-10 h-10 text-zinc-600 mx-auto mb-4"
                  />
                  <h3 className="text-[#e4e4e7] text-sm font-medium mb-1">
                    Folder is Empty
                  </h3>
                  <p className="text-[#52525b] text-xs max-w-sm mx-auto mb-4">
                    No assets have been added here yet. Create some research notes or export Summaries to fill it!
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() =>
                        createNewDocument(selectedFolderId || folders[0]?.id)
                      }
                      className="px-6 py-2 bg-[#e4e4e7] hover:bg-white text-black rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      New Document
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2 bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] rounded-full text-xs font-bold cursor-pointer transition-colors"
                    >
                      Upload PDF File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121212] overflow-x-auto border border-[#27272a] rounded-xl min-h-[260px]">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="border-b border-[#27272a] bg-[#1a1a1a]/40 text-[#71717a] text-[10.5px] font-jakarta tracking-wider uppercase">
                        <th className="w-[44px] pl-4 py-3">
                          <button
                            onClick={() => {
                              const folderNames = folderPapers.map((p) => p.title);
                              const allSelected = folderNames.every((name) =>
                                selectedPapers.includes(name)
                              );
                              if (allSelected) {
                                setSelectedPapers(
                                  selectedPapers.filter((name) => !folderNames.includes(name))
                                );
                              } else {
                                setSelectedPapers([
                                  ...new Set([...selectedPapers, ...folderNames]),
                                ]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded-sm border border-[#27272a] bg-[#1a1a1a] flex items-center justify-center hover:border-zinc-500 transition-colors cursor-pointer"
                          >
                            {folderPapers
                              .map((p) => p.title)
                              .every((name) => selectedPapers.includes(name)) ? (
                              <div className="w-1.5 h-1.5 bg-zinc-200 rounded-[1px]" />
                            ) : folderPapers.some((p) => selectedPapers.includes(p.title)) ? (
                              <div className="w-1.5 h-[1px] bg-zinc-400" />
                            ) : null}
                          </button>
                        </th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Title</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Folder</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Authors</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Added</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Viewed</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Type</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e20] text-xs">
                      {folderPapers.map((paper, idx) => {
                        const isChecked = selectedPapers.includes(paper.title);
                        const openUpward = idx > 0 && idx >= folderPapers.length - 2;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handlePaperClick(paper)}
                            draggable
                            onDragStart={(e) =>
                              handleLibraryDragStart(e, "paper", paper.title, paper.title)
                            }
                            className={`hover:bg-[#1a1a1a]/40 transition-colors group cursor-pointer ${
                              isChecked ? "bg-[#1a1a1a]/25" : ""
                            }`}
                          >
                            <td
                              className={`w-[44px] pl-4 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isChecked) {
                                  setSelectedPapers(
                                    selectedPapers.filter((t) => t !== paper.title)
                                  );
                                } else {
                                  setSelectedPapers([...selectedPapers, paper.title]);
                                }
                              }}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-sm border border-[#27272a] flex items-center justify-center transition-colors ${
                                  isChecked ? "bg-zinc-200 border-zinc-200" : "bg-[#1a1a1a]"
                                }`}
                              >
                                {isChecked && (
                                  <Icon
                                    icon="ph:check"
                                    className="w-2.5 h-2.5 text-[#121212]"
                                  />
                                )}
                              </div>
                            </td>
                            <td
                              className={`px-3 font-medium ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {paper.fileType === "Note" ? (
                                  <Icon
                                    icon="ph:file-text"
                                    className="w-4 h-4 text-zinc-400"
                                  />
                                ) : (
                                  <Icon
                                    icon="ph:article"
                                    className="w-4 h-4 text-zinc-300"
                                  />
                                )}
                                <span className="text-[#f4f4f5] truncate max-w-[240px]">
                                  {paper.title}
                                </span>
                              </div>
                            </td>
                            <td
                              className={`px-3 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className="relative inline-flex items-center"
                                tabIndex={0}
                                onBlur={(e) => {
                                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                    setActiveMoveFolderDropdown(null);
                                  }
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMoveFolderDropdown(
                                      activeMoveFolderDropdown === paper.title ? null : paper.title
                                    );
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer w-full min-w-[130px] max-w-[140px] justify-between ${
                                    activeMoveFolderDropdown === paper.title
                                      ? "bg-[#27272a] text-white"
                                      : "bg-transparent text-zinc-300 hover:bg-[#27272a] hover:text-white"
                                  }`}
                                >
                                  <span className="text-[11px] truncate">
                                    {paper.folderId
                                      ? folders.find((f) => f.id === paper.folderId)?.name ||
                                        "Library"
                                      : "Library"}
                                  </span>
                                  <Icon
                                    icon="ph:caret-down"
                                    className={`w-3 h-3 shrink-0 transition-transform ${
                                      activeMoveFolderDropdown === paper.title ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>

                                <AnimatePresence>
                                  {activeMoveFolderDropdown === paper.title && (
                                    <motion.div
                                      initial={{
                                        opacity: 0,
                                        y: openUpward ? -4 : 4,
                                        scale: 0.95,
                                      }}
                                      animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                      }}
                                      exit={{
                                        opacity: 0,
                                        y: openUpward ? -4 : 4,
                                        scale: 0.95,
                                      }}
                                      transition={{ duration: 0.1 }}
                                      className={`absolute left-0 ${
                                        openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                      } w-48 bg-[#18181b] border border-[#27272a] rounded-xl py-1.5 z-[70] shadow-2xl`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => {
                                          dbSetPaper({ ...paper, folderId: "" });
                                          setActiveMoveFolderDropdown(null);
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer text-left font-medium"
                                      >
                                        Library
                                      </button>
                                      {folders.map((folder) => (
                                        <button
                                          key={folder.id}
                                          onClick={() => {
                                            dbSetPaper({ ...paper, folderId: folder.id });
                                            setActiveMoveFolderDropdown(null);
                                          }}
                                          className="w-full flex items-center px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer text-left truncate font-medium"
                                        >
                                          {folder.name}
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </td>
                            <td
                              className={`px-3 text-zinc-400 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.author || "—"}
                            </td>
                            <td
                              className={`px-3 text-zinc-500 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.added || "—"}
                            </td>
                            <td
                              className={`px-3 text-zinc-500 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.viewed || "—"}
                            </td>
                            <td
                              className={`px-3 text-zinc-400 capitalize ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.fileType || "—"}
                            </td>
                            <td
                              className={`px-3 text-[#52525b] ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveViewingPaper(paper);
                                }}
                                className="px-2.5 py-1 bg-transparent hover:bg-[#27272a] text-zinc-300 hover:text-white font-sans text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-medium select-none"
                              >
                                <Icon icon="ph:eye" className="w-3.5 h-3.5" />
                                <span>View Summary</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Selection Pill */}
      <AnimatePresence>
        {selectedPapers.length > 0 && (
          <motion.div
            initial={{ y: 20, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 20, x: "-50%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 350,
            }}
            className="fixed bottom-10 left-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-[#111112] border border-[#27272a] rounded-full select-none font-jakarta shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-[#0070f3] rounded flex items-center justify-center">
                <Icon icon="ph:check-bold" className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-sm text-white whitespace-nowrap">
                {selectedPapers.length} {selectedPapers.length === 1 ? "file" : "files"} selected
              </span>
            </div>

            <div className="flex items-center gap-1">
              {selectedPapers.length === 1 && (
                <button
                  onClick={() => {
                    const match = papers.find((p) => p.title === selectedPapers[0]);
                    if (match) {
                      setActiveViewingPaper(match);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer"
                >
                  <Icon icon="ph:eye" className="w-4 h-4 text-zinc-400" />
                  <span>View Summary</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsDeleteSelectionConfirmOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer"
              >
                <span>Delete selection</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays / Modals */}
      <AnimatePresence>
        {/* Paper Summary Drawer Modal */}
        {activeViewingPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/75 z-[10500] flex items-center justify-center p-4"
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

              <h3 className="text-[#f4f4f5] text-xl font-medium leading-snug mb-1 pr-6">
                {activeViewingPaper.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#71717a] border-b border-[#27272a] pb-4 mb-4">
                {activeViewingPaper.author && (
                  <div className="flex items-center gap-1">
                    <Icon icon="ph:user" className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{activeViewingPaper.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Icon icon="ph:calendar" className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Added: {activeViewingPaper.added || "Today"}</span>
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
                    <span className="truncate max-w-xs">{activeViewingPaper.url}</span>
                  </a>
                )}
              </div>

              <div className="space-y-4 text-sm leading-relaxed max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {activeViewingPaper.summary ? (
                  <div className="markdown-body prose prose-invert max-w-none text-sm text-[#d4d4d8] font-sans">
                    <ReactMarkdown>
                      {formatAbstractText(activeViewingPaper.summary).replace(/\\n/g, "\n")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[#d4d4d8] font-sans whitespace-pre-wrap">
                    {activeViewingPaper.description
                      ? formatAbstractText(activeViewingPaper.description).replace(/\\n/g, "\n")
                      : ""}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-[#27272a]">
                <button
                  onClick={() => {
                    const summaryText =
                      activeViewingPaper.summary || activeViewingPaper.description || "";
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

        {/* Delete Selection Modal */}
        {isDeleteSelectionConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/80 z-[10600] flex items-center justify-center p-4 backdrop-blur-sm px-4"
            onClick={() => setIsDeleteSelectionConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2 text-left">Delete Selection?</h3>
                <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                  Are you sure you want to delete the selected{" "}
                  {selectedPapers.length === 1 ? "document" : "documents"}? This will permanently
                  remove them from your library.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsDeleteSelectionConfirmOpen(false)}
                    className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      selectedPapers.forEach((title) => dbDeletePaper(title));
                      setSelectedPapers([]);
                      setIsDeleteSelectionConfirmOpen(false);
                    }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Folder Deletion Modal */}
        {isDeleteFolderModalOpen && folderToDelete && (
          <div
            className="fixed inset-0 z-[10600] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setIsDeleteFolderModalOpen(false)}
          >
            <div
              className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2 text-left">Delete Folder?</h3>
                <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left">
                  Are you sure you want to delete{" "}
                  <span className="text-zinc-200 font-semibold">"{folderToDelete.name}"</span>? All
                  documents indexed within this folder will be removed.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsDeleteFolderModalOpen(false)}
                    className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      dbDeleteFolder(folderToDelete.id);
                      setIsDeleteFolderModalOpen(false);
                      setFolderToDelete(null);
                    }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
