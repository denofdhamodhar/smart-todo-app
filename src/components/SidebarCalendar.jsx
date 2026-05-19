import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useSelector } from 'react-redux';

export default function SidebarCalendar({ selectedDate, onSelect }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));
  const datesWithTasks = useSelector(state => state.todos.datesWithTasks || []);

  // Sync current month if selected date changes externally
  useEffect(() => {
    setCurrentMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="w-full select-none bg-violet-100 p-4 rounded-2xl mt-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[1.1rem] font-semibold text-gray-800 tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex space-x-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-4 gap-x-1 text-center text-xs font-medium mb-4 text-gray-400">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-sm">
        {Array.from({ length: currentMonth.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}

        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const hasTasks = datesWithTasks.includes(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toString()}
              onClick={() => onSelect(day)}
              className={`relative w-8 h-8 mx-auto rounded-full flex items-center justify-center transition-all duration-200
                ${isSelected
                  ? 'bg-[#9D7CFF] text-white font-semibold shadow-md shadow-purple-200 scale-110'
                  : isToday
                    ? 'text-[#5B5FEF] font-bold bg-indigo-50 hover:bg-indigo-100'
                    : 'text-gray-700 hover:bg-gray-100 hover:scale-110 font-medium'}
              `}
            >
              {format(day, 'd')}
              {hasTasks && (
                <span className={`absolute top-0 right-0 w-[5px] h-[5px] rounded-full ${isSelected ? 'bg-white' : 'bg-[#4ADE80]'} ring-1 ring-white`}></span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
