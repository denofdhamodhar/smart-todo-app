import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from './lib/supabase';
import { setSession, setLoading } from './store/slices/authSlice';
import { processCarryForward, fetchDatesWithTasks } from './store/slices/todoSlice';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const dispatch = useDispatch();
  const { session, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(setLoading(true));
    
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(setSession(session));
      if (session) {
        dispatch(processCarryForward());
        dispatch(fetchDatesWithTasks());
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession(session));
      if (session) {
        dispatch(processCarryForward());
        dispatch(fetchDatesWithTasks());
      }
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B5FEF]"></div>
      </div>
    );
  }

  return (
    <>
      {!session ? <Auth /> : <Dashboard />}
    </>
  );
}

export default App;
