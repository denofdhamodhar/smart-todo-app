import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

// Async thunks for Supabase interactions
export const fetchTodos = createAsyncThunk(
  'todos/fetchTodos',
  async (dateKey, { rejectWithValue }) => {
    try {
      const { data: todos, error } = await supabase
        .from('todos')
        .select(`
          *,
          resources (*)
        `)
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

export const processCarryForward = createAsyncThunk(
  'todos/carryForward',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const userId = state.auth.user?.id;
      if (!userId) return;

      const today = format(new Date(), 'yyyy-MM-dd');

      // Get incomplete tasks from past dates
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false)
        .lt('date_key', today);

      if (error) throw error;
      if (!data || data.length === 0) return { count: 0 };

      // Update them to today
      const updates = data.map(task => ({
        id: task.id,
        date_key: today,
        priority: 'High',
        carried_forward: true
      }));

      // In Supabase, upsert requires the whole row or just the updated fields if id is primary key? 
      // Actually, update doesn't take an array for bulk updates in standard supabase-js v2 unless doing upsert.
      // Upsert requires all non-nullable fields if it might insert, but since we include id, it updates.
      // But it's safer to just fetch and update one by one or use an rpc. 
      // Let's just use a loop since it's a client side operation and user usually has few overdue tasks.
      for (const update of updates) {
         await supabase.from('todos').update(update).eq('id', update.id);
      }
      
      return { count: updates.length, today };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDatesWithTasks = createAsyncThunk(
  'todos/fetchDatesWithTasks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const userId = state.auth.user?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from('todos')
        .select('date_key')
        .eq('user_id', userId);

      if (error) throw error;
      return [...new Set(data.map(t => t.date_key))];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addTodo = createAsyncThunk(
  'todos/addTodo',
  async ({ title, priority, dateKey, userId }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const items = state.todos.itemsByDate[dateKey] || [];
      const orderIndex = items.length > 0 ? Math.max(...items.map(t => t.order_index || 0)) + 1 : 0;

      const { data, error } = await supabase
        .from('todos')
        .insert([{ title, priority, date_key: dateKey, user_id: userId, order_index: orderIndex }])
        .select()
        .single();

      if (error) throw error;
      return { ...data, resources: [] };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateTodo = createAsyncThunk(
  'todos/updateTodo',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteTodo = createAsyncThunk(
  'todos/deleteTodo',
  async (id, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) throw error;
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const reorderTodos = createAsyncThunk(
  'todos/reorderTodos',
  async ({ dateKey, newOrder }, { dispatch, rejectWithValue }) => {
    try {
      // Create order updates based on index
      const updatedOrder = newOrder.map((task, index) => ({ ...task, order_index: index }));
      
      // Optimistically update UI
      dispatch(reorderOptimisticTodos({ dateKey, newOrder: updatedOrder }));

      // Find tasks whose index has changed
      const updates = updatedOrder.map((task, index) => {
        // if we are sure it needs update, we just send it.
        return { id: task.id, order_index: index };
      });

      // Update sequentially to avoid overwhelming free tier connections, or concurrently for small batches
      await Promise.all(updates.map(update => 
        supabase.from('todos').update({ order_index: update.order_index }).eq('id', update.id)
      ));

      return { dateKey, newOrder: updatedOrder };
    } catch (error) {
       return rejectWithValue(error.message);
    }
  }
);

export const addResource = createAsyncThunk(
  'todos/addResource',
  async ({ taskId, url }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .insert([{ task_id: taskId, url }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteResource = createAsyncThunk(
  'todos/deleteResource',
  async (id, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from('resources').delete().eq('id', id);
      if (error) throw error;
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  itemsByDate: {}, // { 'YYYY-MM-DD': [todos...] }
  datesWithTasks: [],
  loading: false,
  error: null,
};

const todoSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    // For optimistic UI updates
    setOptimisticTodo: (state, action) => {
      const { date_key, todo } = action.payload;
      if (!state.itemsByDate[date_key]) {
        state.itemsByDate[date_key] = [];
      }
      state.itemsByDate[date_key].push(todo);
    },
    updateOptimisticTodo: (state, action) => {
      const { date_key, id, updates } = action.payload;
      if (state.itemsByDate[date_key]) {
        const index = state.itemsByDate[date_key].findIndex(t => t.id === id);
        if (index !== -1) {
          state.itemsByDate[date_key][index] = { ...state.itemsByDate[date_key][index], ...updates };
        }
      }
    },
    removeOptimisticTodo: (state, action) => {
      const { date_key, id } = action.payload;
      if (state.itemsByDate[date_key]) {
        state.itemsByDate[date_key] = state.itemsByDate[date_key].filter(t => t.id !== id);
      }
    },
    reorderOptimisticTodos: (state, action) => {
      const { dateKey, newOrder } = action.payload;
      // We need to merge the newOrder with the completed tasks because newOrder only contains active tasks
      if (state.itemsByDate[dateKey]) {
        const completedTasks = state.itemsByDate[dateKey].filter(t => t.completed);
        state.itemsByDate[dateKey] = [...newOrder, ...completedTasks];
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.loading = false;
        state.itemsByDate[action.payload.dateKey] = action.payload.todos;
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addTodo.fulfilled, (state, action) => {
        const todo = action.payload;
        if (!state.itemsByDate[todo.date_key]) {
          state.itemsByDate[todo.date_key] = [];
        }
        // Replace optimistic if exists by id, else push
        const index = state.itemsByDate[todo.date_key].findIndex(t => t.id === todo.id);
        if (index === -1) {
            state.itemsByDate[todo.date_key].push(todo);
        } else {
            state.itemsByDate[todo.date_key][index] = todo;
        }
        
        // Add to datesWithTasks
        if (!state.datesWithTasks.includes(todo.date_key)) {
            state.datesWithTasks.push(todo.date_key);
        }
      })
      .addCase(updateTodo.fulfilled, (state, action) => {
        const updated = action.payload;
        if (state.itemsByDate[updated.date_key]) {
          const index = state.itemsByDate[updated.date_key].findIndex(t => t.id === updated.id);
          if (index !== -1) {
            // keep resources intact if the update response doesn't return them
            const resources = state.itemsByDate[updated.date_key][index].resources || [];
            state.itemsByDate[updated.date_key][index] = { ...updated, resources };
          }
        }
      })
      .addCase(deleteTodo.fulfilled, (state, action) => {
        const id = action.payload;
        // Search and remove across all dates (or we could pass dateKey in payload)
        Object.keys(state.itemsByDate).forEach(date => {
          state.itemsByDate[date] = state.itemsByDate[date].filter(t => t.id !== id);
        });
      })
      .addCase(addResource.fulfilled, (state, action) => {
        const resource = action.payload;
        Object.keys(state.itemsByDate).forEach(date => {
          const todoIndex = state.itemsByDate[date].findIndex(t => t.id === resource.task_id);
          if (todoIndex !== -1) {
            state.itemsByDate[date][todoIndex].resources.push(resource);
          }
        });
      })
      .addCase(deleteResource.fulfilled, (state, action) => {
        const id = action.payload;
        Object.keys(state.itemsByDate).forEach(date => {
          state.itemsByDate[date] = state.itemsByDate[date].map(todo => ({
            ...todo,
            resources: todo.resources.filter(r => r.id !== id)
          }));
        });
      })
      .addCase(processCarryForward.fulfilled, (state, action) => {
         // If we carried forward, we could clear the today cache to force refetch,
         // or we can just rely on the component fetching it.
         if (action.payload?.count > 0 && action.payload?.today) {
           delete state.itemsByDate[action.payload.today];
           if (!state.datesWithTasks.includes(action.payload.today)) {
             state.datesWithTasks.push(action.payload.today);
           }
         }
      })
      .addCase(fetchDatesWithTasks.fulfilled, (state, action) => {
         state.datesWithTasks = action.payload;
      });
  },
});

export const { setOptimisticTodo, updateOptimisticTodo, removeOptimisticTodo, reorderOptimisticTodos } = todoSlice.actions;
export default todoSlice.reducer;
