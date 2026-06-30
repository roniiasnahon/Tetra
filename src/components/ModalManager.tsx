import React from "react";
import { motion, AnimatePresence } from "motion/react";

export interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

interface ModalManagerProps {
  activeModal: "deleteFolder" | "deleteSelection" | "closeTab" | "deleteChat" | "exitApp" | null;
  onClose: () => void;
  
  // Folder Delete
  folderToDelete: FolderItem | null;
  onDeleteFolderConfirm: () => void;
  
  // Tab Close
  tabIdToDelete: string | null;
  onCloseTabConfirm: () => void;
  
  // Chat Delete
  chatIdToDelete: string | null;
  onDeleteChatConfirm: () => void;
  
  // Selection Delete
  selectedPapersCount: number;
  onDeleteSelectionConfirm: () => void;
  
  // Exit App
  onExitAppConfirm: () => void;
}

export const ModalManager: React.FC<ModalManagerProps> = ({
  activeModal,
  onClose,
  folderToDelete,
  onDeleteFolderConfirm,
  tabIdToDelete,
  onCloseTabConfirm,
  chatIdToDelete,
  onDeleteChatConfirm,
  selectedPapersCount,
  onDeleteSelectionConfirm,
  onExitAppConfirm,
}) => {
  return (
    <AnimatePresence>
      {/* 1. Folder Deletion Confirmation Modal */}
      {activeModal === "deleteFolder" && folderToDelete && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4 animate-fade-in"
          onClick={onClose}
        >
          <div
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">
                Delete Folder?
              </h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left">
                Are you sure you want to delete{" "}
                <span className="text-zinc-200 font-semibold">
                  "{folderToDelete.name}"
                </span>
                ? All documents indexed within this folder will be removed.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onDeleteFolderConfirm}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Close Tab Confirmation Modal */}
      {activeModal === "closeTab" && tabIdToDelete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">Close Tab?</h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                Are you sure you want to close this tab? Any unsaved changes might be lost.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onCloseTabConfirm}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  Close Tab
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 3. Exit App Confirmation Modal */}
      {activeModal === "exitApp" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">Exit Cosmi?</h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                Are you sure you want to exit Cosmi? Unsaved workspace states might be lost.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onExitAppConfirm}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  Exit App
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 4. Delete Chat Confirmation Modal */}
      {activeModal === "deleteChat" && chatIdToDelete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">
                Delete Chat?
              </h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                Are you sure you want to delete this chat permanently? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onDeleteChatConfirm}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 5. Delete Selection Confirmation Modal */}
      {activeModal === "deleteSelection" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2 text-left">
                Delete Selection?
              </h3>
              <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                Are you sure you want to delete the selected {selectedPapersCount === 1 ? "document" : "documents"}? This will permanently remove them from your library.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onDeleteSelectionConfirm}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
