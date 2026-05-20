import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import todoReducer from './slices/todoSlice';

const savedTodos = localStorage.getItem('todos_state');
let preloadedState = {};
if (savedTodos) {
  try {
    preloadedState = { todos: JSON.parse(savedTodos) };
  } catch (e) {
    console.error("Failed to parse todos state from local storage", e);
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
  localStorage.setItem('todos_state', JSON.stringify(store.getState().todos));
});
