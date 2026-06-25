import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { User, Buildings, MapPoint, MagicStick3 } from '@solar-icons/react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { showToast } from './Toast';
import { getUserFriendlyErrorMessage } from '../lib/error-utils';

const philippineUniversities = [
  "University of the Philippines Diliman",
  "University of the Philippines Manila",
  "University of the Philippines Los Baños",
  "University of the Philippines Visayas",
  "University of the Philippines Mindanao",
  "Ateneo de Manila University",
  "De La Salle University",
  "University of Santo Tomas",
  "Polytechnic University of the Philippines",
  "Mapúa University",
  "Far Eastern University",
  "University of the East",
  "Adamson University",
  "San Beda University",
  "Centro Escolar University",
  "Miriam College",
  "Silliman University",
  "University of San Carlos",
  "Mindanao State University",
  "Ateneo de Davao University",
  "Xavier University – Ateneo de Cagayan",
  "Saint Louis University",
  "Technological Institute of the Philippines",
  "University of Southeastern Philippines",
  "Pamantasan ng Lungsod ng Maynila",
  "Cebu Institute of Technology – University",
  "Batangas State University",
  "Holy Angel University",
  "Central Luzon State University",
  "Benguet State University",
  "Lyceum of the Philippines University",
  "National University (NU)",
  "University of the Cordilleras",
  "Western Mindanao State University",
  "Bicol University",
  "Central Philippine University",
  "Cebu Technological University",
  "University of Cebu",
  "Camarines Sur Polytechnic Colleges",
  "Proverbs Ville Academy Foundation Incorporated",
  "Other Philippine University"
];

interface OnboardingScreenProps {
  user: any;
  onComplete: (firstPrompt: string) => void;
}

