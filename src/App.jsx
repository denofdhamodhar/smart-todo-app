import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from './lib/supabase';
import { setSession, setLoading } from './store/slices/authSlice';
import { processCarryForward, fetchAllTodos, seedOneYearTodos } from './store/slices/todoSlice';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import OfflineSyncManager from './components/OfflineSyncManager';

function App() {
  const dispatch = useDispatch();
  const { session, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(setLoading(true));

    // Listen for changes (fires immediately on subscribe with the current session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      dispatch(setSession(session));
      
      if (session) {
        // Only run fetch and seed when signing in or on initial session
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          dispatch(fetchAllTodos())
            .unwrap()
            .then((todos) => {
              dispatch(processCarryForward());
              const hasTasksOutsideJune2026 = todos.some(todo => !todo.date_key.startsWith('2026-06-'));
              if (!hasTasksOutsideJune2026) {
                dispatch(seedOneYearTodos());
              }
            })
            .catch(err => {
              console.error("Error fetching or seeding todos:", err);
            });
        }
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
      {session && <OfflineSyncManager />}
      {!session ? <Auth /> : <Dashboard />}
    </>
  );
}

export default App;
