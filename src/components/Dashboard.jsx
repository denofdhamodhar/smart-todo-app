import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { format, addDays, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import SidebarCalendar from './SidebarCalendar';
import MobileDateSelector from './MobileDateSelector';
import TodoContainer from './TodoContainer';

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex h-screen max-w-[1700px] mx-auto w-full bg-[#F8FAFC] overflow-hidden print:block print:h-auto print:bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-86 border-r border-gray-200 bg-white print:hidden">
        <div className="p-8">
          <h1 className="text-xl font-semibold text-black mb-6">Work is Worship</h1>
          <SidebarCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
        <div className="absolute bottom-4 left-6">
          <button onClick={handleLogout} className="text-sm text-white hover:bg-red-500 bg-slate-900 rounded-lg px-4 py-2">
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative print:block print:h-auto">
        <div className="lg:hidden p-4 bg-white border-b border-gray-200 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-black">Work is Worship</h1>
            <button onClick={handleLogout} className="text-sm text-gray-500">Logout</button>
          </div>
          <MobileDateSelector selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 print:p-0 print:overflow-visible">
          <div className="max-w-3xl mx-auto print:max-w-none">
            <TodoContainer selectedDate={selectedDate} />
          </div>
        </div>
      </div>
    </div>
  );
}
