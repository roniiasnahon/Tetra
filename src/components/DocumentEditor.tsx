import React, { useRef, useEffect, useState, useCallback } from "react";
import { Tab } from "../App";
import { MaterialIcon } from "./MaterialIcon";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "motion/react";
import { SidebarMinimalistic } from "@solar-icons/react";
import { DocumentToolbar } from "./DocumentToolbar";

interface DocumentEditorProps {
  activeTabId: string;
  tab: Tab;
  isReadOnly: boolean;
  currentUser: any;
  editorRef: React.RefObject<HTMLDivElement | null>;
  editorFont: string;
  editorFontSize: number;
  setEditorFontSize: React.Dispatch<React.SetStateAction<number>>;
  editorAlign: string;
  setEditorAlign: React.Dispatch<React.SetStateAction<any>>;
  setEditorFont: React.Dispatch<React.SetStateAction<any>>;
  docSaveStatus: string;
  setDocSaveStatus: (status: any) => void;
  autoDraftEnabled: boolean;
  saveDraftToLibrary: (tab: Tab) => Promise<void>;
  onTabUpdate: (tabId: string, updatedFields: Partial<Tab>) => void;
  markdownToHtml: (markdown: string) => string;
  isChartModalOpen: boolean;
  setIsChartModalOpen: (val: boolean) => void;
  chartBeingEdited: HTMLElement | null;
  setChartBeingEdited: (el: HTMLElement | null) => void;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  isSidePanelOpen: boolean;
  setIsSidePanelOpen: (isOpen: boolean) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  activeTabId,
  tab,
  isReadOnly,
  currentUser,
  editorRef,
  editorFont,
  editorFontSize,
  setEditorFontSize,
  editorAlign,
  setEditorAlign,
  setEditorFont,
  docSaveStatus,
  setDocSaveStatus,
  autoDraftEnabled,
  saveDraftToLibrary,
  onTabUpdate,
  markdownToHtml,
  isChartModalOpen,
  setIsChartModalOpen,
  chartBeingEdited,
  setChartBeingEdited,
  setTabs,
  isSidePanelOpen,
  setIsSidePanelOpen,
}) => {
  // Local states to prevent parent re-renders on every keystroke
  const [documentTitle, setDocumentTitle] = useState(() => tab.title || "Untitled");
  const [documentContent, setDocumentContent] = useState(() => tab.content || "");
  const [currentSelectionSize, setCurrentSelectionSize] = useState(editorFontSize);

  // Toolbar UI states
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);
  const [tableGrid, setTableGrid] = useState({ r: 0, c: 0 });

  // Refs for typing state and timing
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<any>(null);
  const lastContentRef = useRef("");
  const lastLocalEditTimeRef = useRef<number>(0);

  // Sync state when active tab changes
  useEffect(() => {
    setDocumentTitle(tab.title || "Untitled");
    setDocumentContent(tab.content || "");
    if (editorRef.current && editorRef.current.innerHTML !== (tab.content || "")) {
      editorRef.current.innerHTML = tab.content || "";
      lastContentRef.current = tab.content || "";
    }
  }, [tab.id]);

  // Synchronize when tab content is updated externally (e.g., from AI stream)
  useEffect(() => {
    if (tab.content !== undefined && tab.content !== documentContent) {
      setDocumentContent(tab.content);
      if (editorRef.current && editorRef.current.innerHTML !== tab.content) {
        editorRef.current.innerHTML = tab.content;
        lastContentRef.current = tab.content;
      }
    }
  }, [tab.content]);

  useEffect(() => {
    if (tab.title !== undefined && tab.title !== documentTitle) {
      setDocumentTitle(tab.title);
    }
  }, [tab.title]);

  // Sync selection font size indicator
  useEffect(() => {
    setCurrentSelectionSize(editorFontSize);
  }, [editorFontSize]);

  // Debounced parent sync for document edits to avoid rapid parent re-renders
  useEffect(() => {
    if (documentTitle === tab.title && documentContent === tab.content) return;

    const timer = setTimeout(() => {
      onTabUpdate(tab.id, {
        title: documentTitle,
        content: documentContent,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [documentTitle, documentContent, tab.id]);

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
      setDocSaveStatus("saving");
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
      setDocSaveStatus("saving");
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
      setDocSaveStatus("saving");
    }
  };

  const insertTableAtCursor = (rows: number, cols: number) => {
    pushToUndo();
    let tableHtml = `<div class="table-embed-wrapper relative group my-6 border border-zinc-800 rounded-xl overflow-hidden p-2 bg-zinc-950/25" contenteditable="false">
      <div class="absolute right-2 top-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="this.closest('.table-embed-wrapper').remove()" class="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-850" title="Delete Table">🗑️</button>
      </div>
      <table class="w-full border-collapse border border-zinc-800 text-[13.5px] font-sans">
        <tbody>`;
    for (let r = 0; r < rows; r++) {
      tableHtml += `<tr class="border-b border-zinc-800">`;
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td class="border-r border-zinc-800 p-2 min-w-[60px]" contenteditable="true">&nbsp;</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table></div><p><br></p>`;

    document.execCommand("insertHTML", false, tableHtml);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastContentRef.current = html;
      setDocumentContent(html);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: html } : t)),
      );
      setDocSaveStatus("saving");
    }
  };

  const handlePrint = useCallback(() => {
    const title = documentTitle || "Untitled";
    const content = editorRef.current?.innerHTML || documentContent || "";

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    let fontFamily = 'system-ui, -apple-system, sans-serif';
    if (editorFont === "font-jakarta") {
      fontFamily = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    } else if (editorFont === "font-serif") {
      fontFamily = 'Lora, Georgia, serif';
    } else if (editorFont === "font-mono") {
      fontFamily = '"JetBrains Mono", monospace';
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>\${title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
          <style>
            @page {
              size: portrait;
              margin: 20mm 20mm 20mm 20mm;
            }
            body {
              font-family: \${fontFamily};
              color: #111111;
              line-height: 1.6;
              font-size: \${editorFontSize}px;
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              text-align: \${editorAlign};
            }
            h1.doc-title {
              font-size: 2.2rem;
              font-weight: 700;
              margin-top: 0;
              margin-bottom: 1.5rem;
              color: #000000;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 0.75rem;
              line-height: 1.2;
              letter-spacing: -0.025em;
              text-align: left;
            }
            p {
              margin-top: 0;
              margin-bottom: 1rem;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #000000;
              margin-top: 1.5rem;
              margin-bottom: 0.75rem;
              font-weight: 600;
              line-height: 1.3;
              text-align: left;
            }
            h1 { font-size: 1.6rem; }
            h2 { font-size: 1.3rem; }
            h3 { font-size: 1.15rem; }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 1rem;
              margin-bottom: 1.5rem;
              page-break-inside: avoid;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px 10px;
              text-align: left;
              color: #111111 !important;
              background-color: transparent !important;
            }
            th {
              background-color: #f3f4f6 !important;
              font-weight: 600;
            }
            
            .table-embed-wrapper button,
            .chart-embed-wrapper button {
              display: none !important;
            }

            .table-embed-wrapper {
              margin-bottom: 1.5rem;
              position: relative;
            }

            img {
              max-width: 100%;
              height: auto;
              page-break-inside: avoid;
            }

            blockquote {
              border-left: 3px solid #d1d5db;
              padding-left: 1rem;
              margin-left: 0;
              margin-right: 0;
              color: #4b5563;
              font-style: italic;
            }

            ul, ol {
              margin-top: 0;
              margin-bottom: 1rem;
              padding-left: 1.5rem;
            }
            li {
              margin-bottom: 0.25rem;
            }

            pre, code {
              font-family: "JetBrains Mono", monospace;
              background-color: #f3f4f6;
              padding: 0.15rem 0.3rem;
              border-radius: 4px;
              font-size: 0.9em;
            }
            pre {
              padding: 1rem;
              overflow-x: auto;
              margin-top: 1rem;
              margin-bottom: 1rem;
              background-color: #f3f4f6 !important;
            }
            pre code {
              background-color: transparent !important;
              padding: 0;
              border-radius: 0;
            }
          </style>
        </head>
        <body>
          <h1 class="doc-title">\${title}</h1>
          <div class="content">
            \${content}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Clean up iframe after 1 minute to ensure print processes finish
    setTimeout(() => {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 60000);
  }, [documentTitle, documentContent, editorFont, editorFontSize, editorAlign]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121212]">
      {/* Format Toolbar */}
      <div className="shrink-0 border-b border-[#202022] bg-[#121212] px-4 md:px-6 py-2 overflow-visible">
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
          handleInsertTable={insertTableAtCursor}
          setIsChartModalOpen={setIsChartModalOpen}
          setChartBeingEdited={setChartBeingEdited}
          isSidePanelOpen={isSidePanelOpen}
          setIsSidePanelOpen={setIsSidePanelOpen}
          handlePrint={handlePrint}
        />
      </div>

      {/* Editor surface */}
      <div className="flex-1 overflow-y-auto p-8 pb-24 md:p-14 md:pb-28 lg:p-20 lg:pb-32 focus:outline-none scroll-smooth">
        <div
          className={`max-w-[720px] mx-auto space-y-[1.5rem] ${editorFont} text-[#d4d4d8]`}
          style={{
            fontSize: `${editorFontSize}px`,
            textAlign: editorAlign as any,
          }}
        >
          {/* Main Document Title */}
          <TextareaAutosize
            key={`doc-title-${tab.id}`}
            id={`doc-title-${tab.id}`}
            name={`doc-title-${tab.id}`}
            autoComplete="off"
            readOnly={isReadOnly}
            value={documentTitle}
            onChange={(e) => {
              const newTitle = e.target.value;
              lastLocalEditTimeRef.current = Date.now();
              setDocumentTitle(newTitle);
              setDocSaveStatus("saving");
            }}
            onBlur={(e) => {
              saveDraftToLibrary({
                ...tab,
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
            />
          </div>
        </div>
      </div>
    </div>
  );
};
