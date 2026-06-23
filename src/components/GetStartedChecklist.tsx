import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';

export const GetStartedChecklist: React.FC = () => {
  const [tasks, setTasks] = useState({
    uploadFile: false,
    chatFile: false,
    createNote: false,
    searchPapers: false,
    folderChat: false,
    citationNote: false,
  });

  useEffect(() => {
    const loadTasks = () => {
      setTasks({
        uploadFile: localStorage.getItem('onboarding_upload_file') === 'true',
        chatFile: localStorage.getItem('onboarding_chat_with_file') === 'true',
        createNote: localStorage.getItem('onboarding_create_note') === 'true',
        searchPapers: localStorage.getItem('onboarding_search_papers') === 'true',
        folderChat: localStorage.getItem('onboarding_folder_chat') === 'true',
        citationNote: localStorage.getItem('onboarding_citation_note') === 'true',
      });
    };

    loadTasks();
    
    // Polling every 1s for the tasks
    const interval = setInterval(loadTasks, 1000); 
    return () => clearInterval(interval);
  }, []);

  const tasksList = [
    { id: 'chatFile', label: 'Chat with a file' },
    { id: 'folderChat', label: 'Add files to a folder and chat with them' },
    { id: 'createNote', label: 'Create a new note' },
    { id: 'searchPapers', label: 'Search for papers with agent' },
    { id: 'uploadFile', label: 'Upload a file' },
    { id: 'citationNote', label: 'Search for a citation in a note' },
  ];

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-[28px] p-6 mb-10 w-full">
      <h2 className="text-[#a1a1aa] text-sm font-medium mb-4">Get started</h2>
      <div className="space-y-4">
        {tasksList.map((task) => {
          const isDone = tasks[task.id as keyof typeof tasks];
          return (
            <div key={task.id} className="flex items-center gap-3">
              <div 
                className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                  isDone 
                    ? 'bg-blue-600 border-blue-600' 
                    : 'border-zinc-500 bg-transparent'
                }`}
              >
                {isDone && <Icon icon="ph:check-bold" className="text-white w-3 h-3" />}
              </div>
              <span className={`text-[15px] ${isDone ? 'text-zinc-300 line-through' : 'text-zinc-100 font-medium'}`}>
                {task.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
