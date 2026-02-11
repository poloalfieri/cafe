create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  active boolean default true,
  created_at timestamptz default now()
);

create unique index if not exists menu_categories_branch_name_unique
  on menu_categories (branch_id, lower(name));
