import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTodos, reorderTodos } from '../store/slices/todoSlice';
import { format, isBefore, startOfDay } from 'date-fns';
import TaskCard from './TaskCard';
import TaskInput from './TaskInput';
import { Printer, Filter } from 'lucide-react';
import { AnimatePresence, Reorder } from 'framer-motion';

export default function TodoContainer({ selectedDate }) {
  const dispatch = useDispatch();
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const todos = useSelector(state => state.todos.itemsByDate[dateKey] || []);
  const loading = useSelector(state => state.todos.loading);
  const printRef = useRef(null);
  const [filterPriority, setFilterPriority] = useState('Default');

  useEffect(() => {
    dispatch(fetchTodos(dateKey));
  }, [dateKey, dispatch]);

  const displayedTodos = filterPriority === 'Default' ? todos : todos.filter(t => t.priority === filterPriority);
  const activeTasks = displayedTodos.filter(t => !t.completed);
  const completedTasks = displayedTodos.filter(t => t.completed);

  // Previous dates cannot be edited
  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

  const handlePrint = () => {
    window.print();
  };

  const handleReorder = (newOrder) => {
    // Only allow reordering if not filtered
    if (filterPriority === 'Default') {
      dispatch(reorderTodos({ dateKey, newOrder }));
    }
  };

  const filters = [
    { name: 'Default', label: 'All', activeClass: 'bg-slate-800 text-white', inactiveClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
    { name: 'High', label: 'High', activeClass: 'bg-orange-500 text-white', inactiveClass: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
    { name: 'Medium', label: 'Medium', activeClass: 'bg-yellow-500 text-white', inactiveClass: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
    { name: 'Low', label: 'Low', activeClass: 'bg-green-500 text-white', inactiveClass: 'bg-green-50 text-green-600 hover:bg-green-100' }
  ];

  return (
    <div className="w-full relative pb-24">
      {/* Hide this container during print via CSS classes */}
      <div className="print-hide">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 mt-10">
          <h2 className="text-xl font-semibold text-gray-800">
            {isPastDate ? 'Tasks for ' : 'Today, '}{format(selectedDate, 'MMM d')}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 mr-1 hidden sm:block" />
            {filters.map(f => (
              <button
                key={f.name}
                onClick={() => setFilterPriority(f.name)}
                className={`px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-colors ${filterPriority === f.name ? f.activeClass : f.inactiveClass}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <TaskInput selectedDate={selectedDate} disabled={isPastDate} />

        {loading && todos.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B5FEF]"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {filterPriority === 'Default' ? (
              <Reorder.Group axis="y" values={activeTasks} onReorder={handleReorder} className="space-y-3 list-none">
                <AnimatePresence>
                  {activeTasks.map(task => (
                    <Reorder.Item key={task.id} value={task} id={task.id} className="relative z-0">
                      <TaskCard task={task} />
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            ) : (
              <AnimatePresence>
                {activeTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </AnimatePresence>
            )}

            {completedTasks.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200 border-dashed">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Completed</h3>
                  <button onClick={handlePrint} className="text-gray-400 hover:text-gray-700 transition-colors p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 opacity-80">
                  <AnimatePresence>
                    {completedTasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {!loading && todos.length === 0 && !isPastDate && (
              <div className="text-center py-12">
                <p className="text-gray-400">No tasks for this date. Enjoy your day!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print View Only */}
      <div className="hidden print-block p-8 bg-white max-w-2xl mx-auto" ref={printRef}>
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Work is Worship</h1>
          <h2 className="text-xl text-gray-600">Tasks for {format(selectedDate, 'MMMM d, yyyy')}</h2>
        </div>
        <div className="mb-8">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-gray-800">Active Tasks</h2>
          {activeTasks.length === 0 ? <p className="text-gray-500 italic">No active tasks.</p> : (
            <ul className="list-disc pl-5 space-y-3">
              {activeTasks.map(t => (
                <li key={t.id} className="text-gray-900">
                  <span className="font-medium text-[15px]">{t.title}</span>
                  <span className="text-sm text-gray-500 ml-2">({t.priority} priority)</span>
                  {t.resources?.length > 0 && (
                    <ul className="list-circle pl-5 mt-1 text-sm text-blue-600">
                      {t.resources.map(r => <li key={r.id}>{r.url}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-gray-800">Completed Tasks</h2>
          {completedTasks.length === 0 ? <p className="text-gray-500 italic">No completed tasks.</p> : (
            <ul className="list-disc pl-5 space-y-2 text-gray-400">
              {completedTasks.map(t => (
                <li key={t.id} className="line-through">{t.title}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
