import { useEffect, useRef } from 'react';
import { format, addDays, subDays, isSameDay } from 'date-fns';

import { useSelector } from 'react-redux';

export default function MobileDateSelector({ selectedDate, onSelect }) {
  // Generate 15 days: 7 before, today, 7 after
  const days = Array.from({ length: 15 }).map((_, i) => addDays(subDays(selectedDate, 7), i));
  const scrollRef = useRef(null);
  const datesWithTasks = useSelector(state => state.todos.datesWithTasks || []);

  useEffect(() => {
    // Center the selected date on load or change
    if (scrollRef.current) {
      const container = scrollRef.current;
      const selectedElement = container.querySelector('[data-selected="true"]');
      if (selectedElement) {
        const scrollPosition = selectedElement.offsetLeft - (container.clientWidth / 2) + (selectedElement.clientWidth / 2);
        container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      }
    }
  }, [selectedDate]);

  return (
    <div 
      ref={scrollRef}
      className="flex overflow-x-auto hide-scrollbar space-x-3 pb-3 -mx-4 px-4 scroll-smooth"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Hide scrollbar
    >
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
      {days.map(day => {
        const isSelected = isSameDay(day, selectedDate);
        const hasTasks = datesWithTasks.includes(format(day, 'yyyy-MM-dd'));

        return (
          <button
            key={day.toString()}
            onClick={() => onSelect(day)}
            data-selected={isSelected}
            className={`relative flex flex-col items-center justify-center min-w-[4.2rem] h-18 rounded-2xl transition-all duration-200 border
              ${isSelected 
                ? 'bg-gradient-to-br from-[#9D7CFF] to-[#7C3AED] text-white border-transparent shadow-lg shadow-purple-500/20 transform scale-105 z-10' 
                : 'bg-white dark:bg-zinc-800/60 border-slate-100 dark:border-zinc-700/50 hover:bg-slate-50 dark:hover:bg-zinc-700/80 hover:scale-102'}
            `}
          >
            {hasTasks && (
              <span className={`absolute top-2.5 right-3 w-2 h-2 rounded-full ${isSelected ? 'bg-white ring-2 ring-[#9D7CFF]' : 'bg-[#4ADE80] ring-2 ring-white dark:ring-zinc-800'}`}></span>
            )}
            <span className={`text-[9px] uppercase tracking-widest font-extrabold mb-1.5 ${isSelected ? 'text-purple-100' : 'text-[#7C3AED] dark:text-indigo-400'}`}>
              {format(day, 'EEE')}
            </span>
            <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-800 dark:text-zinc-100'}`}>
              {format(day, 'd')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
