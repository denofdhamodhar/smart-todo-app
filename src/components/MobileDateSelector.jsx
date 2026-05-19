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
      className="flex overflow-x-auto hide-scrollbar space-x-3 pb-2 -mx-4 px-4 scroll-smooth"
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
            className={`relative flex flex-col items-center justify-center min-w-[4rem] h-16 rounded-2xl transition-all duration-200
              ${isSelected 
                ? 'bg-[#9D7CFF] text-white shadow-lg shadow-purple-200 transform scale-105' 
                : 'bg-transparent text-gray-500 hover:bg-gray-50'}
            `}
          >
            {hasTasks && (
              <span className={`absolute top-2 right-3 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#4ADE80]'}`}></span>
            )}
            <span className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${isSelected ? 'text-purple-100' : ''}`}>
              {format(day, 'EEE')}
            </span>
            <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
              {format(day, 'd')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
