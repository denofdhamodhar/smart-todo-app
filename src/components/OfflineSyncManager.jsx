import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { processSyncQueue } from '../store/slices/todoSlice';

export default function OfflineSyncManager() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Attempt sync on initial mount
    dispatch(processSyncQueue());

    const handleOnline = () => {
      dispatch(processSyncQueue());
    };

    window.addEventListener('online', handleOnline);

    // Ultra-robust: try syncing every 10 seconds as a fallback
    // The thunk automatically exits if the queue is empty, so this is very cheap.
    const interval = setInterval(() => {
      if (navigator.onLine) {
        dispatch(processSyncQueue());
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [dispatch]);

  return null;
}
