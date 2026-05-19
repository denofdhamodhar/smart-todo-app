import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateTodo, deleteTodo, addResource, deleteResource } from '../store/slices/todoSlice';
import { format } from 'date-fns';
import { Check, Link as LinkIcon, ChevronDown, ChevronUp, Trash2, Edit2, Plus, X, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const priorityConfig = {
  'High': { icon: '⭐', color: 'text-orange-500', bg: 'bg-orange-50' },
  'Medium': { icon: '⌛', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  'Low': { icon: '💚', color: 'text-green-500', bg: 'bg-green-50' }
};

export default function TaskCard({ task }) {
  const dispatch = useDispatch();
  const [showResources, setShowResources] = useState(task.resources?.length > 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [showAddResource, setShowAddResource] = useState(false);

  const toggleComplete = () => {
    dispatch(updateTodo({ id: task.id, updates: { completed: !task.completed } }));
  };

  const handleUpdate = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      dispatch(updateTodo({ id: task.id, updates: { title: editTitle.trim() } }));
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    dispatch(deleteTodo(task.id));
  };

  const handleAddResource = (e) => {
    e.preventDefault();
    if (newResourceUrl.trim()) {
      dispatch(addResource({ taskId: task.id, url: newResourceUrl.trim() }));
      setNewResourceUrl('');
      setShowAddResource(false);
      setShowResources(true);
    }
  };

  const handleRemoveResource = (resourceId) => {
    dispatch(deleteResource(resourceId));
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`group bg-white rounded-2xl p-4 shadow-sm border border-gray-100 transition-all ${task.completed ? 'bg-[#E2E8F0]/30 border-transparent' : 'hover:shadow-md cursor-grab active:cursor-grabbing'}`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {!task.completed && (
          <div className="mt-1 flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <button 
          onClick={toggleComplete}
          className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border transition-colors flex items-center justify-center
            ${task.completed ? 'bg-[#5B5FEF] border-[#5B5FEF]' : 'border-gray-300 hover:border-[#5B5FEF]'}
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
              className="w-full font-medium text-gray-900 border-b border-[#5B5FEF] focus:outline-none bg-transparent"
            />
          ) : (
            <h3 className={`font-medium text-[15px] truncate transition-all duration-200 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {task.title}
            </h3>
          )}

          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-3">
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

              {task.resources?.length > 0 && (
                <button 
                  onClick={() => setShowResources(!showResources)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>{task.resources.length}</span>
                  {showResources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            <div className="flex items-center opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity gap-1">
              <button onClick={() => setShowAddResource(true)} className="p-1.5 text-gray-400 hover:text-[#5B5FEF] hover:bg-indigo-50 rounded-lg" title="Add Link">
                <LinkIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 text-gray-400 hover:text-[#5B5FEF] hover:bg-indigo-50 rounded-lg" title="Edit Task">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete Task">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
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
            <div className="p-3 bg-gray-50 rounded-xl space-y-2">
              {task.resources?.map(resource => (
                <div key={resource.id} className="flex items-center justify-between group/res">
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                    {resource.url}
                  </a>
                  <button onClick={() => handleRemoveResource(resource.id)} className="opacity-0 group-hover/res:opacity-100 p-1 text-gray-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {showAddResource ? (
                <form onSubmit={handleAddResource} className="flex items-center gap-2 mt-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newResourceUrl}
                    onChange={(e) => setNewResourceUrl(e.target.value)}
                    className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#5B5FEF]"
                    autoFocus
                  />
                  <button type="submit" className="text-xs bg-[#5B5FEF] text-white px-2 py-1 rounded hover:bg-indigo-600">Add</button>
                  <button type="button" onClick={() => setShowAddResource(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </form>
              ) : (
                <button onClick={() => setShowAddResource(true)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#5B5FEF] mt-1">
                  <Plus className="w-3 h-3" /> Add Link
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
