import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';
import { format, subDays } from 'date-fns';
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
        let payload = { ...(job.payload || {}) };
        delete payload.resources;

        const executeJob = async (currentPayload) => {
          if (job.type === 'INSERT') {
            return await supabase.from(job.table).insert(currentPayload);
          } else if (job.type === 'UPDATE') {
            return await supabase.from(job.table).update(currentPayload).eq('id', job.id);
          } else if (job.type === 'DELETE') {
            return await supabase.from(job.table).delete().eq('id', job.id);
          }
          return { error: null };
        };

        let res = await executeJob(payload);
        error = res.error;

        // Fallback retry if optional columns (like order_index) are missing in remote DB schema
        if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('order_index'))) {
          console.warn(`Sync warning: Column missing in Supabase for table ${job.table}. Retrying insert/update without order_index...`, error);
          const fallbackPayload = { ...payload };
          delete fallbackPayload.order_index;
          res = await executeJob(fallbackPayload);
          error = res.error;
        }

        if (error && error.code !== '23505') {
          console.error("Sync error for job:", error, job);
          // Mark as processed so unresolvable jobs don't block the sync queue indefinitely
          processedIds.push(job.jobId);
        } else {
          processedIds.push(job.jobId);
        }
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
      let { data: todos, error } = await supabase
        .from('todos')
        .select(`*, resources (*)`)
        .eq('date_key', dateKey)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error && (error.code === 'PGRST204' || error.message?.includes('order_index'))) {
        const fallbackRes = await supabase
          .from('todos')
          .select(`*, resources (*)`)
          .eq('date_key', dateKey)
          .order('created_at', { ascending: true });
        todos = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;
      return { dateKey, todos: todos || [] };
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
    const validOrderIndices = items.map(t => typeof t.order_index === 'number' ? t.order_index : 0);
    const orderIndex = validOrderIndices.length > 0 ? Math.max(...validOrderIndices) + 1 : 0;
    
    const newTodo = {
      id: uuidv4(),
      title,
      priority: priority || 'Medium',
      date_key: dateKey,
      user_id: userId,
      order_index: orderIndex,
      completed: false,
      carried_forward: false,
      created_at: new Date().toISOString(),
      resources: []
    };

    dispatch(todoSlice.actions.addOptimistic({ dateKey, todo: newTodo }));
    
    const todoPayload = { ...newTodo };
    delete todoPayload.resources;
    dispatch(todoSlice.actions.addToQueue({
      type: 'INSERT',
      table: 'todos',
      payload: todoPayload
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
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    let count = 0;
    
    const todayItems = state.todos.itemsByDate[today] || [];
    const validOrderIndices = todayItems.map(t => typeof t.order_index === 'number' ? t.order_index : 0);
    let nextOrderIndex = validOrderIndices.length > 0 ? Math.max(...validOrderIndices) + 1 : 0;
    
    const yesterdayItems = state.todos.itemsByDate[yesterday] || [];
    yesterdayItems.forEach(task => {
      if (!task.completed && !task.carried_forward) {
        dispatch(todoSlice.actions.updateOptimistic({ 
          dateKey: yesterday, 
          id: task.id, 
          updates: { carried_forward: true } 
        }));
        dispatch(todoSlice.actions.addToQueue({
          type: 'UPDATE',
          table: 'todos',
          id: task.id,
          payload: { carried_forward: true }
        }));

        const parts = yesterday.split('-');
        const formattedOldDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : yesterday;

        const cleanTitle = task.title
          .replace(/\s\(from\s\d{2}-\d{2}-\d{4}\)$/, '')
          .replace(/\s\[from:\d{2}-\d{2}-\d{4}\]$/, '');

        const newTaskId = uuidv4();
        const copiedResources = [];
        if (task.resources && task.resources.length > 0) {
          task.resources.forEach(r => {
            copiedResources.push({
              id: uuidv4(),
              task_id: newTaskId,
              url: r.url
            });
          });
        }

        const copiedTask = {
          id: newTaskId,
          user_id: task.user_id,
          date_key: today,
          title: `${cleanTitle} [from:${formattedOldDate}]`,
          completed: false,
          priority: task.priority || 'Medium',
          carried_forward: false,
          order_index: nextOrderIndex++,
          created_at: new Date().toISOString(),
          resources: copiedResources,
          note: task.note
        };

        dispatch(todoSlice.actions.addOptimistic({ 
          dateKey: today, 
          todo: copiedTask 
        }));

        dispatch(todoSlice.actions.addToQueue({
          type: 'INSERT',
          table: 'todos',
          payload: {
            id: copiedTask.id,
            user_id: copiedTask.user_id,
            date_key: copiedTask.date_key,
            title: copiedTask.title,
            completed: copiedTask.completed,
            priority: copiedTask.priority,
            carried_forward: copiedTask.carried_forward,
            order_index: copiedTask.order_index,
            created_at: copiedTask.created_at,
            note: copiedTask.note
          }
        }));

        copiedResources.forEach(res => {
          dispatch(todoSlice.actions.addToQueue({
            type: 'INSERT',
            table: 'resources',
            payload: res
          }));
        });

        count++;
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

export const fetchAllTodos = createAsyncThunk(
  'todos/fetchAllTodos',
  async (_, { rejectWithValue }) => {
    try {
      let { data: todos, error } = await supabase
        .from('todos')
        .select(`*, resources (*)`)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error && (error.code === 'PGRST204' || error.message?.includes('order_index'))) {
        const fallbackRes = await supabase
          .from('todos')
          .select(`*, resources (*)`)
          .order('created_at', { ascending: true });
        todos = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;
      return todos || [];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const seedWelcomeTask = createAsyncThunk(
  'todos/seedWelcomeTask',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const user = state.auth.user;
      if (!user?.id) throw new Error("No user ID found in auth state");

      const createdAtRaw = user.created_at ? new Date(user.created_at) : new Date();
      const dateKey = format(createdAtRaw, 'yyyy-MM-dd');

      const taskId = uuidv4();
      const resourceId = uuidv4();
      const dummyUrl = 'https://supabase.com/docs';

      const welcomeTask = {
        id: taskId,
        user_id: user.id,
        date_key: dateKey,
        title: 'Welcome to Smart Todo Planner! 🚀 (Click to explore features)',
        completed: false,
        priority: 'High',
        carried_forward: false,
        order_index: 0,
        created_at: new Date().toISOString(),
        note: 'This is your guide task. You can add notes, attach links, prioritize tasks, and track your daily progress!',
        resources: [
          {
            id: resourceId,
            task_id: taskId,
            url: dummyUrl
          }
        ]
      };

      dispatch(todoSlice.actions.addOptimistic({ dateKey, todo: welcomeTask }));

      const todoPayload = { ...welcomeTask };
      delete todoPayload.resources;

      dispatch(todoSlice.actions.addToQueue({
        type: 'INSERT',
        table: 'todos',
        payload: todoPayload
      }));

      dispatch(todoSlice.actions.addToQueue({
        type: 'INSERT',
        table: 'resources',
        payload: {
          id: resourceId,
          task_id: taskId,
          url: dummyUrl
        }
      }));

      dispatch(processSyncQueue());

      return [welcomeTask];
    } catch (error) {
      return rejectWithValue(error.message);
    }
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
        const processedIds = action.payload || [];
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
      })
      .addCase(fetchAllTodos.fulfilled, (state, action) => {
        const todos = action.payload || [];
        const itemsByDate = {};
        const dates = [];

        todos.forEach(todo => {
          const dateKey = todo.date_key;
          if (!itemsByDate[dateKey]) {
            itemsByDate[dateKey] = [];
          }
          const todoWithResources = { ...todo, resources: todo.resources || [] };
          itemsByDate[dateKey].push(todoWithResources);
          if (!dates.includes(dateKey)) {
            dates.push(dateKey);
          }
        });

        Object.keys(itemsByDate).forEach(date => {
          itemsByDate[date].sort((a, b) => {
            if (a.order_index !== b.order_index) {
              return (a.order_index || 0) - (b.order_index || 0);
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
        });

        state.itemsByDate = itemsByDate;
        state.datesWithTasks = dates;
      })
      .addCase(seedWelcomeTask.fulfilled, (state, action) => {
        const seeded = action.payload || [];
        seeded.forEach(todo => {
          const dateKey = todo.date_key;
          if (!state.itemsByDate[dateKey]) {
            state.itemsByDate[dateKey] = [];
          }
          if (!state.itemsByDate[dateKey].some(t => t.id === todo.id)) {
            state.itemsByDate[dateKey].push(todo);
          }
          if (!state.datesWithTasks.includes(dateKey)) {
            state.datesWithTasks.push(dateKey);
          }
        });
      });
  },
});

export const { addToQueue, addOptimistic, updateOptimistic, deleteOptimistic, reorderOptimistic, addResourceOptimistic, deleteResourceOptimistic } = todoSlice.actions;
export default todoSlice.reducer;

export const parseTaskTitle = (title) => {
  if (!title) return { cleanTitle: '', fromOriginalDate: null };
  const match = title.match(/\s\[from:(\d{2}-\d{2}-\d{4})\]$/);
  if (match) {
    return {
      cleanTitle: title.replace(/\s\[from:\d{2}-\d{2}-\d{4}\]$/, ''),
      fromOriginalDate: match[1]
    };
  }
  return {
    cleanTitle: title,
    fromOriginalDate: null
  };
};
