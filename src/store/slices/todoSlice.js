import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export const processSyncQueue = createAsyncThunk(
  'todos/processSyncQueue',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const queue = state.todos.syncQueue || [];
      if (queue.length === 0) return [];

      const processedIds = [];

      for (const job of queue) {
        let error = null;
        if (job.type === 'INSERT') {
          const { error: e } = await supabase.from(job.table).insert(job.payload);
          error = e;
        } else if (job.type === 'UPDATE') {
          const { error: e } = await supabase.from(job.table).update(job.payload).eq('id', job.id);
          error = e;
        } else if (job.type === 'DELETE') {
          const { error: e } = await supabase.from(job.table).delete().eq('id', job.id);
          error = e;
        }
        
        if (error && error.code !== '23505') {
          console.error("Sync error:", error);
          throw error;
        }
        processedIds.push(job.jobId);
      }
      return processedIds;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTodos = createAsyncThunk(
  'todos/fetchTodos',
  async (dateKey, { rejectWithValue }) => {
    try {
      const { data: todos, error } = await supabase
        .from('todos')
        .select(`*, resources (*)`)
        .eq('date_key', dateKey)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { dateKey, todos };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addTodo = createAsyncThunk(
  'todos/addTodo',
  async ({ title, priority, dateKey, userId }, { getState, dispatch }) => {
    const state = getState();
    const items = state.todos.itemsByDate[dateKey] || [];
    const orderIndex = items.length > 0 ? Math.max(...items.map(t => t.order_index || 0)) + 1 : 0;
    
    const newTodo = {
      id: uuidv4(),
      title,
      priority,
      date_key: dateKey,
      user_id: userId,
      order_index: orderIndex,
      completed: false,
      created_at: new Date().toISOString(),
      resources: []
    };

    dispatch(todoSlice.actions.addOptimistic({ dateKey, todo: newTodo }));
    dispatch(todoSlice.actions.addToQueue({
      type: 'INSERT',
      table: 'todos',
      payload: { ...newTodo, resources: undefined }
    }));
    dispatch(processSyncQueue());
    return newTodo;
  }
);

export const updateTodo = createAsyncThunk(
  'todos/updateTodo',
  async ({ id, updates }, { getState, dispatch }) => {
    const state = getState();
    let dateKey = updates.date_key;
    if (!dateKey) {
      for (const [key, items] of Object.entries(state.todos.itemsByDate)) {
        if (items.some(t => t.id === id)) dateKey = key;
      }
    }
    
    dispatch(todoSlice.actions.updateOptimistic({ dateKey, id, updates }));
    dispatch(todoSlice.actions.addToQueue({
      type: 'UPDATE',
      table: 'todos',
      id,
      payload: updates
    }));
    dispatch(processSyncQueue());
    return { id, updates, dateKey };
  }
);

export const deleteTodo = createAsyncThunk(
  'todos/deleteTodo',
  async (id, { dispatch }) => {
    dispatch(todoSlice.actions.deleteOptimistic({ id }));
    dispatch(todoSlice.actions.addToQueue({
      type: 'DELETE',
      table: 'todos',
      id
    }));
    dispatch(processSyncQueue());
    return id;
  }
);

export const reorderTodos = createAsyncThunk(
  'todos/reorderTodos',
  async ({ dateKey, newOrder }, { dispatch }) => {
    const updatedOrder = newOrder.map((task, index) => ({ ...task, order_index: index }));
    dispatch(todoSlice.actions.reorderOptimistic({ dateKey, newOrder: updatedOrder }));
    
    updatedOrder.forEach((task, index) => {
      dispatch(todoSlice.actions.addToQueue({
        type: 'UPDATE',
        table: 'todos',
        id: task.id,
        payload: { order_index: index }
      }));
    });
    dispatch(processSyncQueue());
    return { dateKey, newOrder: updatedOrder };
  }
);

export const addResource = createAsyncThunk(
  'todos/addResource',
  async ({ taskId, url }, { dispatch }) => {
    const resource = {
      id: uuidv4(),
      task_id: taskId,
      url
    };
    dispatch(todoSlice.actions.addResourceOptimistic({ resource }));
    dispatch(todoSlice.actions.addToQueue({
      type: 'INSERT',
      table: 'resources',
      payload: resource
    }));
    dispatch(processSyncQueue());
    return resource;
  }
);

export const deleteResource = createAsyncThunk(
  'todos/deleteResource',
  async (id, { dispatch }) => {
    dispatch(todoSlice.actions.deleteResourceOptimistic({ id }));
    dispatch(todoSlice.actions.addToQueue({
      type: 'DELETE',
      table: 'resources',
      id
    }));
    dispatch(processSyncQueue());
    return id;
  }
);

export const processCarryForward = createAsyncThunk(
  'todos/carryForward',
  async (_, { getState, dispatch }) => {
    const state = getState();
    const today = format(new Date(), 'yyyy-MM-dd');
    let count = 0;
    
    Object.keys(state.todos.itemsByDate).forEach(date => {
      if (date < today) {
        state.todos.itemsByDate[date].forEach(task => {
          if (!task.completed) {
            dispatch(todoSlice.actions.deleteOptimistic({ id: task.id }));
            dispatch(todoSlice.actions.addOptimistic({ 
              dateKey: today, 
              todo: { ...task, date_key: today, priority: 'High', carried_forward: true } 
            }));
            dispatch(todoSlice.actions.addToQueue({
              type: 'UPDATE',
              table: 'todos',
              id: task.id,
              payload: { date_key: today, priority: 'High', carried_forward: true }
            }));
            count++;
          }
        });
      }
    });
    
    if (count > 0) dispatch(processSyncQueue());
    return { count, today };
  }
);

export const fetchDatesWithTasks = createAsyncThunk(
  'todos/fetchDatesWithTasks',
  async (_, { getState }) => {
    const state = getState();
    return Object.keys(state.todos.itemsByDate).filter(date => state.todos.itemsByDate[date].length > 0);
  }
);

const initialState = {
  itemsByDate: {},
  datesWithTasks: [],
  syncQueue: [],
  loading: false,
  error: null,
};

const todoSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    addToQueue: (state, action) => {
      state.syncQueue.push({
        jobId: uuidv4(),
        ...action.payload
      });
    },
    addOptimistic: (state, action) => {
      const { dateKey, todo } = action.payload;
      if (!state.itemsByDate[dateKey]) state.itemsByDate[dateKey] = [];
      state.itemsByDate[dateKey].push(todo);
      if (!state.datesWithTasks.includes(dateKey)) state.datesWithTasks.push(dateKey);
    },
    updateOptimistic: (state, action) => {
      const { dateKey, id, updates } = action.payload;
      if (state.itemsByDate[dateKey]) {
        const index = state.itemsByDate[dateKey].findIndex(t => t.id === id);
        if (index !== -1) {
          state.itemsByDate[dateKey][index] = { ...state.itemsByDate[dateKey][index], ...updates };
        }
      }
    },
    deleteOptimistic: (state, action) => {
      const { id } = action.payload;
      Object.keys(state.itemsByDate).forEach(date => {
        state.itemsByDate[date] = state.itemsByDate[date].filter(t => t.id !== id);
        if (state.itemsByDate[date].length === 0) {
          state.datesWithTasks = state.datesWithTasks.filter(d => d !== date);
        }
      });
    },
    reorderOptimistic: (state, action) => {
      const { dateKey, newOrder } = action.payload;
      if (state.itemsByDate[dateKey]) {
        const completedTasks = state.itemsByDate[dateKey].filter(t => t.completed);
        state.itemsByDate[dateKey] = [...newOrder, ...completedTasks];
      }
    },
    addResourceOptimistic: (state, action) => {
      const { resource } = action.payload;
      Object.keys(state.itemsByDate).forEach(date => {
        const todo = state.itemsByDate[date].find(t => t.id === resource.task_id);
        if (todo) {
          if (!todo.resources) todo.resources = [];
          todo.resources.push(resource);
        }
      });
    },
    deleteResourceOptimistic: (state, action) => {
      const { id } = action.payload;
      Object.keys(state.itemsByDate).forEach(date => {
        state.itemsByDate[date] = state.itemsByDate[date].map(todo => ({
          ...todo,
          resources: todo.resources ? todo.resources.filter(r => r.id !== id) : []
        }));
      });
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(processSyncQueue.fulfilled, (state, action) => {
        const processedIds = action.payload;
        state.syncQueue = state.syncQueue.filter(job => !processedIds.includes(job.jobId));
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        if (state.syncQueue.length === 0) {
          state.itemsByDate[action.payload.dateKey] = action.payload.todos;
          if (action.payload.todos.length > 0) {
            if (!state.datesWithTasks.includes(action.payload.dateKey)) {
              state.datesWithTasks.push(action.payload.dateKey);
            }
          } else {
            state.datesWithTasks = state.datesWithTasks.filter(d => d !== action.payload.dateKey);
          }
        }
      })
      .addCase(fetchDatesWithTasks.fulfilled, (state, action) => {
        const remoteDates = action.payload || [];
        const localDatesWithTasks = Object.keys(state.itemsByDate).filter(date => state.itemsByDate[date].length > 0);
        state.datesWithTasks = [...new Set([...remoteDates, ...localDatesWithTasks])];
      });
  },
});

export const { addToQueue, addOptimistic, updateOptimistic, deleteOptimistic, reorderOptimistic, addResourceOptimistic, deleteResourceOptimistic } = todoSlice.actions;
export default todoSlice.reducer;
