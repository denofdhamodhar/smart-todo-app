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
      carried_forward: false,
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
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    let count = 0;
    
    console.log("[processCarryForward] Starting. Today is:", today, "Yesterday is:", yesterday);
    console.log("[processCarryForward] Current itemsByDate keys:", Object.keys(state.todos.itemsByDate));

    // Get existing tasks for today to calculate start order_index for copies
    const todayItems = state.todos.itemsByDate[today] || [];
    let nextOrderIndex = todayItems.length > 0 ? Math.max(...todayItems.map(t => t.order_index || 0)) + 1 : 0;
    
    const yesterdayItems = state.todos.itemsByDate[yesterday] || [];
    yesterdayItems.forEach(task => {
      console.log(`[processCarryForward] Checking task ${task.id}: completed=${task.completed}, carried_forward=${task.carried_forward}`);
      if (!task.completed && !task.carried_forward) {
        console.log(`[processCarryForward] CARRYING FORWARD task: ${task.id}`);
        // 1. Mark original task as carried_forward = true (so it doesn't get processed again)
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

        // 2. Format the original date to show in the copy's title (DD-MM-YYYY)
        const parts = yesterday.split('-');
        const formattedOldDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : yesterday;

        // Strip any existing carry-forward markers from the title
        const cleanTitle = task.title
          .replace(/\s\(from\s\d{2}-\d{2}-\d{4}\)$/, '')
          .replace(/\s\[from:\d{2}-\d{2}-\d{4}\]$/, '');

        // 3. Create copied task with a new UUID and today's date
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
          priority: task.priority,
          carried_forward: false, // Can be carried forward tomorrow if incomplete today
          order_index: nextOrderIndex++,
          created_at: new Date().toISOString(),
          resources: copiedResources,
          note: task.note // Copy the note!
        };

        // 4. Add the copy optimistically to local Redux state
        dispatch(todoSlice.actions.addOptimistic({ 
          dateKey: today, 
          todo: copiedTask 
        }));

        // 5. Queue INSERT for the copied task in the syncQueue
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
            note: copiedTask.note // Include note in sync queue
          }
        }));

        // 6. Queue INSERTs for all copied resources
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
      const { data: todos, error } = await supabase
        .from('todos')
        .select(`*, resources (*)`)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return todos;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const seedOneYearTodos = createAsyncThunk(
  'todos/seedOneYearTodos',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const userId = state.auth.user?.id;
      if (!userId) throw new Error("No user ID found in auth state");

      const tasksToInsert = [];
      const sampleTasks = [
        { title: "Monthly goals review and planning 🎯", priority: "High" },
        { title: "Pay utility bills and rent 💳", priority: "Medium" },
        { title: "Mid-month progress check-in 📈", priority: "Medium" },
        { title: "Read 2 chapters of book 📚", priority: "Low" },
        { title: "Review notes and study guides 📝", priority: "High" },
        { title: "Team sync-up and project updates 👥", priority: "Medium" }
      ];

      // July 2026 (month 6) to May 2027 (month 4)
      for (let monthVal = 6; monthVal <= 16; monthVal++) {
        let m = monthVal;
        let y = 2026;
        if (m >= 12) {
          m = m - 12;
          y = 2027;
        }

        const monthStr = String(m + 1).padStart(2, '0');

        const daysToSeed = [
          { day: 1, taskIndices: [0, 1] },
          { day: 10, taskIndices: [2, 3] },
          { day: 20, taskIndices: [4, 5] }
        ];

        daysToSeed.forEach(({ day, taskIndices }) => {
          const dayStr = String(day).padStart(2, '0');
          const dateKey = `${y}-${monthStr}-${dayStr}`;

          taskIndices.forEach((taskIdx, orderIdx) => {
            const sample = sampleTasks[taskIdx];
            tasksToInsert.push({
              id: uuidv4(),
              user_id: userId,
              date_key: dateKey,
              title: sample.title,
              completed: false,
              priority: sample.priority,
              carried_forward: false,
              order_index: orderIdx,
              created_at: new Date().toISOString()
            });
          });
        });
      }

      const { error } = await supabase
        .from('todos')
        .insert(tasksToInsert);

      if (error) throw error;
      
      return tasksToInsert;
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
      .addCase(seedOneYearTodos.fulfilled, (state, action) => {
        const seeded = action.payload || [];
        seeded.forEach(todo => {
          const dateKey = todo.date_key;
          if (!state.itemsByDate[dateKey]) {
            state.itemsByDate[dateKey] = [];
          }
          if (!state.itemsByDate[dateKey].some(t => t.id === todo.id)) {
            state.itemsByDate[dateKey].push({ ...todo, resources: [] });
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
