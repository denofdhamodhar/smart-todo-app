import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTodos, reorderTodos, parseTaskTitle } from '../store/slices/todoSlice';
import { format, isBefore, startOfDay } from 'date-fns';
import TaskCard from './TaskCard';
import TaskInput from './TaskInput';
import { Printer, Filter, Copy, Check, Moon, Sun } from 'lucide-react';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { useTheme } from '../lib/ThemeContext';

export default function TodoContainer({ selectedDate }) {
  const dispatch = useDispatch();
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const todos = useSelector(state => state.todos.itemsByDate[dateKey] || []);
  const loading = useSelector(state => state.todos.loading);
  const printRef = useRef(null);
  const [filterPriority, setFilterPriority] = useState('Default');
  const [copied, setCopied] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    dispatch(fetchTodos(dateKey));
  }, [dateKey, dispatch]);

  const displayedTodos = filterPriority === 'Default' ? todos : todos.filter(t => t.priority === filterPriority);
  const activeTasks = displayedTodos.filter(t => !t.completed);
  const completedTasks = displayedTodos.filter(t => t.completed);

  const printActiveTasks = activeTasks.filter(t => !parseTaskTitle(t.title).fromOriginalDate);
  const printCompletedTasks = completedTasks.filter(t => !parseTaskTitle(t.title).fromOriginalDate);

  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));

  const handlePrint = () => {
    setShowToolsMenu(false);
    setTimeout(() => window.print(), 100);
  };

  const handleCopy = async () => {
    try {
      let textToCopy = `Tasks for ${format(selectedDate, 'MMMM d, yyyy')}\n\n`;
      if (activeTasks.length > 0) {
        textToCopy += `Active Tasks:\n`;
        activeTasks.forEach(t => {
          const { cleanTitle } = parseTaskTitle(t.title);
          textToCopy += `- ${cleanTitle} (${t.priority} priority)\n`;
          t.resources?.forEach(r => {
            textToCopy += `  Link: ${r.url}\n`;
          });
        });
        textToCopy += `\n`;
      }
      if (completedTasks.length > 0) {
        textToCopy += `Completed Tasks:\n`;
        completedTasks.forEach(t => {
          const { cleanTitle } = parseTaskTitle(t.title);
          textToCopy += `- ${cleanTitle}\n`;
        });
      }
      await navigator.clipboard.writeText(textToCopy.trim());
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowToolsMenu(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Filter out tasks from other dates (carried-forward)
    const localDateTasks = todos.filter(t => !parseTaskTitle(t.title).fromOriginalDate);
    const displayedPDFTodos = filterPriority === 'Default' ? localDateTasks : localDateTasks.filter(t => t.priority === filterPriority);
    
    const active = displayedPDFTodos.filter(t => !t.completed);
    const completed = displayedPDFTodos.filter(t => t.completed);

    let y = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - (margin * 2);

    // Title / Header Banner
    doc.setFillColor(91, 95, 239); // Royal blue/purple accent
    doc.rect(margin, y, contentWidth, 2, 'F');
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("Smart Todo Planner", margin, y);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(format(selectedDate, 'EEEE, MMMM d, yyyy'), margin + 105, y);
    y += 12;

    // Helper to draw section header
    const drawSectionHeader = (titleText, color) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(titleText, margin, y);
      y += 6;
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentWidth, y);
      y += 8;
    };

    // Helper to draw a task card
    const drawTaskCard = (task) => {
      const cardX = margin;
      const cardWidth = contentWidth;
      const leftBorderWidth = 4;
      
      // Determine priority color
      let pColor = [34, 197, 94]; // Low (Green)
      if (task.priority === 'High') pColor = [249, 115, 22]; // Orange
      else if (task.priority === 'Medium') pColor = [234, 179, 8]; // Yellow

      // Prepare text
      const cleanTitle = parseTaskTitle(task.title).cleanTitle;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      
      const titleLines = doc.splitTextToSize(cleanTitle, cardWidth - 30);
      const titleHeight = titleLines.length * 5;
      
      // Links
      const links = task.resources || [];
      const linkHeight = links.length * 6;

      const cardPadding = 6;
      const cardHeight = titleHeight + linkHeight + (links.length > 0 ? 12 : 8);

      // Page overflow check
      if (y + cardHeight > 275) {
        doc.addPage();
        y = 20;
      }

      // Draw light gray background card
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(cardX, y, cardWidth, cardHeight, 'F');

      // Draw priority colored left border
      doc.setFillColor(pColor[0], pColor[1], pColor[2]);
      doc.rect(cardX, y, leftBorderWidth, cardHeight, 'F');

      // Draw card border
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.rect(cardX, y, cardWidth, cardHeight, 'S');

      // Print Title
      doc.setTextColor(30, 41, 59);
      doc.text(titleLines, cardX + 8, y + 6);

      // Print Priority Badge Text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(pColor[0], pColor[1], pColor[2]);
      doc.text(task.priority.toUpperCase(), cardX + cardWidth - 25, y + 6, { align: 'right' });

      // Print Links
      if (links.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("Links:", cardX + 8, y + titleHeight + 8);
        
        links.forEach((link, idx) => {
          doc.setTextColor(59, 130, 246); // Blue link color
          const shortUrl = link.url.length > 75 ? link.url.substring(0, 72) + '...' : link.url;
          doc.textWithLink(shortUrl, cardX + 18, y + titleHeight + 14 + (idx * 6), { url: link.url });
        });
      }

      y += cardHeight + 4;
    };

    if (active.length > 0) {
      drawSectionHeader("Active Tasks", [91, 95, 239]);
      active.forEach(t => drawTaskCard(t));
      y += 6;
    }

    if (completed.length > 0) {
      drawSectionHeader("Completed Tasks", [34, 197, 94]);
      completed.forEach(t => drawTaskCard(t));
    }

    if (active.length === 0 && completed.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      doc.setTextColor(148, 163, 184);
      doc.text("No tasks scheduled for this date.", margin, y + 10);
    }

    doc.save(`Tasks-${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
    setShowToolsMenu(false);
  };

  const handleReorder = (newOrder) => {
    if (filterPriority === 'Default') {
      dispatch(reorderTodos({ dateKey, newOrder }));
    }
  };

  const filters = [
    { name: 'Default', label: 'All', activeClass: 'bg-slate-800 dark:bg-indigo-600 text-white', inactiveClass: 'bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/15' },
    { name: 'High', label: 'High', activeClass: 'bg-orange-500 text-white', inactiveClass: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50' },
    { name: 'Medium', label: 'Medium', activeClass: 'bg-yellow-500 text-white', inactiveClass: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50' },
    { name: 'Low', label: 'Low', activeClass: 'bg-green-500 text-white', inactiveClass: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50' }
  ];

  return (
    <div className="w-full relative pb-24 print:pb-0 print:!bg-white">
      <div className="print-hide">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 mt-10">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
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
            {filterPriority === 'Default' && !isPastDate ? (
              <Reorder.Group axis="y" values={activeTasks} onReorder={handleReorder} className="space-y-3 list-none">
                <AnimatePresence>
                  {activeTasks.map(task => (
                    <Reorder.Item key={task.id} value={task} id={task.id} className="relative z-0">
                      <TaskCard task={task} disabled={isPastDate} />
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {activeTasks.map(task => (
                    <TaskCard key={task.id} task={task} disabled={isPastDate} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="mt-8 pt-6 border-t border-dashed border-gray-200 dark:border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Completed</h3>
                </div>
                <div className="space-y-3 opacity-80">
                  <AnimatePresence>
                    {completedTasks.map(task => (
                      <TaskCard key={task.id} task={task} disabled={isPastDate} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {!loading && todos.length === 0 && !isPastDate && (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-600">No tasks for this date. Enjoy your day!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 print:hidden z-50 flex flex-col items-end gap-3">
        
        {/* Tools Menu Card */}
        <AnimatePresence>
          {showToolsMenu && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="mb-1 bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-2 w-48 flex flex-col gap-1 origin-bottom-right"
            >
              <button 
                onClick={handleCopy} 
                className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span className={copied ? "text-green-400 font-medium" : ""}>{copied ? 'Copied!' : 'Copy Tasks'}</span>
              </button>
              <button 
                onClick={handlePrint} 
                className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Preview</span>
              </button>
              <div className="h-px bg-slate-800 my-1 mx-2" />
              <button 
                onClick={handleDownloadPDF} 
                className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm font-medium text-white bg-[#5B5FEF] hover:bg-indigo-500 rounded-xl transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download PDF</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Button Row */}
        <div className="flex items-center gap-3">
          {/* Dark/Light Mode Toggle */}
          <motion.button
            onClick={toggleTheme}
            whileTap={{ scale: 0.9 }}
            className="relative bg-white dark:bg-zinc-800 border border-purple-400 dark:border-zinc-700 text-gray-700 dark:text-yellow-300 w-14 h-14 rounded-full shadow-sm flex items-center justify-center overflow-hidden"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === 'dark' ? (
                <motion.div
                  key="sun"
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="absolute"
                >
                  <Sun className="w-5 h-5 text-yellow-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="absolute"
                >
                  <Moon fill='currentColor' className="w-5.5 h-5.5 text-purple-400" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Tools Button */}
          <motion.button 
            onClick={() => setShowToolsMenu(!showToolsMenu)} 
            whileTap={{ scale: 0.9 }}
            animate={{ rotate: showToolsMenu ? 15 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-[#232326] dark:bg-zinc-800 hover:bg-zinc-700 dark:hover:bg-zinc-700 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl border border-zinc-700/50 dark:border-zinc-700"
            title="Tools"
          >
            🛠️
          </motion.button>
        </div>
      </div>

      {/* Print View Only */}
      <div className="absolute top-[-9999px] left-[-9999px] print:static print:top-auto print:left-auto p-8 print:p-0 bg-white print:w-full print:max-w-none text-black" ref={printRef}>
        <div className="max-w-2xl mx-auto px-12 pt-16">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2 text-purple-600">Work is Worship</h1>
            <h2 className="text-xl text-slate-600">Tasks for {format(selectedDate, 'MMMM d, yyyy')}</h2>
          </div>
          <div className="mb-8">
            <h2 className="text-lg font-semibold pb-2 mb-4 text-orange-500">Active Tasks</h2>
            {printActiveTasks.length === 0 ? <p className="text-gray-500 italic">No active tasks.</p> : (
              <ul className="list-disc pl-5 space-y-3">
                {printActiveTasks.map(t => {
                  const { cleanTitle } = parseTaskTitle(t.title);
                  return (
                    <li key={t.id} className="text-gray-900">
                      <span className="font-medium text-[15px]">{cleanTitle}</span>
                      <span className="text-sm text-gray-500 ml-2">({t.priority} priority)</span>
                      {t.resources?.length > 0 && (
                        <ul className="list-circle pl-5 mt-1 text-sm text-blue-600">
                          {t.resources.map(r => (
                            <li key={r.id}>
                              <a href={r.url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{r.url}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold pb-2 mb-4 text-green-500">Completed Tasks</h2>
            {printCompletedTasks.length === 0 ? <p className="text-gray-500 italic">No completed tasks.</p> : (
              <ul className="list-disc pl-5 space-y-2 text-gray-400">
                {printCompletedTasks.map(t => {
                  const { cleanTitle } = parseTaskTitle(t.title);
                  return <li key={t.id} className="line-through">{cleanTitle}</li>;
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
