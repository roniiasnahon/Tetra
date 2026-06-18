import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  signOut 
} from '../firebase';
import { 
  updateProfile, 
  sendPasswordResetEmail, 
  sendEmailVerification 
} from 'firebase/auth';
import { showToast } from './Toast';

interface SettingsProps {
  currentUser: any;
  onClose: () => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (val: boolean) => void;
  latexEnabled: boolean;
  setLatexEnabled: (val: boolean) => void;
  autoDraftEnabled: boolean;
  setAutoDraftEnabled: (val: boolean) => void;
  editorFont: string;
  setEditorFont: (val: string) => void;
  editorFontSize: number;
  setEditorFontSize: (val: number) => void;
  callMe: string;
  setCallMe: (val: string) => void;
  storageMode: "local" | "database";
  setStorageMode: (val: "local" | "database") => void;
}

type TabType = "general" | "account" | "privacy" | "capabilities" | "connectors" | "desktop";

export const Settings = ({ 
  currentUser, 
  onClose,
  webSearchEnabled,
  setWebSearchEnabled,
  latexEnabled,
  setLatexEnabled,
  autoDraftEnabled,
  setAutoDraftEnabled,
  editorFont,
  setEditorFont,
  editorFontSize,
  setEditorFontSize,
  callMe,
  setCallMe,
  storageMode,
  setStorageMode
}: SettingsProps) => {
  // Navigation & Search State
  const [activeTab, setActiveTab ] = useState<TabType>("general");
  const [searchQuery, setSearchQuery] = useState("");

  // Storage Persistence Mode selection state
  const [localStorageMode, setLocalStorageMode] = useState<"local" | "database">(() => {
    return (localStorage.getItem("cosmi_settings_storage_mode") as "local" | "database") || storageMode || "local";
  });
  const [isStorageModeDropdownOpen, setIsStorageModeDropdownOpen] = useState(false);

  // Input States (with LocalStorage persistence)
  const [fullName, setFullName] = useState(() => {
    const uid = currentUser?.uid || "guest";
    // Prefer saved local storage, otherwise fallback to Firebase display name
    return localStorage.getItem(`cosmi_settings_full_name_${uid}`) || currentUser?.displayName || "";
  });
  const [workType, setWorkType] = useState(() => {
    return localStorage.getItem("cosmi_settings_work_desc") || "Other";
  });
  const [instructions, setInstructions] = useState(() => {
    return localStorage.getItem("cosmi_settings_system_instructions") || "";
  });
  const [explainStyle, setExplainStyle] = useState(() => {
    return localStorage.getItem("cosmi_settings_explain_style") || "Standard";
  });
  const [writeStyle, setWriteStyle] = useState(() => {
    return localStorage.getItem("cosmi_settings_write_style") || "Standard";
  });
  const [personality, setPersonality] = useState(() => {
    return localStorage.getItem("cosmi_settings_personality") || "Success Student Mentor";
  });

  // Custom Dropdown Open States
  const [isWorkDropdownOpen, setIsWorkDropdownOpen] = useState(false);
  const [isExplainDropdownOpen, setIsExplainDropdownOpen] = useState(false);
  const [isWriteDropdownOpen, setIsWriteDropdownOpen] = useState(false);
  const [isPersonalityDropdownOpen, setIsPersonalityDropdownOpen] = useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  
  // Desktop Dropdown Open States
  const [isPdfDropdownOpen, setIsPdfDropdownOpen] = useState(false);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState(false);
  const [isWinDropdownOpen, setIsWinDropdownOpen] = useState(false);

  // Preference Settings
  const [appearanceTheme, setAppearanceTheme] = useState(() => {
    return localStorage.getItem("cosmi_settings_appearance") || "dark";
  });
  const [saveHistory, setSaveHistory] = useState(() => {
    const cached = localStorage.getItem("cosmi_settings_save_history");
    return cached !== "false";
  });
  const [allowTraining, setAllowTraining] = useState(() => {
    const cached = localStorage.getItem("cosmi_settings_allow_training");
    return cached !== "false";
  });

  // Desktop Preference States
  const [startOnLogin, setStartOnLogin] = useState(() => {
    return localStorage.getItem("cosmi_desktop_start_on_login") === "true";
  });
  const [enableShortcuts, setEnableShortcuts] = useState(() => {
    return localStorage.getItem("cosmi_desktop_enable_shortcuts") !== "false";
  });
  const [minimizeToTray, setMinimizeToTray] = useState(() => {
    return localStorage.getItem("cosmi_desktop_minimize_to_tray") === "true";
  });
  const [gpuAcceleration, setGpuAcceleration] = useState(() => {
    return localStorage.getItem("cosmi_desktop_gpu_acceleration") !== "false";
  });
  const [pdfEngine, setPdfEngine] = useState(() => {
    return localStorage.getItem("cosmi_desktop_pdf_engine") || "Standard PDFJS";
  });
  const [downloadDestination, setDownloadDestination] = useState(() => {
    return localStorage.getItem("cosmi_desktop_download_dest") || "Downloads Folder";
  });
  const [windowTheme, setWindowTheme] = useState(() => {
    return localStorage.getItem("cosmi_desktop_window_theme") || "Frameless Modern";
  });

  // Genuine Account State variables
  const [accountEmail, setAccountEmail] = useState(currentUser?.email || "");
  const [accountDisplayName, setAccountDisplayName] = useState(currentUser?.displayName || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  // Integrations states (simulation status)
  const [driveConnected, setDriveConnected] = useState(true);
  const [githubConnected, setGithubConnected] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);

  // Clear workspace status
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  // Sync profile display name changes to actual firebase if matching
  useEffect(() => {
    if (currentUser?.displayName && !accountDisplayName) {
      setAccountDisplayName(currentUser.displayName);
    }
  }, [currentUser]);

  const [customAvatar, setCustomAvatar] = useState(() => {
    return localStorage.getItem("cosmi_settings_avatar_url") || "";
  });
  const [isSavingAll, setIsSavingAll] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setCustomAvatar("");
  };

  const handleSaveAllChanges = async () => {
    setIsSavingAll(true);
    try {
      const uid = currentUser?.uid || "guest";
      localStorage.setItem(`cosmi_settings_full_name_${uid}`, fullName);
      localStorage.setItem(`cosmi_settings_call_me_${uid}`, callMe);
      localStorage.setItem("cosmi_settings_full_name", fullName);
      localStorage.setItem("cosmi_settings_call_me", callMe);
      localStorage.setItem("cosmi_settings_work_desc", workType);
      localStorage.setItem("cosmi_settings_system_instructions", instructions);
      localStorage.setItem("cosmi_settings_explain_style", explainStyle);
      localStorage.setItem("cosmi_settings_write_style", writeStyle);
      localStorage.setItem("cosmi_settings_personality", personality);
      localStorage.setItem("cosmi_settings_appearance", appearanceTheme);
      localStorage.setItem("cosmi_settings_save_history", saveHistory.toString());
      localStorage.setItem("cosmi_settings_allow_training", allowTraining.toString());
      
      localStorage.setItem("cosmi_settings_web_search", webSearchEnabled.toString());
      localStorage.setItem("cosmi_settings_latex", latexEnabled.toString());
      localStorage.setItem("cosmi_settings_auto_draft", autoDraftEnabled.toString());

      localStorage.setItem("cosmi_desktop_start_on_login", startOnLogin.toString());
      localStorage.setItem("cosmi_desktop_enable_shortcuts", enableShortcuts.toString());
      localStorage.setItem("cosmi_desktop_minimize_to_tray", minimizeToTray.toString());
      localStorage.setItem("cosmi_desktop_gpu_acceleration", gpuAcceleration.toString());
      localStorage.setItem("cosmi_desktop_pdf_engine", pdfEngine);
      localStorage.setItem("cosmi_desktop_download_dest", downloadDestination);
      localStorage.setItem("cosmi_desktop_window_theme", windowTheme);
      localStorage.setItem("cosmi_settings_storage_mode", localStorageMode);
      setStorageMode(localStorageMode);

      if (customAvatar) {
        localStorage.setItem("cosmi_settings_avatar_url", customAvatar);
      } else {
        localStorage.removeItem("cosmi_settings_avatar_url");
      }

      if (auth.currentUser && fullName && fullName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { 
          displayName: fullName 
        });
        setAccountDisplayName(fullName);
      } else if (auth.currentUser && accountDisplayName && accountDisplayName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { 
          displayName: accountDisplayName 
        });
        setFullName(accountDisplayName);
      }

      showToast("Settings successfully saved!", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Error saving: " + e.message, "error");
    } finally {
      setIsSavingAll(false);
    }
  };

  // Map active font option label text
  const chatFontLabel = (() => {
    switch(editorFont) {
      case "font-sans": return "Inter (Sans)";
      case "font-mono": return "JetBrains Mono";
      case "font-jakarta": return "Plus Jakarta";
      default: return "Plus Jakarta";
    }
  })();

  // Clear workspace data handler
  const handleClearWorkspace = () => {
    if (confirm("Are you absolutely sure you want to clear all workspace documents, chats, and citations? This cannot be undone.")) {
      setClearStatus("Clearing all cache...");
      setTimeout(() => {
        const uid = currentUser?.uid || "guest";
        localStorage.removeItem(`cosmi_tabs_${uid}`);
        localStorage.removeItem(`cosmi_activeTabId_${uid}`);
        localStorage.removeItem(`cosmi_messages_${uid}`);
        setClearStatus("Workspace cleared successfully! Reloading...");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }, 1500);
    }
  };

  // Genuine Auth Profile updates
  const handleUpdateCloudDisplayName = async () => {
    if (!auth.currentUser) return;
    setIsSavingProfile(true);
    try {
      await updateProfile(auth.currentUser, { 
        displayName: accountDisplayName 
      });
      showToast("Account profile changes saved to Cloud Auth!", "success");
      
      // Update local values too
      setFullName(accountDisplayName);
      localStorage.setItem("cosmi_settings_full_name", accountDisplayName);
    } catch (e: any) {
      showToast("Failed to update profile: " + e.message, "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendResetMail = async () => {
    if (!currentUser?.email) return;
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      showToast("Security password reset email dispatched!", "success");
    } catch (e: any) {
      showToast("Failed dispatching password reset: " + e.message, "error");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSendVerificationMail = async () => {
    if (!auth.currentUser) return;
    setIsSendingVerification(true);
    try {
      await sendEmailVerification(auth.currentUser);
      showToast("Activation verification email has been sent!", "success");
    } catch (e: any) {
      showToast("Failed sending verification link: " + e.message, "error");
    } finally {
      setIsSendingVerification(false);
    }
  };

  const tabsInfo = [
    { id: "general", label: "General", icon: "ph:gear-six", keywords: "profile name avatar call instructions preference appearance font work" },
    { id: "account", label: "Account", icon: "ph:user", keywords: "email account password credentials active session details verified logout provider" },
    { id: "privacy", label: "Privacy", icon: "ph:shield-check", keywords: "history clear train storage data privacy" },
    { id: "capabilities", label: "Capabilities", icon: "ph:stack", keywords: "grounding search web websearch engine auto save rules" },
    { id: "connectors", label: "Connectors", icon: "ph:plugs-connected", keywords: "github drive google slack integration notion connect" },
    { id: "desktop", label: "Desktop", icon: "ph:desktop", keywords: "desktop startup tray download window pdf accelerator shortcut system" },
  ];

  // Filter tabs based on search
  const filteredTabs = tabsInfo.filter(t => 
    searchQuery === "" || 
    t.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.keywords.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[1200px] max-w-full h-[820px] max-h-[95vh] bg-[#070707] text-white flex rounded-xl overflow-hidden shadow-2xl border border-[#27272a]"
      >
        {/* Sidebar */}
        <div className="w-[260px] shrink-0 border-r border-[#27272a] flex flex-col bg-[#070707]">
          <div className="p-4">
            <div className="bg-[#2a2a2a] rounded-lg flex items-center px-3 py-1.5 border border-[#3f3f3f]">
              <Icon icon="ph:magnifying-glass" className="w-[16px] h-[16px] text-zinc-400 mr-2" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..." 
                className="bg-transparent border-none outline-none text-[13px] text-zinc-200 placeholder:text-zinc-500 w-full font-sans"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}>
                  <Icon icon="ph:x-circle-fill" className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300" />
                </button>
              )}
            </div>
          </div>
          
          <div className="px-4 pb-2 pt-2 text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">Settings</div>
          
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar-v text-[#e8e8e6]">
            {filteredTabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 text-[13px] rounded-lg font-medium text-left transition-colors ${
                    isSelected 
                      ? "bg-[#3f3f3f] text-white" 
                      : "text-zinc-300 hover:bg-[#3f3f3f]/30 hover:text-white"
                  }`}
                >
                  <Icon icon={tab.icon} className="w-[16px] h-[16px]" />
                  {tab.label}
                </button>
              );
            })}
            {filteredTabs.length === 0 && (
              <p className="text-[12px] text-zinc-500 px-3 py-2 text-center">No match found</p>
            )}
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-[#070707] rounded-l-md relative overflow-hidden h-full">
          {/* Close button with NO glows */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-[#3f3f3f] transition-colors z-20"
          >
            <Icon icon="ph:x" className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar-v p-8 md:p-12 pb-24">
            <div className="max-w-[800px] w-full mx-auto space-y-12">
            
            {/* TAB: GENERAL */}
            {activeTab === "general" && (
              <section className="space-y-8 animate-fade-in">
                <h2 className="text-[18px] font-bold text-[#e1e1e0]">Profile</h2>
                
                <div className="space-y-8">
                  {/* Avatar field */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="space-y-1">
                      <span className="text-[13px] font-medium text-[#e1e1e0]">Avatar</span>
                      <p className="text-[11px] text-zinc-400">Upload a custom image to personalize your workspace profile.</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {customAvatar ? (
                        <img 
                          src={customAvatar} 
                          alt="Avatar"
                          className="w-[38px] h-[38px] rounded-full object-cover select-none border border-zinc-600" 
                          referrerPolicy="no-referrer"
                        />
                      ) : currentUser?.photoURL ? (
                        <img 
                          src={currentUser.photoURL} 
                          alt="Avatar"
                          className="w-[38px] h-[38px] rounded-full object-cover select-none border border-zinc-600" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-[38px] h-[38px] rounded-full bg-[#4a4a4a] flex items-center justify-center text-[13px] font-bold text-zinc-100 select-none border border-zinc-600">
                          {fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || "RA"}
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-1 items-center">
                        <label className="px-2.5 py-1 bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] text-[11px] font-medium rounded-md hover:text-white transition-colors cursor-pointer text-center select-none">
                          Upload Custom
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleAvatarUpload} 
                            className="hidden" 
                          />
                        </label>
                        {customAvatar && (
                          <button 
                            onClick={handleRemoveAvatar}
                            className="text-[10px] text-zinc-400 hover:text-rose-400 transition-colors bg-transparent border-none outline-none cursor-pointer text-center"
                          >
                            Reset Custom
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full Name input */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <span className="text-[13px] font-medium text-[#e1e1e0]">Full name</span>
                    <input 
                      type="text" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] w-[400px] focus:outline-none focus:border-[#666663] transition-colors shadow-sm"
                    />
                  </div>

                  {/* Nickname / Call me input */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <span className="text-[13px] font-medium text-[#e1e1e0]">What should Cosmi call you?</span>
                    <input 
                      type="text" 
                      value={callMe}
                      onChange={(e) => setCallMe(e.target.value)}
                      className="bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] w-[400px] focus:outline-none focus:border-[#666663] transition-colors shadow-sm"
                    />
                  </div>

                  {/* Custom dropdown matching application design for Work Type */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <span className="text-[13px] font-medium text-[#e1e1e0]">What best describes your work?</span>
                    <div className="relative">
                      <button 
                        onClick={() => setIsWorkDropdownOpen(!isWorkDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[130px] justify-between cursor-pointer"
                      >
                        <span>{workType}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isWorkDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isWorkDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsWorkDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[160px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Other", "Developer", "Researcher", "Student", "Writer", "Designer"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setWorkType(option);
                                    setIsWorkDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    workType === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {workType === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Explain like I am... option */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <span className="text-[13px] font-medium text-[#e1e1e0]">Explain like I am...</span>
                    <div className="relative">
                      <button 
                        onClick={() => setIsExplainDropdownOpen(!isExplainDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[200px] justify-between cursor-pointer"
                      >
                        <span>{explainStyle}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isExplainDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isExplainDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsExplainDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[220px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Standard", "A 5-year-old (ELI5)", "A High Schooler", "A College Student", "A PhD Peer", "An Industry Expert"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setExplainStyle(option);
                                    setIsExplainDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    explainStyle === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {explainStyle === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Write like I am... option */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <span className="text-[13px] font-medium text-[#e1e1e0]">Write it like I am...</span>
                    <div className="relative">
                      <button 
                        onClick={() => setIsWriteDropdownOpen(!isWriteDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[200px] justify-between cursor-pointer"
                      >
                        <span>{writeStyle}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isWriteDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isWriteDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsWriteDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[220px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Standard", "Academic Author", "Concise Editor", "Novel Writer", "Technical Author", "Casual Blogger"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setWriteStyle(option);
                                    setIsWriteDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    writeStyle === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {writeStyle === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* AI Personality Profile option */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <span className="text-[13px] font-medium text-[#e1e1e0]">Cosmi's Personality Profile</span>
                    <div className="relative">
                      <button 
                        onClick={() => setIsPersonalityDropdownOpen(!isPersonalityDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[200px] justify-between cursor-pointer"
                      >
                        <span>{personality}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isPersonalityDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isPersonalityDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsPersonalityDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[240px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Success Student Mentor", "Rigorous Peer Scholar", "Socratic Guide", "Supportive Coach"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setPersonality(option);
                                    setIsPersonalityDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    personality === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {personality === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Textarea info */}
                  <div className="space-y-4">
                    <span className="text-[13px] font-medium text-[#e1e1e0] block">Instructions for Cosmi</span>
                    <p className="text-[12px] text-zinc-400 leading-[1.5]">
                      Cosmi will keep these in mind across the workspace within <a href="https://genlang.vercel.app/#compliance" target="_blank" rel="noopener noreferrer" className="underline decoration-zinc-500 underline-offset-2 text-zinc-300 hover:text-white transition-colors cursor-pointer">General Language's guidelines.</a> <a href="https://genlang.vercel.app/#terms" target="_blank" rel="noopener noreferrer" className="underline decoration-zinc-500 underline-offset-2 text-zinc-300 hover:text-white transition-colors cursor-pointer">Learn more</a>
                    </p>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="How would you like Cosmi to respond? Add your preferences or custom rules here..."
                      className="w-full bg-[#3a3a3a] border border-[#4a4a4a] rounded-xl p-4 text-[13px] text-[#e1e1e0] focus:outline-none focus:border-[#666663] transition-colors min-h-[160px] resize-none shadow-sm leading-[1.6]"
                    />
                  </div>
                </div>

                {/* Sub-Preferences Section */}
                <div className="space-y-8 pt-6 border-t border-[#3f3f3f]/40">
                  <h3 className="text-[18px] font-bold text-[#e1e1e0]">Preferences</h3>
                  
                  <div className="space-y-8">
                    {/* Appearance theme select */}
                    <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                      <span className="text-[13px] font-medium text-[#e1e1e0]">Appearance</span>
                      <div className="flex items-center bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg p-0.5 shadow-sm">
                        <button 
                          onClick={() => {
                            setAppearanceTheme("system");
                            localStorage.setItem("cosmi_settings_appearance", "system");
                          }}
                          className={`p-1.5 rounded-md transition-colors ${appearanceTheme === "system" ? "bg-[#4f4f4f] text-[#e1e1e0]" : "text-zinc-400 hover:text-[#e1e1e0]"}`}
                        >
                          <Icon icon="ph:desktop" className="w-[16px] h-[16px]" />
                        </button>
                        <button 
                          onClick={() => {
                            setAppearanceTheme("light");
                            localStorage.setItem("cosmi_settings_appearance", "light");
                          }}
                          className={`p-1.5 rounded-md transition-colors ${appearanceTheme === "light" ? "bg-[#4f4f4f] text-[#e1e1e0]" : "text-zinc-400 hover:text-[#e1e1e0]"}`}
                        >
                          <Icon icon="ph:sun" className="w-[16px] h-[16px]" />
                        </button>
                        <button 
                          onClick={() => {
                            setAppearanceTheme("dark");
                            localStorage.setItem("cosmi_settings_appearance", "dark");
                          }}
                          className={`p-1.5 rounded-md transition-colors ${appearanceTheme === "dark" ? "bg-[#4f4f4f] text-[#e1e1e0]" : "text-zinc-400 hover:text-[#e1e1e0]"}`}
                        >
                          <Icon icon="ph:moon" className="w-[16px] h-[16px]" />
                        </button>
                      </div>
                    </div>

                    {/* Chat Editor Font drop-down with matching design */}
                    <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                      <span className="text-[13px] font-medium text-[#e1e1e0]">Chat font</span>
                      <div className="relative">
                        <button 
                          onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                          className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[150px] justify-between cursor-pointer"
                        >
                          <span>{chatFontLabel}</span>
                          <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isFontDropdownOpen ? "rotate-180" : ""}`} />
                        </button>
                        
                        <AnimatePresence>
                          {isFontDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsFontDropdownOpen(false)} />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute right-0 top-full mt-1 w-[180px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                              >
                                {[
                                  { label: "Inter (Sans)", value: "font-sans" },
                                  { label: "JetBrains Mono", value: "font-mono" },
                                  { label: "Plus Jakarta", value: "font-jakarta" }
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => {
                                      setEditorFont(option.value);
                                      setIsFontDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                      editorFont === option.value ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                    }`}
                                  >
                                    <span>{option.label}</span>
                                    {editorFont === option.value && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                  </button>
                                ))}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Font Size adjustments */}
                    <div className="flex items-center justify-between pb-6">
                      <span className="text-[13px] font-medium text-[#e1e1e0]">Font size</span>
                      <div className="flex items-center gap-3">
                        <button 
                          disabled={editorFontSize <= 12}
                          onClick={() => setEditorFontSize(editorFontSize - 1)}
                          className="w-8 h-8 rounded-lg bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] text-[13px] font-bold flex items-center justify-center transition-colors disabled:opacity-50 select-none cursor-pointer"
                        >
                          Aa-
                        </button>
                        <span className="text-[13px] font-medium text-zinc-200 w-12 text-center select-none">{editorFontSize}px</span>
                        <button 
                          disabled={editorFontSize >= 24}
                          onClick={() => setEditorFontSize(editorFontSize + 1)}
                          className="w-8 h-8 rounded-lg bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] text-[13px] font-bold flex items-center justify-center transition-colors disabled:opacity-50 select-none cursor-pointer"
                        >
                          Aa+
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* TAB: ACCOUNT (MADE GENUINE) */}
            {activeTab === "account" && (
              <section className="space-y-8 animate-fade-in text-[#e1e1e0]">
                <div className="space-y-1">
                  <h2 className="text-[18px] font-bold">Genuine Account Workspace Credentials</h2>
                  <p className="text-[12px] text-zinc-400">Manage authentic credentials synchronizing back to the secure Firebase database.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-[#1e1e1e] border border-[#3f3f3f] rounded-xl p-6 space-y-6">
                    <h3 className="text-[13px] font-semibold text-zinc-300 border-b border-[#3f3f3f] pb-3">Identity Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <label className="text-[12px] text-zinc-400 font-medium">Display Name on Cloud Token</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={accountDisplayName}
                            onChange={(e) => setAccountDisplayName(e.target.value)}
                            className="bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-1.5 text-[12px] text-[#e1e1e0] flex-1 focus:outline-none focus:border-[#666663] transition-colors"
                            placeholder="Enter display name"
                          />
                          <button 
                            onClick={handleUpdateCloudDisplayName}
                            disabled={isSavingProfile || !accountDisplayName}
                            className="px-4 py-2 bg-zinc-200 hover:bg-white text-black font-semibold rounded-lg text-[12px] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                          >
                            {isSavingProfile ? (
                              <Icon icon="ph:spinner" className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Icon icon="ph:cloud-arrow-up" className="w-3.5 h-3.5" />
                            )}
                            Save to Cloud
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[12px] text-zinc-400 font-medium block">Verification Index</span>
                        <div className="flex items-center gap-2 mt-2">
                          {currentUser?.emailVerified ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-green-500/10 text-green-300 border border-green-500/20 rounded-full font-medium">
                              <Icon icon="ph:patch-check-fill" className="w-3.5 h-3.5 text-green-400" />
                              Email Verified
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full font-medium">
                                <Icon icon="ph:warning-circle-fill" className="w-3.5 h-3.5 text-amber-300" />
                                Unverified
                              </span>
                              <button 
                                onClick={handleSendVerificationMail}
                                disabled={isSendingVerification}
                                className="text-[11px] text-zinc-300 hover:text-white underline decoration-zinc-500 underline-offset-2 flex items-center gap-1"
                              >
                                {isSendingVerification && <Icon icon="ph:spinner" className="w-3 h-3 animate-spin" />}
                                Send link
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-1">
                        <span className="text-[12px] text-zinc-400 font-medium block">Associated Email Address</span>
                        <span className="text-[13px] font-mono font-medium block bg-[#2a2a2a] p-2 rounded-lg border border-[#3f3f3f] text-zinc-200 mt-1 truncate">
                          {currentUser?.email || "anonymous_workspace@guest.com"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[12px] text-zinc-400 font-medium block">Secure UID Reference</span>
                        <span className="text-[13px] font-mono block bg-[#2a2a2a] p-2 rounded-lg border border-[#3f3f3f] text-zinc-400 mt-1 truncate select-text">
                          {currentUser?.uid || "uid_development_local"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e1e1e] border border-[#3f3f3f] rounded-xl p-6 space-y-4">
                    <h3 className="text-[13px] font-semibold text-zinc-300 border-b border-[#3f3f3f] pb-3">Security & Connections</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs items-center">
                      <div className="space-y-1">
                        <span className="text-zinc-400 font-medium block">Auth Provider</span>
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          {currentUser?.providerData?.[0]?.providerId === "google.com" ? (
                            <>
                              <Icon icon="logos:google-icon" className="w-4 h-4" />Google Accounts
                            </>
                          ) : (
                            <>
                              <Icon icon="ph:envelope" className="w-4 h-4 text-zinc-400" />Password / Email
                            </>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-zinc-400 font-medium block">Creation Date</span>
                        <span className="font-medium text-zinc-300 block">
                          {currentUser?.metadata?.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "Local Instance"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-zinc-400 font-medium block">Last Login Sync</span>
                        <span className="font-medium text-zinc-300 block">
                          {currentUser?.metadata?.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : "Now"}
                        </span>
                      </div>
                    </div>

                    <div className="h-[1px] bg-[#3f3f3f]/40 my-4" />

                    <div className="flex gap-4">
                      {currentUser?.email && (
                        <button 
                          onClick={handleSendResetMail}
                          disabled={isSendingReset}
                          className="px-3.5 py-1.5 bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] transition-colors rounded-lg text-[12px] font-medium text-[#fb7185] cursor-pointer flex items-center gap-1"
                        >
                          {isSendingReset && <Icon icon="ph:spinner" className="w-3 animate-spin text-[#fb7185]" />}
                          Trigger Password Reset Email
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* TAB: PRIVACY */}
            {activeTab === "privacy" && (
              <section className="space-y-8 animate-fade-in">
                <h2 className="text-[18px] font-bold text-[#e1e1e0]">Privacy & Controls</h2>
                
                <div className="space-y-8">
                  {/* Switch 1: training */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Allow training on chat sessions</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Help improve responses by allowing models to analyze conversations patterns anonymously.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setAllowTraining(!allowTraining);
                        localStorage.setItem("cosmi_settings_allow_training", (!allowTraining).toString());
                      }}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${allowTraining ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${allowTraining ? "translate-x-5" : "translate-x-0"}`}>
                        {allowTraining && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Switch 2: save prompts */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Save prompt history</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Enable smart local storage recovery for typed statements even upon refreshing.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setSaveHistory(!saveHistory);
                        localStorage.setItem("cosmi_settings_save_history", (!saveHistory).toString());
                      }}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${saveHistory ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${saveHistory ? "translate-x-5" : "translate-x-0"}`}>
                        {saveHistory && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Clear Data panel */}
                  <div className="bg-[#2a1a1a]/40 border border-[#fb7185]/20 rounded-xl p-6 space-y-4">
                    <div>
                      <h3 className="text-[14px] font-bold text-red-400">Danger Zone: Clear Workspace</h3>
                      <p className="text-[12px] text-zinc-400 mt-1.5 leading-[1.5]">
                        This removes all locally cached workspace files, custom upload annotations, chat templates, and citations. If you are experiencing sync issues, this can reset your application safely.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleClearWorkspace}
                        className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 hover:border-red-700/60 transition-colors text-[#fb7185] text-[13px] font-bold rounded-lg cursor-pointer"
                      >
                        Clear Workspace Cache
                      </button>
                      {clearStatus && (
                        <span className="text-[12px] text-zinc-400 flex items-center gap-1.5">
                          <Icon icon="ph:spinner-gap" className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                          {clearStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* TAB: CAPABILITIES */}
            {activeTab === "capabilities" && (
              <section className="space-y-8 animate-fade-in">
                <h2 className="text-[18px] font-bold text-[#e1e1e0]">Advanced Capabilities</h2>
                
                <div className="space-y-8">
                  {/* Switch 1: search web */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Internet Search Grounding</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Allow research model queries to utilize live Google Search results for grounding citations and statistics.
                      </p>
                    </div>
                    <button 
                      onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${webSearchEnabled ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${webSearchEnabled ? "translate-x-5" : "translate-x-0"}`}>
                        {webSearchEnabled && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Switch 2: LaTeX rendering */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">LaTeX Math & Statistics rendering</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Compile statistical formulas and expressions natively in document formats using KaTeX block math layouts.
                      </p>
                    </div>
                    <button 
                      onClick={() => setLatexEnabled(!latexEnabled)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${latexEnabled ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${latexEnabled ? "translate-x-5" : "translate-x-0"}`}>
                        {latexEnabled && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Switch 3: auto draft */}
                  <div className="flex items-center justify-between pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Automatic Draft and Local Synchronization</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Instantly sync document content and highlighted workspace annotations every 3 seconds to avoid layout loss.
                      </p>
                    </div>
                    <button 
                      onClick={() => setAutoDraftEnabled(!autoDraftEnabled)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${autoDraftEnabled ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${autoDraftEnabled ? "translate-x-5" : "translate-x-0"}`}>
                        {autoDraftEnabled && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* TAB: CONNECTORS */}
            {activeTab === "connectors" && (
              <section className="space-y-8 animate-fade-in">
                <h2 className="text-[18px] font-bold text-[#e1e1e0]">Resource Connectors</h2>
                
                <div className="space-y-4">
                  {/* Connector 1 */}
                  <div className="flex items-center justify-between p-4 bg-[#1e1e1e] border border-[#3f3f3f] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon icon="logos:google-drive" className="w-7 h-7" />
                      <div>
                        <p className="text-[13px] font-medium text-white">Google Drive Workspace Plugin</p>
                        <p className="text-[12px] text-zinc-400 mt-0.5">Directly pull thesis PDFs and spreadsheet uploads</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 bg-green-500/10 text-green-300 border border-green-500/20 rounded select-none flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Connected
                      </span>
                      <button 
                        onClick={() => setDriveConnected(!driveConnected)}
                        className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white rounded hover:bg-[#2a2a2a] transition-all cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  {/* Connector 2 */}
                  <div className="flex items-center justify-between p-4 bg-[#1e1e1e] border border-[#3f3f3f] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon icon="mdi:github" className="w-7 h-7 text-white" />
                      <div>
                        <p className="text-[13px] font-medium text-white">GitHub Academic Codebase</p>
                        <p className="text-[12px] text-zinc-400 mt-0.5">Synchronize technical statistical formulas and reference structures</p>
                      </div>
                    </div>
                    <div>
                      {githubConnected ? (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-green-500/10 text-green-300 border border-green-500/20 rounded select-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Connected
                          </span>
                          <button 
                            onClick={() => setGithubConnected(false)}
                            className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white rounded hover:bg-[#2a2a2a] transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setGithubConnected(true)}
                          className="px-3 py-1.5 bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] transition-all text-zinc-200 text-[11px] font-medium rounded-lg cursor-pointer"
                        >
                          Connect GitHub
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connector 3 */}
                  <div className="flex items-center justify-between p-4 bg-[#1e1e1e] border border-[#3f3f3f] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon icon="logos:slack-icon" className="w-7 h-7" />
                      <div>
                        <p className="text-[13px] font-medium text-white">Slack Co-Work Bridge</p>
                        <p className="text-[12px] text-zinc-400 mt-0.5">Post analytical graphs and custom citations to Slack streams</p>
                      </div>
                    </div>
                    <div>
                      {slackConnected ? (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-green-500/10 text-green-300 border border-green-500/20 rounded select-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Connected
                          </span>
                          <button 
                            onClick={() => setSlackConnected(false)}
                            className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white rounded hover:bg-[#2a2a2a] transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setSlackConnected(true)}
                          className="px-3 py-1.5 bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] transition-all text-zinc-200 text-[11px] font-medium rounded-lg cursor-pointer"
                        >
                          Connect Slack
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connector 4 */}
                  <div className="flex items-center justify-between p-4 bg-[#1e1e1e] border border-[#3f3f3f] rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon icon="simple-icons:notion" className="w-7 h-7 text-white" />
                      <div>
                        <p className="text-[13px] font-medium text-white">Notion Database Link</p>
                        <p className="text-[12px] text-zinc-400 mt-0.5">Synchronize bibliographic databases inside Notion workspaces</p>
                      </div>
                    </div>
                    <div>
                      {notionConnected ? (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-green-500/10 text-green-300 border border-green-500/20 rounded select-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Connected
                          </span>
                          <button 
                            onClick={() => setNotionConnected(false)}
                            className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white rounded hover:bg-[#2a2a2a] transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setNotionConnected(true)}
                          className="px-3 py-1.5 bg-[#3a3a3a] border border-[#4a4a4a] hover:bg-[#4f4f4f] transition-all text-zinc-200 text-[11px] font-medium rounded-lg cursor-pointer"
                        >
                          Connect Notion
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* TAB: DESKTOP SETTINGS (REPLACES COSMI CODE & BILLING) */}
            {activeTab === "desktop" && (
              <section className="space-y-8 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-[18px] font-bold text-[#e1e1e0]">Desktop client settings</h2>
                  <p className="text-[12px] text-zinc-400">Configure visual themes, native hardware integrations, performance configurations, and system directories.</p>
                </div>

                <div className="space-y-8">
                  {/* Toggle 1: Start on Login */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Start application on system log-in</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Automatically boot and index workspace files in the background during operating system startup.
                      </p>
                    </div>
                    <button 
                      onClick={() => setStartOnLogin(!startOnLogin)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${startOnLogin ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${startOnLogin ? "translate-x-5" : "translate-x-0"}`}>
                        {startOnLogin && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Toggle 2: keyboard shortcuts */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Global audio-recording keyboard shortcut</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Enable <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] font-mono select-none">Ctrl + Alt + S</kbd> to initiate chat recording from anywhere on the desktop.
                      </p>
                    </div>
                    <button 
                      onClick={() => setEnableShortcuts(!enableShortcuts)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${enableShortcuts ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${enableShortcuts ? "translate-x-5" : "translate-x-0"}`}>
                        {enableShortcuts && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Toggle 3: minimize to tray */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Minimize to system tray on window close</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Ensure the application stays operational in the tray menu when clicking the window cross emblem.
                      </p>
                    </div>
                    <button 
                      onClick={() => setMinimizeToTray(!minimizeToTray)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${minimizeToTray ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${minimizeToTray ? "translate-x-5" : "translate-x-0"}`}>
                        {minimizeToTray && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Toggle 4: gpu acceleration */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6">
                    <div className="max-w-[480px]">
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Hardware GPU Acceleration</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Enable hardware-accelerated rendering inside Canvas viewports for fluid multi-column animations.
                      </p>
                    </div>
                    <button 
                      onClick={() => setGpuAcceleration(!gpuAcceleration)}
                      className={`w-11 h-6 transition-colors duration-200 rounded-full p-0.5 outline-none flex items-center cursor-pointer ${gpuAcceleration ? "bg-[#a1a1aa]" : "bg-zinc-700"}`}
                    >
                      <div className={`w-5 h-5 bg-black rounded-full transition-transform duration-200 flex items-center justify-center ${gpuAcceleration ? "translate-x-5" : "translate-x-0"}`}>
                        {gpuAcceleration && <Icon icon="ph:check" className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Dropdown 1: PDF Extractor Engine */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <div>
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Standard PDF Extraction Engine</p>
                      <p className="text-[12px] text-zinc-400 mt-0.5">Select compilation library for processing scanned textbook uploads</p>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setIsPdfDropdownOpen(!isPdfDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[180px] justify-between cursor-pointer"
                      >
                        <span>{pdfEngine}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isPdfDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isPdfDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsPdfDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[200px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Standard PDFJS", "Native High-Fidelity", "Fast Text Extractor"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setPdfEngine(option);
                                    setIsPdfDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    pdfEngine === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {pdfEngine === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Dropdown 2: Download destination */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <div>
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Save download files to</p>
                      <p className="text-[12px] text-zinc-400 mt-0.5">Primary folder target directory for exported citations</p>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[180px] justify-between cursor-pointer"
                      >
                        <span>{downloadDestination}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isDestDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isDestDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDestDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[210px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Downloads Folder", "Workspace Documents", "Desktop Path", "Ask inside Browser"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setDownloadDestination(option);
                                    setIsDestDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    downloadDestination === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {downloadDestination === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Dropdown 3: Window theme */}
                  <div className="flex items-center justify-between border-b border-[#3f3f3f]/60 pb-6 relative">
                    <div>
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Desktop Window Presentation</p>
                      <p className="text-[12px] text-zinc-400 mt-0.5">Customize operating system window borders styling</p>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setIsWinDropdownOpen(!isWinDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[180px] justify-between cursor-pointer"
                      >
                        <span>{windowTheme}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isWinDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isWinDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsWinDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[190px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {["Classic Border", "Frameless Modern", "Compact Mini"].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setWindowTheme(option);
                                    setIsWinDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-lg text-left transition-colors cursor-pointer ${
                                    windowTheme === option ? "bg-[#27272a] text-white font-medium" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <span>{option}</span>
                                  {windowTheme === option && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Dropdown 4: Storage Persistence Mode */}
                  <div className="flex items-center justify-between pb-6 relative">
                    <div>
                      <p className="text-[13px] font-medium text-[#e1e1e0]">Storage Persistence Mode</p>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-[1.4]">
                        Configure where your researcher library and workspace states are saved. Default is <span className="font-mono text-[11px] text-[#e1e1e0] bg-zinc-800 px-1 py-0.5 rounded">Local</span> for fast reads.
                      </p>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setIsStorageModeDropdownOpen(!isStorageModeDropdownOpen)}
                        className="flex items-center gap-2 bg-[#3a3a3a] border border-[#4a4a4a] rounded-lg px-3 py-2 text-[13px] text-[#e1e1e0] focus:outline-none hover:border-[#666663] transition-colors shadow-sm min-w-[210px] justify-between cursor-pointer"
                      >
                        <span>{localStorageMode === "local" ? "Local (Fast Reads)" : "Database (Cloud Sync)"}</span>
                        <Icon icon="ph:caret-down" className={`w-3.5 h-3.5 transition-transform duration-200 ${isStorageModeDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      <AnimatePresence>
                        {isStorageModeDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsStorageModeDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 w-[220px] bg-[#1a1a1a] border border-[#2d2d30] rounded-xl z-50 p-1.5 flex flex-col gap-0.5 shadow-xl"
                            >
                              {[
                                { value: "local", label: "Local (Fast Reads)", description: "Instant local disk reads/writes" },
                                { value: "database", label: "Database (Cloud Sync)", description: "Realtime Firebase backing model" }
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => {
                                    setLocalStorageMode(option.value as "local" | "database");
                                    setIsStorageModeDropdownOpen(false);
                                  }}
                                  className={`w-full flex flex-col items-start px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                    localStorageMode === option.value ? "bg-[#27272a] text-white" : "text-zinc-300 hover:text-white hover:bg-[#222222]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span className="text-[13px] font-medium">{option.label}</span>
                                    {localStorageMode === option.value && <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-100" />}
                                  </div>
                                  <span className="text-[10px] text-zinc-500 mt-0.5 leading-none">{option.description}</span>
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </section>
            )}

            </div> {/* max-w-[700px] */}

            {/* NON-STICKY BOTTOM FOOTER BAR */}
            <div className={`mt-8 pt-6 flex items-center justify-end select-none ${(activeTab === "capabilities" || activeTab === "desktop") ? "" : "border-t border-[#27272a]"}`}>
              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveAllChanges}
                  disabled={isSavingAll}
                  className="px-5 py-2 bg-zinc-200 hover:bg-white text-black font-bold rounded-lg text-[13px] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingAll ? (
                    <>
                      <Icon icon="ph:spinner" className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon icon="ph:floppy-disk" className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>

          </div> {/* scroll container */}
        </div>
      </motion.div>
    </motion.div>
  );
};
