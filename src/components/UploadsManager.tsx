import React from "react";
import { Icon } from "./SolarIcon";
import { motion, AnimatePresence } from "motion/react";

export interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "starting" | "uploading" | "success" | "error" | "cancelled";
  error?: string;
  xhr?: XMLHttpRequest;
}

interface UploadsManagerProps {
  tasks: UploadTask[];
  onCancelTask: (taskId: string) => void;
  onCancelAll: () => void;
  onClose: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const UploadsManager: React.FC<UploadsManagerProps> = ({
  tasks,
  onCancelTask,
  onCancelAll,
  onClose,
  isCollapsed,
  setIsCollapsed,
}) => {
  if (tasks.length === 0) return null;

  const activeCount = tasks.filter((t) => t.status === "uploading" || t.status === "starting").length;
  const successCount = tasks.filter((t) => t.status === "success").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;

  let titleText = "";
  if (activeCount > 0) {
    titleText = `Uploading ${activeCount} item${activeCount > 1 ? "s" : ""}`;
  } else if (errorCount > 0 && successCount === 0) {
    titleText = `${errorCount} upload failed`;
  } else {
    titleText = `Uploaded ${successCount} item${successCount !== 1 ? "s" : ""}`;
  }

  // Get current status label
  const activeTask = tasks.find((t) => t.status === "uploading" || t.status === "starting");
  const overallStatusText = activeTask
    ? activeTask.status === "starting"
      ? "Starting upload..."
      : `Uploading "${activeTask.fileName}"...`
    : activeCount === 0 && errorCount > 0
    ? "Upload completed with errors"
    : "All uploads complete";

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return { icon: "ph:file-pdf", color: "text-red-400" };
      case "docx":
      case "doc":
        return { icon: "ph:file-doc", color: "text-blue-400" };
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
        return { icon: "ph:file-image", color: "text-emerald-400" };
      case "txt":
      case "md":
        return { icon: "ph:file-text", color: "text-zinc-400" };
      case "csv":
        return { icon: "ph:file-csv", color: "text-green-400" };
      default:
        return { icon: "ph:file", color: "text-zinc-500" };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-[#161618] border border-[#27272a] rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col select-none font-sans">
      {/* Header section */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e20] border-b border-[#27272a]">
        <span className="text-xs font-semibold text-zinc-100 tracking-wide">
          {titleText}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-[#2c2c2e] rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            <Icon
              icon="ph:caret-down"
              className={`w-4 h-4 transition-transform duration-200 ${
                isCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#2c2c2e] rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <Icon icon="ph:x" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Accordion List Body */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex flex-col"
          >
            {/* Context/status ticker bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1c1c1e] border-b border-[#27272a] text-[11px]">
              <span className="text-zinc-400 font-medium truncate pr-2">
                {overallStatusText}
              </span>
              {activeCount > 0 && (
                <button
                  onClick={onCancelAll}
                  className="text-blue-400 hover:text-blue-350 hover:underline shrink-0 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* List items */}
            <div className="max-h-60 overflow-y-auto divide-y divide-[#27272a]">
              {tasks.map((task) => {
                const { icon, color } = getFileIcon(task.fileName);
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-4 py-3 bg-[#141416] hover:bg-[#19191b] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Icon icon={icon} className={`w-5 h-5 shrink-0 ${color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-200 truncate pr-2">
                          {task.fileName}
                        </div>
                        {/* Progress Bar (only shown during uploading) */}
                        {(task.status === "uploading" || task.status === "starting") && (
                          <div className="w-full bg-[#27272a] h-1 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="bg-zinc-300 h-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        )}
                        {task.status === "error" && (
                          <div className="text-[10px] text-red-400 truncate mt-0.5">
                            {task.error || "Upload failed"}
                          </div>
                        )}
                        {task.status === "cancelled" && (
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Cancelled
                          </div>
                        )}
                        {task.status === "success" && (
                          <div className="text-[10px] text-emerald-400 mt-0.5">
                            Completed
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {/* Status Icon Indicator */}
                      {task.status === "success" && (
                        <Icon icon="ph:check-circle" className="w-4 h-4 text-emerald-400" />
                      )}
                      {task.status === "error" && (
                        <Icon icon="ph:warning-circle" className="w-4 h-4 text-red-400" />
                      )}
                      {task.status === "cancelled" && (
                        <Icon icon="ph:minus" className="w-4 h-4 text-zinc-500" />
                      )}
                      {(task.status === "uploading" || task.status === "starting") && (
                        <div className="relative flex items-center justify-center">
                          {/* Sleek rotating ring spinner */}
                          <svg className="animate-spin h-4.5 w-4.5 text-zinc-400" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                              fill="none"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        </div>
                      )}

                      {/* Cancel task action on hover or if running */}
                      {(task.status === "uploading" || task.status === "starting") && (
                        <button
                          onClick={() => onCancelTask(task.id)}
                          className="p-1 hover:bg-[#2c2c2e] rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Cancel upload"
                        >
                          <Icon icon="ph:x" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