export function OnboardingScreen({ user, onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.displayName || '');
  const [institution, setInstitution] = useState('');
  const [heardFrom, setHeardFrom] = useState('');
  const [firstPrompt, setFirstPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [instType, setInstType] = useState<'university' | 'company' | 'organization' | 'others' | ''>('');
  const [customInstName, setCustomInstName] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [customSchool, setCustomSchool] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  const [insightIndex, setInsightIndex] = useState(0);
  const insights = [
    {
      title: "Simplify complex literature reviews.",
      description: "Map, sort, and understand complex papers within seconds with advanced citation matching and summaries."
    },
    {
      title: "Unlock hidden insights inside any file.",
      description: "Perform precise searches, verify claims, and extract structured data instantly using natural language conversation."
    },
    {
      title: "Structure notes and ideas seamlessly.",
      description: "Turn raw highlights, files, and transcript insights into beautifully formatted, publication-ready research notes."
    },
    {
      title: "Stay organized across multiple topics.",
      description: "Group related papers, notes, and conversations into tailored workspaces without losing track of your key findings."
    },
    {
      title: "Draft comprehensive summaries.",
      description: "Automatically compile your analyzed documents into well-structured drafts, ready for review and editing."
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setInsightIndex((prev) => (prev + 1) % insights.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (instType === 'university') {
      if (selectedSchool === 'Other Philippine University') {
        setInstitution(customSchool);
      } else {
        setInstitution(selectedSchool);
      }
    } else if (instType === 'company' || instType === 'organization' || instType === 'others') {
      setInstitution(customInstName);
    } else {
      setInstitution('');
    }
  }, [instType, selectedSchool, customSchool, customInstName]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBackStep2 = () => {
    setStep(1);
  };

  const handleComplete = async () => {
    if (!firstPrompt.trim()) return;
    setIsSubmitting(true);
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: name,
          institution,
          heardFrom,
          onboardingComplete: true,
        });
        localStorage.setItem(`cosmi_settings_full_name_${user.uid}`, name);
        localStorage.setItem(`cosmi_settings_full_name`, name);
        localStorage.setItem(`cosmi_settings_work_desc`, institution);
      }
      onComplete(firstPrompt);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      showToast(getUserFriendlyErrorMessage(error), 'error');
      setIsSubmitting(false);
    }
  };

  const filteredSchools = philippineUniversities.filter((school) =>
    school.toLowerCase().includes(schoolSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-[#09090b] z-[10000] flex text-[#f4f4f5] font-sans overflow-hidden">
      {/* Left Column - Branding & Insights (Hidden on small screens) */}
      <div className="hidden md:flex md:w-[42%] bg-[#030303] border-r border-[#18181b] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Image: Onboarding.jpg dimmed */}
        <img
          src="Onboarding.jpg"
          alt="Onboarding Background"
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none z-0"
          referrerPolicy="no-referrer"
        />
        
        {/* Subtle sharp grid lines without any glow/neon effects */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <span className="text-4xl font-bold tracking-tight text-white font-jakarta lowercase">
              cosmi
            </span>
            <img
              src="/cosmi.png"
              alt="Cosmi"
              className="w-12 h-12 select-none grayscale invert object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={insightIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <h1 className="text-3xl font-light leading-snug text-white tracking-tight">
                {insights[insightIndex].title}
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {insights[insightIndex].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right Column - Onboarding Step Form */}
      <div className="w-full md:w-[58%] bg-[#09090b] flex flex-col justify-center items-center p-8 md:p-16 relative">
        <div className="w-full max-w-md relative z-10">
          
          {/* Mobile branding header */}
          <div className="md:hidden flex items-center justify-center gap-2.5 mb-8">
            <span className="text-3xl font-bold tracking-tight text-white font-jakarta lowercase">
              cosmi
            </span>
            <img
              src="/cosmi.png"
              alt="Cosmi"
              className="w-7 h-7 select-none grayscale invert object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="w-full">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="flex items-center justify-center text-zinc-350">
                      <User size={32} color="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">What should we call you?</h3>
                      <p className="text-xs text-zinc-400">Let's personalize your research workspace.</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors mb-6 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) handleNext();
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleNext}
                      disabled={!name.trim()}
                      className="bg-white text-black font-semibold px-8 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="flex items-center justify-center text-zinc-350">
                      <Buildings size={32} color="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">What is your institution?</h3>
                      <p className="text-xs text-zinc-400">Select your workspace affiliation to help us personalize your experience.</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setInstType('university');
                        setCustomInstName('');
                      }}
                      className={`w-full p-3 px-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                        instType === 'university'
                          ? 'bg-[#18181b] border-zinc-600 text-white'
                          : 'bg-[#0e0e11] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        instType === 'university' ? 'border-white' : 'border-zinc-700'
                      }`}>
                        {instType === 'university' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs tracking-wide uppercase text-zinc-300">University</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">Schools & Academic research</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInstType('company');
                        setSelectedSchool('');
                        setCustomSchool('');
                      }}
                      className={`w-full p-3 px-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                        instType === 'company'
                          ? 'bg-[#18181b] border-zinc-600 text-white'
                          : 'bg-[#0e0e11] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        instType === 'company' ? 'border-white' : 'border-zinc-700'
                      }`}>
                        {instType === 'company' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs tracking-wide uppercase text-zinc-300">Company</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">Businesses & Industry groups</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInstType('organization');
                        setSelectedSchool('');
                        setCustomSchool('');
                      }}
                      className={`w-full p-3 px-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                        instType === 'organization'
                          ? 'bg-[#18181b] border-zinc-600 text-white'
                          : 'bg-[#0e0e11] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        instType === 'organization' ? 'border-white' : 'border-zinc-700'
                      }`}>
                        {instType === 'organization' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs tracking-wide uppercase text-zinc-300">Organization</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">Non-profits & Labs</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInstType('others');
                        setSelectedSchool('');
                        setCustomSchool('');
                      }}
                      className={`w-full p-3 px-4 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                        instType === 'others'
                          ? 'bg-[#18181b] border-zinc-600 text-white'
                          : 'bg-[#0e0e11] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        instType === 'others' ? 'border-white' : 'border-zinc-700'
                      }`}>
                        {instType === 'others' && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs tracking-wide uppercase text-zinc-300">Others</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">Personal or Custom setup</div>
                      </div>
                    </button>
                  </div>

                  {instType !== '' && (
                    <div className="pt-4 border-t border-zinc-900 mb-6">
                      {instType === 'university' && (
                        <div className="space-y-3">
                          <label className="text-xs text-zinc-400 block font-medium">Select your University in the Philippines</label>
                          <input
                            type="text"
                            value={schoolSearchQuery}
                            onChange={(e) => setSchoolSearchQuery(e.target.value)}
                            placeholder="Search university name..."
                            className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors text-sm"
                            autoFocus
                          />
                          
                          <div className="max-h-[160px] overflow-y-auto bg-[#131315] border border-zinc-800 rounded-xl p-1 divide-y divide-zinc-900">
                            {filteredSchools.length > 0 ? (
                              filteredSchools.map((school) => (
                                <button
                                  key={school}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSchool(school);
                                    if (school !== 'Other Philippine University') {
                                      setCustomSchool('');
                                    }
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                                    selectedSchool === school
                                      ? 'bg-zinc-800 text-white font-medium'
                                      : 'text-zinc-400 hover:bg-[#1c1c1f] hover:text-white'
                                  }`}
                                >
                                  <span>{school}</span>
                                  {selectedSchool === school && <span className="text-xs text-zinc-400">✓</span>}
                                </button>
                              ))
                            ) : (
                              <div className="text-zinc-500 text-xs px-3 py-3 text-center">No matching schools found</div>
                            )}
                          </div>

                          {selectedSchool === 'Other Philippine University' && (
                            <div className="mt-3">
                              <label className="text-xs text-zinc-400 block mb-1.5 font-medium">Specify your University name</label>
                              <input
                                type="text"
                                value={customSchool}
                                onChange={(e) => setCustomSchool(e.target.value)}
                                placeholder="Enter Philippine University name"
                                className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors text-sm"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {(instType === 'company' || instType === 'organization' || instType === 'others') && (
                        <div className="space-y-3">
                          <label className="text-xs text-zinc-400 block font-medium">
                            {instType === 'company' && 'Enter Company Name'}
                            {instType === 'organization' && 'Enter Organization Name'}
                            {instType === 'others' && 'Specify Institution / Workplace'}
                          </label>
                          <input
                            type="text"
                            value={customInstName}
                            onChange={(e) => setCustomInstName(e.target.value)}
                            placeholder={
                              instType === 'company' ? 'e.g., Google, Inc.' :
                              instType === 'organization' ? 'e.g., Research Lab' :
                              'e.g., Independent Researcher'
                            }
                            className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customInstName.trim()) handleNext();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleBackStep2}
                      className="bg-[#18181b] text-white font-semibold px-8 py-2.5 rounded-full hover:bg-zinc-800 transition-colors border border-zinc-800 text-sm cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={!institution.trim()}
                      className="bg-white text-black font-semibold px-8 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="flex items-center justify-center text-zinc-350">
                      <MapPoint size={32} color="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">How did you hear about us?</h3>
                      <p className="text-xs text-zinc-400">Tell us where you first discovered Cosmi.</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={heardFrom}
                    onChange={(e) => setHeardFrom(e.target.value)}
                    placeholder="Twitter, Search, Friend, Colleague, etc."
                    className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors mb-6 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && heardFrom.trim()) handleNext();
                    }}
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="bg-[#18181b] text-white font-semibold px-8 py-2.5 rounded-full hover:bg-zinc-800 transition-colors border border-zinc-800 text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={!heardFrom.trim()}
                      className="bg-white text-black font-semibold px-8 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="flex items-center justify-center text-white">
                      <MagicStick3 size={32} color="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">Let's start your research</h3>
                      <p className="text-xs text-zinc-400">Ask your very first query to begin.</p>
                    </div>
                  </div>
                  <textarea
                    value={firstPrompt}
                    onChange={(e) => setFirstPrompt(e.target.value)}
                    placeholder="What would you like to explore first? (e.g., 'Draft a literature synthesis on synthetic biology')"
                    className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors mb-6 resize-none min-h-[110px] text-sm leading-relaxed"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && firstPrompt.trim()) {
                        e.preventDefault();
                        handleComplete();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setStep(3)}
                      disabled={isSubmitting}
                      className="bg-[#18181b] text-white font-semibold px-8 py-2.5 rounded-full hover:bg-zinc-800 transition-colors border border-zinc-800 text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={!firstPrompt.trim() || isSubmitting}
                      className="bg-white text-black font-semibold px-8 py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isSubmitting ? 'Starting...' : 'Start Research'} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}
