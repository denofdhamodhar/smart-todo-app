import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateTodo, deleteTodo, addResource, deleteResource, parseTaskTitle } from '../store/slices/todoSlice';
import { Check, Link as LinkIcon, ChevronDown, ChevronUp, Trash2, Edit2, Plus, X, GripVertical, CornerUpRight, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const priorityConfig = {
  'High': { icon: '⭐', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  'Medium': { icon: '⌛', color: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
  'Low': { icon: '💚', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' }
};

const getBadgeText = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `from ${monthNames[month]} ${day}`;
    }
  } catch (e) {
    // fallback
  }
  return `from ${dateStr}`;
};

export default function TaskCard({ task, disabled }) {
  const dispatch = useDispatch();
  const { cleanTitle, fromOriginalDate } = parseTaskTitle(task.title);

  const [showResources, setShowResources] = useState(task.resources?.length > 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(cleanTitle);
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [showAddResource, setShowAddResource] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(task.note || '');

  const toggleComplete = () => {
    if (disabled) return;
    dispatch(updateTodo({ id: task.id, updates: { completed: !task.completed } }));
  };

  const handleToggleEdit = () => {
    if (disabled) return;
    if (!isEditing) {
      setEditTitle(cleanTitle);
    }
    setIsEditing(!isEditing);
  };

  const handleUpdate = () => {
    if (disabled) return;
    if (editTitle.trim() && editTitle !== cleanTitle) {
      const updatedTitle = fromOriginalDate 
        ? `${editTitle.trim()} [from:${fromOriginalDate}]` 
        : editTitle.trim();
      dispatch(updateTodo({ id: task.id, updates: { title: updatedTitle } }));
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (disabled) return;
    dispatch(deleteTodo(task.id));
  };

  const handleAddResource = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (newResourceUrl.trim()) {
      dispatch(addResource({ taskId: task.id, url: newResourceUrl.trim() }));
      setNewResourceUrl('');
      setShowAddResource(false);
      setShowResources(true);
    }
  };

  const handleRemoveResource = (resourceId) => {
    if (disabled) return;
    dispatch(deleteResource(resourceId));
  };

  const handleToggleEditNote = () => {
    if (disabled) return;
    if (!isEditingNote) {
      setNoteText(task.note || '');
    }
    setIsEditingNote(!isEditingNote);
  };

  const handleSaveNote = () => {
    if (disabled) return;
    dispatch(updateTodo({ id: task.id, updates: { note: noteText.trim() || null } }));
    setIsEditingNote(false);
  };

  const handleDeleteNote = () => {
    if (disabled) return;
    if (window.confirm("Are you sure you want to delete this note?")) {
      dispatch(updateTodo({ id: task.id, updates: { note: null } }));
      setNoteText('');
      setIsEditingNote(false);
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`group bg-white dark:bg-[#232326] rounded-2xl p-4 shadow-sm border transition-all ${
        task.completed 
          ? 'bg-[#E2E8F0]/30 dark:bg-[#1c1c1f]/80 border-transparent opacity-70' 
          : `border-gray-100 dark:border-zinc-800 hover:shadow-md dark:hover:border-zinc-700 ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {!task.completed && !disabled && (
          <div className="mt-1 flex-shrink-0 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <button 
          onClick={toggleComplete}
          disabled={disabled}
          className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border transition-colors flex items-center justify-center
            ${task.completed ? 'bg-[#5B5FEF] border-[#5B5FEF]' : 'border-gray-300 dark:border-gray-600 hover:border-[#5B5FEF] dark:hover:border-indigo-400'}
            ${disabled ? 'cursor-default opacity-85' : ''}
          `}
        >
          {task.completed && <Check className="w-4 h-4 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleUpdate}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              className="w-full font-medium text-gray-900 dark:text-gray-100 border-b border-[#5B5FEF] focus:outline-none bg-transparent"
            />
          ) : (
            <h3 className={`font-medium text-[15px] truncate transition-all duration-200 ${task.completed ? 'text-gray-400 dark:text-gray-600 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
              {cleanTitle}
            </h3>
          )}

          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              {disabled ? (
                <div className={`h-6 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityConfig[task.priority].bg} ${priorityConfig[task.priority].color}`}>
                  <span>{priorityConfig[task.priority].icon}</span>
                  <span>{task.priority}</span>
                </div>
              ) : (
                <Select 
                  value={task.priority} 
                  onValueChange={(val) => dispatch(updateTodo({ id: task.id, updates: { priority: val } }))}
                >
                  <SelectTrigger className={`h-6 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border-none shadow-none focus:ring-0 ${priorityConfig[task.priority].bg} ${priorityConfig[task.priority].color} w-auto min-w-[70px] focus:ring-offset-0 [&>svg]:w-3 [&>svg]:h-3`}>
                    <SelectValue>
                      <div className="flex items-center gap-1">
                        <span>{priorityConfig[task.priority].icon}</span>
                        <span>{task.priority}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(priorityConfig).map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{priorityConfig[p].icon}</span>
                          <span>{p}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {task.resources?.length > 0 && (
                <button 
                  onClick={() => setShowResources(!showResources)}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>{task.resources.length}</span>
                  {showResources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              {fromOriginalDate && (
                <div className="h-6 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-orange-400/90 dark:bg-violet-600 text-white border border-zinc-200/50 dark:border-zinc-700/50 select-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                  </svg>
                  <span>{getBadgeText(fromOriginalDate)}</span>
                </div>
              )}
            </div>

            {!disabled && (
              <div className="flex items-center opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                <button onClick={() => setShowAddResource(true)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#5B5FEF] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg" title="Add Link">
                  <LinkIcon className="w-4 h-4" />
                </button>
                <button onClick={handleToggleEditNote} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#e4a834] dark:hover:text-[#ffd60a] hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg" title="Add/Edit Note">
                  <FileText className="w-4 h-4" />
                </button>
                <button onClick={handleToggleEdit} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-[#5B5FEF] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg" title="Edit Task">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={handleDelete} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete Task">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(showResources || showAddResource) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3 pl-9"
          >
            <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl space-y-2 border border-gray-100 dark:border-zinc-700/50">
              {task.resources?.map(resource => (
                <div key={resource.id} className="flex items-center justify-between group/res">
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-indigo-400 hover:underline truncate flex-1">
                    {resource.url}
                  </a>
                  {!disabled && (
                    <button onClick={() => handleRemoveResource(resource.id)} className="opacity-0 group-hover/res:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {!disabled && (
                showAddResource ? (
                  <form onSubmit={handleAddResource} className="flex items-center gap-2 mt-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={newResourceUrl}
                      onChange={(e) => setNewResourceUrl(e.target.value)}
                      className="flex-1 text-sm px-2 py-1 border border-gray-200 dark:border-white/10 rounded focus:outline-none focus:border-[#5B5FEF] bg-white dark:bg-white/8 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                      autoFocus
                    />
                    <button type="submit" className="text-xs bg-[#5B5FEF] text-white px-2 py-1 rounded hover:bg-indigo-600">Add</button>
                    <button type="button" onClick={() => setShowAddResource(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
                  </form>
                ) : (
                  <button onClick={() => setShowAddResource(true)} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-[#5B5FEF] dark:hover:text-indigo-400 mt-1">
                    <Plus className="w-3 h-3" /> Add Link
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note Section */}
      {(task.note || !disabled || isEditingNote) && (
        <div className="mt-3 pl-9 border-t border-dashed border-slate-200 dark:border-zinc-700/80 pt-3">
          {(task.note || isEditingNote) && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2.5 select-none">
              <FileText className="w-3.5 h-3.5 text-amber-400 dark:text-purple-400" />
              <span className='text-amber-400 dark:text-purple-400'>Note:</span>
              {isEditingNote && <span className="text-[10px] text-amber-600 dark:text-yellow-500 font-normal">(Editing)</span>}
            </div>
          )}
          {isEditingNote ? (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full text-sm p-3 border border-gray-200 dark:border-zinc-700/60 rounded-xl focus:outline-none focus:border-[#e4a834] dark:focus:border-[#ffd60a] focus:ring-1 focus:ring-[#e4a834] dark:focus:ring-[#ffd60a] bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-600"
                placeholder="Write your notes here... (unlimited characters)"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={handleSaveNote} 
                  className="text-xs bg-[#e4a834] hover:bg-[#d59929] active:bg-[#c68b1f] text-white px-3 py-1.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                  Save Note
                </button>
                <button 
                  onClick={() => { setIsEditingNote(false); setNoteText(task.note || ''); }} 
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2.5 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {task.note ? (
                <div className="group/note bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-200/30 dark:border-zinc-700/60 rounded-xl p-3 relative">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-[#fde047] leading-relaxed whitespace-pre-wrap pr-14">
                    {task.note}
                  </p>
                  
                  {!disabled && (
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1 opacity-100 lg:opacity-0 group-hover/note:opacity-100 transition-opacity">
                      <button 
                        onClick={handleToggleEditNote}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-[#e4a834] dark:hover:text-[#ffd60a] hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-all border border-transparent hover:border-gray-100 dark:hover:border-zinc-700" 
                        title="Edit Note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={handleDeleteNote}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-all border border-transparent hover:border-gray-100 dark:hover:border-zinc-700" 
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                !disabled && (
                  <button 
                    onClick={handleToggleEditNote} 
                    className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-[#e4a834] dark:hover:text-[#ffd60a] transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Note</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
