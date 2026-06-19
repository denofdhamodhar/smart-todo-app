import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../lib/ThemeContext';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the login link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#141417] transition-colors duration-300">

      {/* Theme Toggle — top right corner */}
      <motion.button
        onClick={toggleTheme}
        whileTap={{ scale: 0.88 }}
        className="fixed top-5 right-5 w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center text-gray-600 dark:text-yellow-300 z-50"
        title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {theme === 'dark' ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22 }}
              className="absolute"
            >
              <Sun className="w-4 h-4 text-yellow-400" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22 }}
              className="absolute"
            >
              <Moon className="w-4 h-4 text-slate-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md bg-white dark:bg-[#1c1c1f] rounded-2xl shadow-xl dark:shadow-black/40 border border-gray-100 dark:border-zinc-800 p-8 space-y-8"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
            {isSignUp ? 'Create an account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1.5">
            Smart Todo Planner
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] dark:focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-zinc-800/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-600 text-sm"
              placeholder="Email address"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B5FEF] dark:focus:ring-indigo-500 focus:border-transparent transition-all bg-white dark:bg-zinc-800/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-600 text-sm"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors focus:outline-none flex items-center justify-center"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={showPassword ? "eye-off" : "eye"}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5B5FEF] hover:bg-indigo-600 active:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-all flex items-center justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-indigo-300/40 dark:shadow-indigo-900/40"
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-[#5B5FEF] dark:text-indigo-400 hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
