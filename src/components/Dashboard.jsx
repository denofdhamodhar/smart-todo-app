import { useState } from 'react';
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
    <div className="flex h-screen max-w-425 mx-auto w-full bg-[#F8FAFC] dark:bg-[#141417] overflow-hidden print:overflow-visible print:block print:h-auto print:!bg-white transition-colors duration-300">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-86 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c1f] print:hidden">
        <div className="p-8">
          <h1 className="text-xl font-semibold text-black dark:text-white mb-6">Work is Worship</h1>
          <SidebarCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
        <div className="absolute bottom-4 left-6">
          <button onClick={handleLogout} className="text-sm text-white hover:bg-red-500 bg-slate-900 dark:bg-red-900/40 dark:hover:bg-red-600 rounded-lg px-4 py-2 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative print:block print:h-auto">
        <div className="lg:hidden p-4 bg-white dark:bg-[#1c1c1f] border-b border-gray-200 dark:border-zinc-800 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-black dark:text-white">Work is Worship</h1>
            <button onClick={handleLogout} className="text-sm text-gray-500 dark:text-gray-400">Logout</button>
          </div>
          <MobileDateSelector selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 lg:px-12 print:p-0 print:overflow-visible">
          <div className="max-w-[1200px] mx-auto print:max-w-none">
            <TodoContainer selectedDate={selectedDate} />
          </div>
        </div>
      </div>
    </div>
  );
}
