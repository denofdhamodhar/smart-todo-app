import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import todoReducer from './slices/todoSlice';

// Helper to encode state to Base64 (supports UTF-8/Unicode)
const encodeState = (stateObj) => {
  try {
    const jsonStr = JSON.stringify(stateObj);
    const bytes = new TextEncoder().encode(jsonStr);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
  } catch (e) {
    console.error("Failed to encode state", e);
    return "";
  }
};

// Helper to decode state from Base64
const decodeState = (encodedStr) => {
  try {
    if (!encodedStr || encodedStr.trim().startsWith('{')) {
      return null; // Old plain JSON format, skip atob
    }
    const binString = atob(encodedStr);
    const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    // Silent fallback for formatting changes
    return null;
  }
};

const savedTodos = localStorage.getItem('todos_state');
let preloadedState = {};
if (savedTodos) {
  // Try decoding first (new Base64 format). If it fails, fallback to JSON.parse (old plain-text format)
  let parsed = decodeState(savedTodos);
  if (!parsed) {
    try {
      parsed = JSON.parse(savedTodos);
    } catch (e) {
      console.error("Failed to parse todos state from local storage", e);
    }
  }
  if (parsed) {
    preloadedState = { todos: parsed };
  }
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
    todos: todoReducer,
  },
  preloadedState,
});

store.subscribe(() => {
  const todosState = store.getState().todos;
  localStorage.setItem('todos_state', encodeState(todosState));
});
