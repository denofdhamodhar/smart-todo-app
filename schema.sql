-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create todos table
create table if not exists todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  date_key date not null,
  title text not null,
  completed boolean default false,
  priority text check (priority in ('High', 'Medium', 'Low')) default 'Medium',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  carried_forward boolean default false,
  note text,
  order_index integer default 0
);

-- Create resources table
create table if not exists resources (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references todos on delete cascade not null,
  url text not null
);

-- Create Indexes
create index if not exists idx_date on todos(date_key);
create index if not exists idx_task on resources(task_id);

-- Enable Row Level Security (RLS)
alter table todos enable row level security;
alter table resources enable row level security;

-- Grant Table & Schema Permissions to Supabase API Roles (Fixes 403 Permission Denied)
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on table public.todos to postgres, anon, authenticated, service_role;
grant all privileges on table public.resources to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;

-- Policies for todos
drop policy if exists "Users can view their own todos" on todos;
drop policy if exists "Users can insert their own todos" on todos;
drop policy if exists "Users can update their own todos" on todos;
drop policy if exists "Users can delete their own todos" on todos;

create policy "Users can view their own todos" on todos for select using (auth.uid() = user_id);
create policy "Users can insert their own todos" on todos for insert with check (auth.uid() = user_id);
create policy "Users can update their own todos" on todos for update using (auth.uid() = user_id);
create policy "Users can delete their own todos" on todos for delete using (auth.uid() = user_id);

-- Policies for resources
drop policy if exists "Users can view resources of their todos" on resources;
drop policy if exists "Users can insert resources to their todos" on resources;
drop policy if exists "Users can update resources of their todos" on resources;
drop policy if exists "Users can delete resources of their todos" on resources;

create policy "Users can view resources of their todos" on resources for select 
using (exists (select 1 from todos where todos.id = resources.task_id and todos.user_id = auth.uid()));

create policy "Users can insert resources to their todos" on resources for insert 
with check (exists (select 1 from todos where todos.id = resources.task_id and todos.user_id = auth.uid()));

create policy "Users can update resources of their todos" on resources for update 
using (exists (select 1 from todos where todos.id = resources.task_id and todos.user_id = auth.uid()));

create policy "Users can delete resources of their todos" on resources for delete 
using (exists (select 1 from todos where todos.id = resources.task_id and todos.user_id = auth.uid()));
