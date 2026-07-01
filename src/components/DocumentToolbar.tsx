import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { SidebarMinimalistic } from "@solar-icons/react";

interface DocumentToolbarProps {
  editorFont: string;
  setEditorFont: (font: string) => void;
  currentSelectionSize: number;
  changeSelectedFontSize: (increase: boolean) => void;
  applySpecificFontSize: (size: number) => void;
  handleFormat: (command: string, value?: string) => void;
  editorAlign: string;
  setEditorAlign: (align: any) => void;
  setIsTablePickerOpen: (isOpen: boolean) => void;
  isTablePickerOpen: boolean;
  tableGrid: { r: number; c: number };
  setTableGrid: (grid: { r: number; c: number }) => void;
  handleInsertTable: (r: number, c: number) => void;
  setIsChartModalOpen: (isOpen: boolean) => void;
  setChartBeingEdited: (chart: any) => void;
  isSidePanelOpen?: boolean;
  setIsSidePanelOpen?: (isOpen: boolean) => void;
  handlePrint?: () => void;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  editorFont,
  setEditorFont,
  currentSelectionSize,
  changeSelectedFontSize,
  applySpecificFontSize,
  handleFormat,
  editorAlign,
  setEditorAlign,
  setIsTablePickerOpen,
  isTablePickerOpen,
  tableGrid,
  setTableGrid,
  handleInsertTable,
  setIsChartModalOpen,
  setChartBeingEdited,
  isSidePanelOpen,
  setIsSidePanelOpen,
  handlePrint
}) => {
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false);
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isHighlightOpen, setIsHighlightOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const [headingButtonEl, setHeadingButtonEl] = useState<HTMLButtonElement | null>(null);
  const [fontButtonEl, setFontButtonEl] = useState<HTMLButtonElement | null>(null);
  const [textColorButtonEl, setTextColorButtonEl] = useState<HTMLButtonElement | null>(null);
  const [highlightButtonEl, setHighlightButtonEl] = useState<HTMLButtonElement | null>(null);
  const [moreButtonEl, setMoreButtonEl] = useState<HTMLButtonElement | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getDropdownStyle = (element: HTMLElement | null) => {
    if (!element) return {};
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 200; // conservative fallback
    
    let left = rect.left;
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }
    
    return {
      position: "fixed" as const,
      top: `${rect.bottom + 4}px`,
      left: `${Math.max(16, left)}px`,
      zIndex: 9999,
    };
  };

  const handleScroll = () => {
    setIsHeadingDropdownOpen(false);
    setIsFontDropdownOpen(false);
    setIsTextColorOpen(false);
    setIsHighlightOpen(false);
    setIsMoreOpen(false);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative') && !target.closest('[style*="position: fixed"]')) {
        handleScroll();
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  const [fontSizeInput, setFontSizeInput] = useState(currentSelectionSize.toString());

  useEffect(() => {
    setFontSizeInput(currentSelectionSize.toString());
  }, [currentSelectionSize]);

  const handleFontSizeChange = (val: string) => {
    setFontSizeInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 300) {
      applySpecificFontSize(num);
    }
  };

  const handleFontSizeBlur = () => {
    const num = parseInt(fontSizeInput, 10);
    if (!isNaN(num)) {
      const clamped = Math.max(8, Math.min(120, num));
      applySpecificFontSize(clamped);
      setFontSizeInput(clamped.toString());
    } else {
      setFontSizeInput(currentSelectionSize.toString());
    }
  };

  const colors = [
    { name: "White", value: "#ffffff", class: "bg-white border border-[#252528]" },
    { name: "Gray", value: "#a1a1aa", class: "bg-zinc-400" },
    { name: "Red", value: "#ef4444", class: "bg-red-500" },
    { name: "Orange", value: "#f97316", class: "bg-orange-500" },
    { name: "Yellow", value: "#eab308", class: "bg-yellow-500" },
    { name: "Green", value: "#22c55e", class: "bg-green-500" },
    { name: "Blue", value: "#3b82f6", class: "bg-blue-500" },
    { name: "Purple", value: "#a855f7", class: "bg-purple-500" },
  ];

  const highlights = [
    { name: "None", value: "transparent", class: "border border-dashed border-zinc-600 bg-transparent" },
    { name: "Yellow", value: "#fef08a", class: "bg-yellow-200 text-black" },
    { name: "Green", value: "#bbf7d0", class: "bg-green-200" },
    { name: "Blue", value: "#bfdbfe", class: "bg-blue-200" },
    { name: "Pink", value: "#fbcfe8", class: "bg-pink-200" },
    { name: "Purple", value: "#e9d5ff", class: "bg-purple-200" },
    { name: "Orange", value: "#fed7aa", class: "bg-orange-200" },
    { name: "Red", value: "#fca5a5", class: "bg-red-200" },
  ];

  const IconButton = ({ icon, onClick, active = false, title = "" }: { icon: string, onClick: (e: React.MouseEvent) => void, active?: boolean, title?: string }) => (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-[4px] transition-colors cursor-pointer flex items-center justify-center ${active ? "bg-[#3f3f46] text-white" : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7]"}`}
      title={title}
    >
      <MaterialIcon name={icon} className="text-[18px]" />
    </button>
  );

  const Divider = () => <div className="h-5 w-[1px] bg-zinc-800/30 shrink-0 mx-1" />;

  return (
    <div ref={containerRef} className="flex flex-col z-20 w-full bg-transparent px-0 py-1 overflow-visible">
      <div className="bg-[#18181b] border border-[#1d1d20] rounded-full px-4 h-[44px] flex items-center justify-between text-[13px] text-[#a1a1aa] select-none shadow-sm w-full overflow-hidden">
        <div 
          className="flex items-center gap-x-1 h-full flex-1 overflow-hidden"
        >
          {/* Undo/Redo/Spellcheck */}
          <IconButton icon="undo" onClick={() => handleFormat("undo")} title="Undo" />
          <IconButton icon="redo" onClick={() => handleFormat("redo")} title="Redo" />
          {width >= 580 && (
            <IconButton icon="spellcheck" onClick={() => {}} title="Spelling and grammar check" />
          )}
          {handlePrint && (
            <IconButton icon="print" onClick={handlePrint} title="Print document" />
          )}
          
          <Divider />

          {/* Heading Level */}
          <div className="relative flex items-center shrink-0">
            <button
              onClick={(e) => {
                setHeadingButtonEl(e.currentTarget);
                setIsHeadingDropdownOpen(!isHeadingDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-2.5 h-8 hover:bg-[#27272a] transition-colors rounded-[4px] text-[#e4e4e7] cursor-pointer"
            >
              <span className="font-medium text-[13px] min-w-[60px] text-left">Normal text</span>
              <MaterialIcon name="arrow_drop_down" className="text-[16px] text-[#71717a]" />
            </button>
            <AnimatePresence>
              {isHeadingDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  style={getDropdownStyle(headingButtonEl)}
                  className="bg-[#161616] border border-[#1d1d20] rounded-lg py-1 min-w-[140px] shadow-xl"
                >
                  {[
                    { label: "Normal text", tag: "p" },
                    { label: "Heading 1", tag: "h1" },
                    { label: "Heading 2", tag: "h2" },
                    { label: "Heading 3", tag: "h3" }
                  ].map(item => (
                    <button
                      key={item.tag}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        handleFormat("formatBlock", item.tag);
                        setIsHeadingDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#27272a] text-[#e4e4e7]"
                    >
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Divider />

          {/* Font Family */}
          <div className="relative flex items-center shrink-0">
            <button
              onClick={(e) => {
                setFontButtonEl(e.currentTarget);
                setIsFontDropdownOpen(!isFontDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-2.5 h-8 hover:bg-[#27272a] transition-colors rounded-[4px] text-[#e4e4e7] cursor-pointer"
            >
              <span className="font-medium text-[13px] min-w-[70px] text-left">
                {editorFont === "font-jakarta" ? "Plus Jakarta" :
                 editorFont === "font-serif" ? "Lora" :
                 editorFont === "font-sans" ? "Inter" : "Plus Jakarta"}
              </span>
              <MaterialIcon name="arrow_drop_down" className="text-[16px] text-[#71717a]" />
            </button>
            <AnimatePresence>
              {isFontDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  style={getDropdownStyle(fontButtonEl)}
                  className="bg-[#161616] border border-[#1d1d20] rounded-lg py-1 min-w-[140px] shadow-xl"
                >
                  {[
                    { value: "font-jakarta", label: "Plus Jakarta" },
                    { value: "font-serif", label: "Lora (Serif)" },
                    { value: "font-sans", label: "Inter (Sans)" },
                    { value: "font-mono", label: "Mono" },
                  ].map((font) => (
                    <button
                      key={font.value}
                      onClick={() => {
                        setEditorFont(font.value);
                        setIsFontDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center justify-between group cursor-pointer ${
                        editorFont === font.value
                          ? "bg-[#2c2c2e] text-[#f4f4f5]"
                          : "text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#e4e4e7]"
                      }`}
                    >
                      <span className={font.value}>{font.label}</span>
                      {editorFont === font.value && (
                        <MaterialIcon name="check" className="text-[14px] text-blue-400" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Divider />

          {/* Font Size */}
          <div className="flex items-center shrink-0 h-8 rounded-[4px] hover:bg-[#27272a] px-1">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeSelectedFontSize(false)}
              className="hover:bg-[#3f3f46] hover:text-white rounded-[4px] transition-colors w-6 h-6 flex items-center justify-center cursor-pointer text-[#e4e4e7]"
              title="Decrease font size"
            >
              <MaterialIcon name="remove" className="text-[14px] flex items-center justify-center" />
            </button>
            <input
              type="text"
              value={fontSizeInput}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              onBlur={handleFontSizeBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFontSizeBlur();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="font-mono w-9 text-center text-[#e4e4e7] bg-[#1f1f23] border border-[#3f3f46] rounded-[4px] mx-1 h-6 flex items-center justify-center text-[12px] focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeSelectedFontSize(true)}
              className="hover:bg-[#3f3f46] hover:text-white rounded-[4px] transition-colors w-6 h-6 flex items-center justify-center cursor-pointer text-[#e4e4e7]"
              title="Increase font size"
            >
              <MaterialIcon name="add" className="text-[14px] flex items-center justify-center" />
            </button>
          </div>

          <Divider />

          {/* Formatting */}
          <IconButton icon="format_bold" onClick={() => handleFormat("bold")} title="Bold" />
          <IconButton icon="format_italic" onClick={() => handleFormat("italic")} title="Italic" />
          <IconButton icon="format_underlined" onClick={() => handleFormat("underline")} title="Underline" />
          
          {/* Text Color & Highlight (Group 1 - hidden if width < 580) */}
          {width >= 580 && (
            <>
              {/* Text Color */}
              <div className="relative flex items-center shrink-0">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    setTextColorButtonEl(e.currentTarget);
                    setIsTextColorOpen(!isTextColorOpen);
                  }}
                  className="p-1.5 rounded-[4px] transition-colors cursor-pointer flex flex-col items-center justify-center text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7] h-8 relative"
                  title="Text color"
                >
                  <span className="font-serif font-bold text-[14px] leading-none mb-0.5">A</span>
                  <div className="h-[3px] w-4 bg-white rounded-full absolute bottom-1" />
                </button>
                <AnimatePresence>
                  {isTextColorOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      style={getDropdownStyle(textColorButtonEl)}
                      className="bg-[#161616] border border-[#1d1d20] rounded-xl p-2 shadow-xl grid grid-cols-4 gap-1 w-[120px]"
                    >
                      {colors.map(color => (
                        <button
                          key={color.value}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            handleFormat("foreColor", color.value);
                            setIsTextColorOpen(false);
                          }}
                          className={`w-6 h-6 rounded-full mx-auto cursor-pointer hover:scale-110 transition-transform ${color.class}`}
                          title={color.name}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Highlight Color */}
              <div className="relative flex items-center shrink-0">
                <IconButton icon="border_color" onClick={(e) => {
                  setHighlightButtonEl(e.currentTarget as HTMLButtonElement);
                  setIsHighlightOpen(!isHighlightOpen);
                }} title="Highlight color" />
                <AnimatePresence>
                  {isHighlightOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      style={getDropdownStyle(highlightButtonEl)}
                      className="bg-[#161616] border border-[#1d1d20] rounded-xl p-2 shadow-xl grid grid-cols-4 gap-1 w-[120px]"
                    >
                      {highlights.map(color => (
                        <button
                          key={color.value}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            handleFormat("hiliteColor", color.value);
                            setIsHighlightOpen(false);
                          }}
                          className={`w-6 h-6 flex items-center justify-center rounded-full mx-auto cursor-pointer hover:scale-110 transition-transform ${color.class}`}
                          title={color.name}
                        >
                          {color.value === "transparent" && <span className="text-[10px] text-zinc-400">×</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Alignment & Spacing (Group 3 - hidden if width < 820) */}
          {width >= 820 && (
            <>
              <Divider />
              <div className="flex items-center cursor-pointer hover:bg-[#27272a] rounded-[4px] px-0.5">
                <IconButton icon="format_align_left" onClick={() => { handleFormat("justifyLeft"); setEditorAlign("left"); }} title="Align" />
                <MaterialIcon name="arrow_drop_down" className="text-[16px] text-[#71717a] -ml-1" />
              </div>
              <div className="flex items-center cursor-pointer hover:bg-[#27272a] rounded-[4px] px-0.5 ml-1">
                <IconButton icon="format_line_spacing" onClick={() => {}} title="Line spacing" />
              </div>
            </>
          )}

          {/* Lists & Indents (Group 4 - hidden if width < 960) */}
          {width >= 960 && (
            <>
              <Divider />
              <div className="flex items-center cursor-pointer hover:bg-[#27272a] rounded-[4px] px-0.5">
                <IconButton icon="checklist" onClick={() => {}} title="Checklist" />
                <MaterialIcon name="arrow_drop_down" className="text-[16px] text-[#71717a] -ml-1" />
              </div>
              <div className="flex items-center cursor-pointer hover:bg-[#27272a] rounded-[4px] px-0.5">
                <IconButton icon="format_list_bulleted" onClick={() => handleFormat("insertUnorderedList")} title="Bulleted list" />
                <MaterialIcon name="arrow_drop_down" className="text-[16px] text-[#71717a] -ml-1" />
              </div>
              <div className="flex items-center cursor-pointer hover:bg-[#27272a] rounded-[4px] px-0.5">
                <IconButton icon="format_list_numbered" onClick={() => handleFormat("insertOrderedList")} title="Numbered list" />
                <MaterialIcon name="arrow_drop_down" className="text-[16px] text-[#71717a] -ml-1" />
              </div>
              <IconButton icon="format_indent_decrease" onClick={() => handleFormat("outdent")} title="Decrease indent" />
              <IconButton icon="format_indent_increase" onClick={() => handleFormat("indent")} title="Increase indent" />
              
              <Divider />
              <IconButton icon="format_clear" onClick={() => handleFormat("removeFormat")} title="Clear formatting" />
            </>
          )}

          {/* More Options Button */}
          {width < 960 && (
            <div className="relative flex items-center shrink-0 ml-1">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  setMoreButtonEl(e.currentTarget);
                  setIsMoreOpen(!isMoreOpen);
                }}
                className={`p-1.5 rounded-[4px] transition-colors cursor-pointer flex items-center justify-center ${
                  isMoreOpen 
                    ? "bg-[#3f3f46] text-white" 
                    : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7]"
                }`}
                title="More options"
              >
                <MaterialIcon name="more_vert" className="text-[18px]" />
              </button>
              <AnimatePresence>
                {isMoreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    style={getDropdownStyle(moreButtonEl)}
                    className="bg-[#161616] border border-[#1d1d20] rounded-xl p-3 shadow-xl flex flex-col gap-y-3 z-50 min-w-[210px]"
                  >
                    {/* Group 1 (Colors & Spellcheck) - hidden if width < 580 */}
                    {width < 580 && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-1">Style & Spelling</div>
                        <div className="flex items-center gap-1 bg-[#1a1a1d] p-1.5 rounded-lg border border-zinc-800/50">
                          {/* Text Color */}
                          <div className="relative flex items-center shrink-0">
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                setTextColorButtonEl(e.currentTarget);
                                setIsTextColorOpen(!isTextColorOpen);
                              }}
                              className="p-1.5 rounded-[4px] transition-colors cursor-pointer flex flex-col items-center justify-center text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7] h-8 relative"
                              title="Text color"
                            >
                              <span className="font-serif font-bold text-[14px] leading-none mb-0.5">A</span>
                              <div className="h-[3px] w-4 bg-white rounded-full absolute bottom-1" />
                            </button>
                          </div>

                          {/* Highlight Color */}
                          <div className="relative flex items-center shrink-0">
                            <IconButton icon="border_color" onClick={(e) => {
                              setHighlightButtonEl(e.currentTarget as HTMLButtonElement);
                              setIsHighlightOpen(!isHighlightOpen);
                            }} title="Highlight color" />
                          </div>

                          {/* Spellcheck */}
                          <IconButton icon="spellcheck" onClick={() => {}} title="Spelling and grammar check" />
                          {handlePrint && (
                            <IconButton icon="print" onClick={handlePrint} title="Print document" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Group 3 (Alignment & Spacing) - hidden if width < 820 */}
                    {width < 820 && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-1">Alignment</div>
                        <div className="flex items-center gap-1 bg-[#1a1a1d] p-1.5 rounded-lg border border-zinc-800/50 flex-wrap">
                          <IconButton icon="format_align_left" onClick={() => { handleFormat("justifyLeft"); setEditorAlign("left"); }} title="Align left" />
                          <IconButton icon="format_align_center" onClick={() => { handleFormat("justifyCenter"); setEditorAlign("center"); }} title="Align center" />
                          <IconButton icon="format_align_right" onClick={() => { handleFormat("justifyRight"); setEditorAlign("right"); }} title="Align right" />
                          <IconButton icon="format_align_justify" onClick={() => { handleFormat("justifyFull"); setEditorAlign("justify"); }} title="Justify" />
                          <IconButton icon="format_line_spacing" onClick={() => {}} title="Line spacing" />
                        </div>
                      </div>
                    )}

                    {/* Group 4 (Lists, Indents & Clear) - hidden if width < 960 */}
                    {width < 960 && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-1">Lists & Actions</div>
                        <div className="flex items-center gap-1 bg-[#1a1a1d] p-1.5 rounded-lg border border-zinc-800/50 flex-wrap">
                          <IconButton icon="checklist" onClick={() => {}} title="Checklist" />
                          <IconButton icon="format_list_bulleted" onClick={() => handleFormat("insertUnorderedList")} title="Bulleted list" />
                          <IconButton icon="format_list_numbered" onClick={() => handleFormat("insertOrderedList")} title="Numbered list" />
                          <IconButton icon="format_indent_decrease" onClick={() => handleFormat("outdent")} title="Decrease indent" />
                          <IconButton icon="format_indent_increase" onClick={() => handleFormat("indent")} title="Increase indent" />
                          <IconButton icon="format_clear" onClick={() => handleFormat("removeFormat")} title="Clear formatting" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Side Panel Toggle */}
        {setIsSidePanelOpen && (
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                isSidePanelOpen 
                  ? "text-zinc-200 bg-[#27272a]" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a]"
              }`}
              title={isSidePanelOpen ? "Collapse Side Panel" : "Expand Side Panel"}
            >
              <SidebarMinimalistic weight="BoldDuotone" color="currentColor" className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
