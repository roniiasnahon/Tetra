import React, { useRef, useEffect, useState, useCallback } from "react";
import { Tab, ChatMessage, PaperItem, FolderItem } from "../types";
import { MainChat } from "./MainChat";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { showToast } from "./Toast";

interface ChatPanelProps {
  tab: Tab;
  currentUser: any;
  isOnline: boolean;
  papers: PaperItem[];
  folders: FolderItem[];
  selectedFolderId: string;
  documentTitle: string;
  documentContent: string;
  setDocumentTitle: (title: string) => void;
  setDocumentContent: (content: string) => void;
  setDocSaveStatus: (status: any) => void;
  folderName: string;
  savedNoteName: string;
  attachedFile: any;
  setAttachedFile: (file: any) => void;
  handlePaperclipClick: () => void;
  onTabUpdate: (tabId: string, updatedFields: Partial<Tab>) => void;
  setOnboardingTaskComplete: (task: string) => void;
  saveDraftToLibrary: (tab: Tab) => void;
  dbSetPaper: (paper: any) => void;
  extractTextFromPdf: (url: string) => Promise<string>;
  parseAssistantResponse: (text: string) => any;
  getFallbackResponse: (text: string) => any;
  markdownToHtml: (markdown: string) => string;
  editorRef: React.RefObject<HTMLDivElement | null>;
  ignoreNextTabSyncRef: React.MutableRefObject<string | null>;
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  isAiTyping: boolean;
  setIsAiTyping: (typing: boolean) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  tab,
  currentUser,
  isOnline,
  papers,
  folders,
  selectedFolderId,
  documentTitle,
  documentContent,
  setDocumentTitle,
  setDocumentContent,
  setDocSaveStatus,
  folderName,
  savedNoteName,
  attachedFile,
  setAttachedFile,
  handlePaperclipClick,
  onTabUpdate,
  setOnboardingTaskComplete,
  saveDraftToLibrary,
  dbSetPaper,
  extractTextFromPdf,
  parseAssistantResponse,
  getFallbackResponse,
  markdownToHtml,
  editorRef,
  ignoreNextTabSyncRef,
  activeTabId,
  setActiveTabId,
  setTabs,
  isAiTyping,
  setIsAiTyping,
}) => {
  // Local Chat states
  const [messages, setMessages] = useState<ChatMessage[]>(() => tab.messages || []);
  const [chatInput, setChatInput] = useState(() => tab.chatInput || "");
  const [researchStatus, setResearchStatus] = useState<"fetching" | "downloading" | "polishing" | "editor_agent" | null>(null);

  // Model states
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem("cosmi_settings_model") || "auto";
  });
  const [thinkingLevel, setThinkingLevel] = useState<"Standard" | "Deep" | "Instant">(() => {
    return (localStorage.getItem("cosmi_settings_thinking") as any) || "Standard";
  });
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(() => {
    return localStorage.getItem("cosmi_settings_web_search") !== "false";
  });

  // Refs for tracking async streaming state
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantMessageIdRef = useRef<string | null>(null);
  const aiWritingTabIdRef = useRef<string | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  // Sync state to tab if the prop-level tab changes (with reference/content guard and isAiTyping check)
  useEffect(() => {
    if (isAiTyping) return;
    setMessages((prev) => {
      const next = tab.messages || [];
      if (prev.length === next.length && prev[prev.length - 1]?.content === next[next.length - 1]?.content) {
        return prev;
      }
      return next;
    });
    setChatInput((prev) => {
      const next = tab.chatInput || "";
      if (prev === next) return prev;
      return next;
    });
  }, [tab.id, tab.messages, tab.chatInput, isAiTyping]);

  // Persist model settings when they change
  useEffect(() => {
    localStorage.setItem("cosmi_settings_model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem("cosmi_settings_thinking", thinkingLevel);
  }, [thinkingLevel]);

  useEffect(() => {
    localStorage.setItem("cosmi_settings_web_search", String(webSearchEnabled));
  }, [webSearchEnabled]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Sync helper that updates the parent tab state
  const syncWithParent = useCallback((nextMsgs: ChatMessage[], isFinished = false) => {
    onTabUpdate(tab.id, { messages: nextMsgs });
    
    // Also throttled update to parent so storage can sync, but only at end or if 1.5s has elapsed
    const now = Date.now();
    if (isFinished || now - lastSyncTimeRef.current > 1500) {
      lastSyncTimeRef.current = now;
      // Triggers saving / persistence logic in parent
      onTabUpdate(tab.id, { messages: nextMsgs, chatInput: isFinished ? "" : chatInput });
    }
  }, [tab.id, onTabUpdate, chatInput]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAiTyping(false);
    setResearchStatus(null);
    aiWritingTabIdRef.current = null;
    syncWithParent(messages, true);
  }, [messages, syncWithParent]);

  const handleEditLastPrompt = async (newContent: string) => {
    const lastUserIdx = [...messages].map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;

    const remainingMessages = messages.slice(0, lastUserIdx);
    const originalAttachment = messages[lastUserIdx]?.attachment;

    await handleSendMessage(newContent, {
      overrideMessages: remainingMessages,
      overrideAttachment: originalAttachment,
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
    const textToSend = customText || chatInput;
    if (!textToSend.trim()) return;

    if (tab.fileId) {
      setOnboardingTaskComplete("chat_with_file");
    }
    if (tab.type === "chat" && tab.folderId) {
      setOnboardingTaskComplete("folder_chat");
    }

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
      isHidden: options.isHidden ?? false,
      attachment: options.overrideAttachment !== undefined ? options.overrideAttachment : (attachedFile ? { ...attachedFile } : undefined),
    };

    // Clear attached file in parent
    setAttachedFile(null);

    let nextMsgs: ChatMessage[];
    if (options.overrideMessages) {
      nextMsgs = [...options.overrideMessages, userMessage];
    } else {
      nextMsgs = [...messages, userMessage];
    }

    setMessages(nextMsgs);
    setChatInput("");
    onTabUpdate(tab.id, { messages: nextMsgs, chatInput: "" });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAiTyping(true);

    // Generate a title if empty/untitled
    if (tab.type === "chat" && (tab.title === "Untitled" || tab.title === "New chat")) {
      fetch("/api/research/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userQuery: textToSend }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((titleData) => {
          if (titleData?.title) {
            onTabUpdate(tab.id, { title: titleData.title });
          }
        })
        .catch((err) => console.error("Title generation failed", err));
    }

    try {
      const localInstructions = localStorage.getItem("cosmi_settings_system_instructions") || "";
      const localExplainStyle = localStorage.getItem("cosmi_settings_explain_style") || "Standard";
      const localWriteStyle = localStorage.getItem("cosmi_settings_write_style") || "Standard";
      const localPersonality = localStorage.getItem("cosmi_settings_personality") || "Success Student Mentor";
      const localFullName = localStorage.getItem("cosmi_settings_full_name") || "";
      const localWorkType = localStorage.getItem("cosmi_settings_work_desc") || "Other";

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
          messages: nextMsgs.slice(-20).map((m) => ({
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

      if (!response.ok) {
        throw new Error("API server returned status " + response.status);
      }

      assistantMessageIdRef.current = String(Date.now() + 1);
      const initialAssistantMsg: ChatMessage = {
        id: assistantMessageIdRef.current!,
        role: "assistant",
        content: "",
        thought: "",
        timestamp: Date.now(),
      };
      
      let currentMsgs = [...nextMsgs, initialAssistantMsg];
      setMessages(currentMsgs);

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
          streamBuffer = lines.pop() || "";

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
                if (parsed.text) {
                  accumulatedText += parsed.text;

                  const {
                    thought,
                    chat,
                    title: parsedTitle,
                    replaceContent: parsedContent,
                    searchRealPapersQuery,
                  } = parseAssistantResponse(accumulatedText);

                  let changed = false;
                  currentMsgs = currentMsgs.map((m) => {
                    if (m.id === assistantMessageIdRef.current) {
                      const updated = { ...m };
                      if (chat !== undefined && m.content !== chat) {
                        updated.content = chat;
                        changed = true;
                      }
                      if (thought !== undefined && m.thought !== thought) {
                        updated.thought = thought;
                        changed = true;
                      }
                      return updated;
                    }
                    return m;
                  });

                  if (changed) {
                    setMessages(currentMsgs);
                    syncWithParent(currentMsgs, false);
                  }

                  if (parsedTitle) {
                    setDocumentTitle(parsedTitle);
                    lastGeneratedTitle = parsedTitle;
                  }

                  // Process real paper search
                  if (searchRealPapersQuery && accumulatedText.toLowerCase().includes("</searchrealpapers>") && !hasTriggeredDownloadPaper) {
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
                            setOnboardingTaskComplete("search_papers");
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
                                  fullTextStatus: p.fileId ? "Mapped" : "Link Only",
                                  viewed: "Yes",
                                  fileType: "Document",
                                  summary: p.abstract || "",
                                  fileId: p.fileId,
                                  mimetype: p.mimetype || "application/pdf",
                                  extractedText: p.fileId
                                    ? await extractTextFromPdf(`/api/files/${p.fileId}`)
                                    : "",
                                  folderId: selectedFolderId || folders[0]?.id || "f1",
                                };
                              }),
                            );

                            newPapers.forEach((np) => {
                              dbSetPaper(np);
                            });
                            setResearchStatus(null);

                            newPapers.forEach((p) => {
                              if (!p.fileId) {
                                setTimeout(() => {
                                  const assistantMsg: ChatMessage = {
                                    id: String(Date.now() + Math.random()),
                                    role: "assistant",
                                    content: `### ⚠️ No free version available: ${p.title}\n\nThe full-text document is hosted behind a restricted publisher credential check or locked portal, and no free/open-access PDF could be found.\n\n* **Suggested Alternative:** Look for alternative papers or try refining the keywords/search terms to target open-access repositories.\n* **Manual Upload:** If you have this document's PDF stored locally on your device, you can manually upload it to the workspace for a robust analysis.`,
                                    timestamp: Date.now(),
                                  };
                                  setMessages((prev) => {
                                    const nextList = [...prev, assistantMsg];
                                    setTimeout(() => syncWithParent(nextList, false), 0);
                                    return nextList;
                                  });
                                }, 1000);
                              }
                            });

                            const newTabs = newPapers
                              .filter((p: any) => p.fileId)
                              .flatMap((p: any) => {
                                let html = "";
                                if (p.extractedText) {
                                  const pages = p.extractedText.split(/--- Page \d+ of \d+ ---/);
                                  const markers = p.extractedText.match(/--- Page (\d+) of \d+ ---/g) || [];

                                  html = `<div class="p-6 text-zinc-300 max-w-3xl mx-auto">
                                   <h1 class="text-3xl font-medium tracking-tight mb-2 text-white">${p.title}</h1>
                                   <p class="text-[11px] font-mono text-zinc-500 mb-6 uppercase tracking-wider">Mapped Document: ${p.title}</p>
                                   <div class="h-[1px] bg-zinc-800 mb-6"></div>`;

                                  pages.forEach((pageContent: string, idx: number) => {
                                    if (!pageContent.trim() && idx === 0) return;
                                    const pageNumMatch = idx > 0 ? markers[idx - 1]?.match(/\d+/) : null;
                                    const pageNum = pageNumMatch ? pageNumMatch[0] : idx === 0 ? "1" : idx.toString();

                                    html += `<div id="pdf-page-${pageNum}" class="mb-10 pt-4 border-t border-zinc-800/30 group/page">
                                     <div class="text-[10px] font-mono text-zinc-600 mb-4 uppercase tracking-widest group-hover/page:text-zinc-400 transition-colors">Page ${pageNum}</div>
                                     <div class="space-y-4 leading-relaxed">${pageContent
                                       .trim()
                                       .split("\n\n")
                                       .map((para: string) => para.trim() ? `<p>${para.replace(/\n/g, "<br/>")}</p>` : "")
                                       .join("")}</div>
                                   </div>`;
                                  });
                                  html += `</div>`;
                                }

                                const overviewHtml = markdownToHtml(`## ${p.title}\n\n**Overview:**\n\n${p.summary || "I have successfully indexed this paper."}`);

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
                                    folderId: selectedFolderId || folders[0]?.id || "f1",
                                  }
                                ];
                              });

                            if (newTabs.length > 0) {
                              setTabs((prev) => [...prev, ...newTabs]);
                              setTimeout(() => {
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

                  if (parsedContent && parsedContent.length > 5 && !parsedContent.trim().startsWith("</") && !parsedContent.trim().startsWith(">")) {
                    if (!hasSwitchedToDoc) {
                      hasSwitchedToDoc = true;

                      setTabs((prevTabs) => {
                        const currentActive = prevTabs.find((t) => t.id === activeTabId);
                        const emptyDocTab = prevTabs.find(
                          (t) =>
                            t.type === "document" &&
                            !t.fileId &&
                            (!t.content || t.content.trim() === "" || t.content.trim() === "<p><br></p>"),
                        );

                        if (currentActive && currentActive.type === "document" && !currentActive.fileId && (!currentActive.content || currentActive.content.trim() === "" || currentActive.content.trim() === "<p><br></p>")) {
                          targetTabIdForAi = currentActive.id;
                        } else if (emptyDocTab) {
                          targetTabIdForAi = emptyDocTab.id;
                        } else {
                          targetTabIdForAi = "doc-" + Date.now();
                        }

                        aiWritingTabIdRef.current = targetTabIdForAi;

                        const exists = prevTabs.find((t) => t.id === targetTabIdForAi);
                        if (exists) return prevTabs;
                        return [
                          ...prevTabs,
                          {
                            id: targetTabIdForAi!,
                            type: "document",
                            title: parsedTitle || "Untitled Document",
                            content: "",
                          },
                        ];
                      });

                      setTimeout(() => {
                        if (targetTabIdForAi) {
                          ignoreNextTabSyncRef.current = targetTabIdForAi;
                          setActiveTabId(targetTabIdForAi);
                        }
                      }, 0);
                    }

                    let rawContent = parsedContent;
                    const headingIndex = rawContent.indexOf("## ");
                    const h1Index = rawContent.indexOf("# ");
                    let firstValidIndex = -1;
                    if (headingIndex !== -1 && h1Index !== -1) {
                      firstValidIndex = Math.min(headingIndex, h1Index);
                    } else {
                      firstValidIndex = Math.max(headingIndex, h1Index);
                    }

                    if (firstValidIndex > 0) {
                      const introPart = rawContent.substring(0, firstValidIndex);
                      if (/((?:Awesome)|(?:Sure)|(?:I've)|(?:I’ve)|(?:I’ll)|(?:I'll)|(?:Here)|(?:Got it)|(?:chat message))/i.test(introPart)) {
                        rawContent = rawContent.substring(firstValidIndex);
                      }
                    }

                    rawContent = rawContent.trim();
                    const htmlContent = markdownToHtml(rawContent);
                    lastGeneratedHtml = htmlContent;

                    if (targetTabIdForAi) {
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === targetTabIdForAi
                            ? {
                                ...t,
                                content: htmlContent,
                                title: parsedTitle || t.title,
                              }
                            : t,
                        ),
                      );

                      if (activeTabId === targetTabIdForAi) {
                        setDocumentContent(htmlContent);
                        if (editorRef.current) {
                          editorRef.current.innerHTML = htmlContent;
                        }
                        if (parsedTitle) setDocumentTitle(parsedTitle);
                      }
                    } else {
                      setDocumentContent(htmlContent);
                      if (editorRef.current) {
                        editorRef.current.innerHTML = htmlContent;
                      }
                      if (parsedTitle) setDocumentTitle(parsedTitle);
                    }
                  }
                }
              } catch (e) {
                // ignore partial JSON parse errors
              }
            }
          }
        }
      }

      setIsAiTyping(false);
      aiWritingTabIdRef.current = null;
      syncWithParent(currentMsgs, true);

      if (targetTabIdForAi && lastGeneratedHtml) {
        const finalTitle = lastGeneratedTitle || "Untitled Document";
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
        return;
      }
      setIsAiTyping(false);
      aiWritingTabIdRef.current = null;
      console.warn("Express server LLM failed, using deep local simulation rules:", e);

      const fallbackPayload = getFallbackResponse(textToSend);
      const simulatedAnswer = fallbackPayload.text;

      if (fallbackPayload.suggestion) {
        if (fallbackPayload.suggestion.type === "edit_document") {
          if (fallbackPayload.suggestion.title) {
            const newTitle = fallbackPayload.suggestion.title;
            setDocumentTitle(newTitle);
            onTabUpdate(tab.id, { title: newTitle });
          }
          if (fallbackPayload.suggestion.appendContent) {
            const htmlContent = markdownToHtml(fallbackPayload.suggestion.appendContent);
            const newContent = documentContent + htmlContent;
            setDocumentContent(newContent);
            setTabs((prevTabs) =>
              prevTabs.map((t) => (t.id === activeTabId ? { ...t, content: newContent } : t)),
            );
            if (editorRef.current) {
              editorRef.current.innerHTML = newContent;
            }
          }
        }
      }

      const fallbackAssistantMsg: ChatMessage = {
        id: String(Date.now() + 2),
        role: "assistant",
        content: simulatedAnswer,
        timestamp: Date.now(),
      };
      const finalFallbackMsgs = [...nextMsgs, fallbackAssistantMsg];
      setMessages(finalFallbackMsgs);
      syncWithParent(finalFallbackMsgs, true);
    }
  };

  return (
    <MainChat
      tab={tab}
      messages={messages}
      chatInput={chatInput}
      setChatInput={(val) => {
        setChatInput(val);
        onTabUpdate(tab.id, { chatInput: val });
      }}
      isAiTyping={isAiTyping}
      handleSendMessage={handleSendMessage}
      handleStopGeneration={handleStopGeneration}
      researchStatus={researchStatus}
      currentUser={currentUser}
      isOnline={isOnline}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      thinkingLevel={thinkingLevel}
      setThinkingLevel={setThinkingLevel}
      webSearchEnabled={webSearchEnabled}
      setWebSearchEnabled={setWebSearchEnabled}
      attachedFile={attachedFile}
      setAttachedFile={setAttachedFile}
      handlePaperclipClick={handlePaperclipClick}
      papers={papers}
      handleEditLastPrompt={handleEditLastPrompt}
    />
  );
};
