import { useEffect, useRef } from 'react';
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
  const initialized = useRef(false);

  useEffect(() => {
    dispatch(setLoading(true));
    
    const handleInitialSession = (session) => {
      if (initialized.current) return;
      initialized.current = true;

      dispatch(setSession(session));
      if (session) {
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
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleInitialSession(session);
    }).catch(err => {
      console.warn("Offline or getSession error:", err);
      // Let onAuthStateChange handle the fallback or just finish loading
      dispatch(setLoading(false));
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        dispatch(setSession(null));
        initialized.current = false;
      } else if (session) {
        handleInitialSession(session);
      } else {
        dispatch(setSession(null));
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
