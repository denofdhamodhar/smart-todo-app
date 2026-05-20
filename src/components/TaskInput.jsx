import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addTodo } from '../store/slices/todoSlice';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

export default function TaskInput({ selectedDate, disabled }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('High');
  const user = useSelector(state => state.auth.user);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || disabled) return;

    try {
      await dispatch(addTodo({
        title: title.trim(),
        priority,
        dateKey: format(selectedDate, 'yyyy-MM-dd'),
        userId: user.id
      })).unwrap();
      
      setTitle('');
      setPriority('High');
    } catch (error) {
      console.error("Failed to add task:", error);
      alert("Failed to add task: " + error);
    }
  };

  if (disabled) return null;

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#232326] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-6 focus-within:ring-2 focus-within:ring-[#5B5FEF] dark:focus-within:ring-indigo-500/60 transition-all">
      <input
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-lg placeholder-gray-400 dark:placeholder-gray-600 font-medium border-none focus:outline-none bg-transparent mb-3 text-gray-900 dark:text-gray-100"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {['High', 'Medium', 'Low'].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-medium transition-colors ${
                priority === p 
                  ? 'bg-gray-800 dark:bg-indigo-600 text-white' 
                  : 'bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'
              }`}
            >
              {p === 'High' && '⭐ '}
              {p === 'Medium' && '⌛ '}
              {p === 'Low' && '💚 '}
              {p}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!title.trim()}
          className="bg-[#4ADE80] hover:bg-[#3bc46e] text-white p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
