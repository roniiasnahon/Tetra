import React, { useState } from "react";
import { Icon } from "./SolarIcon";
import { motion, AnimatePresence } from "motion/react";
import { Tab } from "../App";
import { Plus } from "lucide-react";
import { AddFolder } from "@solar-icons/react";

interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

interface HomePanelProps {
  currentUser: any;
  callMe: string;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  createNewDocument: () => void;
  folders: FolderItem[];
  dbSetFolder: (folder: FolderItem) => void;
  setSelectedFolderId: (id: string | null) => void;
}

export const HomePanel: React.FC<HomePanelProps> = ({
  currentUser,
  callMe,
  tabs,
  setTabs,
  setActiveTabId,
  createNewDocument,
  folders,
  dbSetFolder,
  setSelectedFolderId,
}) => {
  const [isHomeCreateDropdownOpen, setIsHomeCreateDropdownOpen] = useState(false);

  // Close dropdown helper
  const closeDropdown = () => setIsHomeCreateDropdownOpen(false);

  return (
    <div className="flex-1 overflow-y-auto focus:outline-none scroll-smooth">
      <div className="max-w-[800px] mx-auto w-full p-8 md:p-14 lg:p-20 flex flex-col justify-center min-h-full">
        {(() => {
          const hour = new Date().getHours();
          let timeGreeting = "Good evening";
          if (hour < 12) timeGreeting = "Good morning";
          else if (hour < 18) timeGreeting = "Good afternoon";
          const customFullName = localStorage.getItem(
            `cosmi_settings_full_name_${currentUser?.uid || "guest"}`
          );
          const preferredName =
            callMe ||
            (customFullName
              ? customFullName.trim().split(" ")[0]
              : currentUser?.displayName
                ? currentUser.displayName.split(" ")[0]
                : "");
          return (
            <h1 className="text-3xl md:text-4xl text-[#f4f4f5] font-medium tracking-tight mb-8">
              {timeGreeting}
              {preferredName ? `, ${preferredName}` : ""}.
            </h1>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <button
            onClick={() => {
              const docTab = tabs.find(
                (t) => t.type === "document" && !t.fileId
              );
              if (docTab) {
                setActiveTabId(docTab.id);
              } else {
                createNewDocument();
              }
            }}
            className="flex items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-colors rounded-3xl text-left cursor-pointer group"
          >
            <div className="mr-5 flex items-center justify-center">
              <Icon
                icon="ph:pencil-line"
                className="w-7 h-7 text-[#f4f4f5]"
              />
            </div>
            <div>
              <h3 className="text-[#e4e4e7] font-medium text-sm">
                Resume Document
              </h3>
              <p className="text-[#a1a1aa] text-xs mt-0.5 truncate max-w-[200px]">
                {tabs.find((t) => t.type === "document" && !t.fileId)
                  ?.title || "Untitled Document"}
              </p>
            </div>
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsHomeCreateDropdownOpen(!isHomeCreateDropdownOpen);
              }}
              className={`flex w-full items-center p-4 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-all rounded-3xl text-left cursor-pointer group ${
                isHomeCreateDropdownOpen ? "ring-1 ring-zinc-500 bg-[#222222]" : ""
              }`}
            >
              <div className="mr-5 flex items-center justify-center text-[#e4e4e7]">
                <Plus
                  strokeWidth={2}
                  className={`w-7 h-7 transition-transform duration-300 ${
                    isHomeCreateDropdownOpen ? "rotate-45" : ""
                  }`}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-[#e4e4e7] font-medium text-sm">
                  Create New
                </h3>
                <p className="text-[#a1a1aa] text-xs mt-0.5">
                  Start a blank hypothesis
                </p>
              </div>
              <div className="flex items-center justify-center">
                <Icon
                  icon="ph:caret-down"
                  className={`w-4 h-4 text-[#71717a] transition-transform ${
                    isHomeCreateDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            <AnimatePresence>
              {isHomeCreateDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-60"
                    onClick={closeDropdown}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 8, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 w-56 bg-[#18181b] border border-[#27272a] rounded-2xl p-1.5 flex flex-col gap-0.5 z-[70] shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        createNewDocument();
                        closeDropdown();
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-[#27272a] transition-all cursor-pointer group"
                    >
                      <Icon
                        icon="ph:file-text"
                        className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"
                      />
                      <span className="font-medium text-xs text-left">
                        New Document
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        const newId = `chat-${Date.now()}`;
                        setTabs([
                          ...tabs,
                          {
                            id: newId,
                            type: "chat",
                            title: "Untitled",
                          },
                        ]);
                        setActiveTabId(newId);
                        closeDropdown();
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-[#27272a] transition-all cursor-pointer group"
                    >
                      <Icon
                        icon="ph:chat-circle"
                        className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"
                      />
                      <span className="font-medium text-xs text-left">
                        Talk to Cosmi
                      </span>
                    </button>

                    <div className="h-[1px] bg-[#27272a] mx-2 my-0.5" />

                    <button
                      onClick={() => {
                        const newFolderId = `folder-${Date.now()}`;
                        dbSetFolder({
                          id: newFolderId,
                          name: "Untitled Folder",
                          createdAt: Date.now(),
                        });
                        closeDropdown();
                      }}
                      className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-[#27272a] transition-all cursor-pointer group"
                    >
                      <AddFolder
                        weight="Linear"
                        className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors shrink-0"
                      />
                      <span className="font-medium text-xs text-left">
                        New Folder
                      </span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wider mb-6">
          Recent Folders
        </h2>
        <div className="relative group/carousel">
          <div
            className="flex overflow-x-auto gap-4 pb-6 custom-scrollbar-h scroll-smooth"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, rgba(0,0,0,1) 82%, rgba(0,0,0,0) 98%)",
              maskImage:
                "linear-gradient(to right, rgba(0,0,0,1) 82%, rgba(0,0,0,0) 98%)",
            }}
          >
            {folders.slice(0, 6).map((folder, idx) => (
              <button
                key={folder.id}
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  const libraryTab = tabs.find((t) => t.type === "library");
                  if (libraryTab) {
                    setActiveTabId(libraryTab.id);
                  } else {
                    const newId = `library-${Date.now()}`;
                    setTabs([
                      ...tabs,
                      {
                        id: newId,
                        type: "library",
                        title: "Library",
                      },
                    ]);
                    setActiveTabId(newId);
                  }
                }}
                className="flex flex-col items-start p-6 bg-[#1a1a1a] border border-[#27272a] hover:bg-[#222222] transition-all duration-300 rounded-[28px] text-left cursor-pointer group min-w-[240px] shrink-0"
              >
                <div className="mb-4">
                  <Icon
                    icon="ph:folder-user"
                    className="w-10 h-10 text-[#f4f4f5]"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[#e4e4e7] font-medium text-base truncate mb-1">
                    {folder.name}
                  </h3>
                  <p className="text-[#71717a] text-xs">
                    {idx === 0
                      ? "Recently updated"
                      : idx === 1
                        ? "Last week"
                        : "Research project"}
                  </p>
                </div>
              </button>
            ))}
            {/* Spacer for right padding in overflow */}
            <div className="min-w-[40px] shrink-0 h-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
