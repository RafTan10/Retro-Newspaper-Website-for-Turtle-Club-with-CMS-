-- Issues (the papers in the stack) and their pages.

-- Admins -------------------------------------------------------------------
-- Every account in this list is an editor with full rights; there are no roles.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "Admins can see their own admin row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- security definer so policies can check the list without it being readable
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Issues -------------------------------------------------------------------
-- status only ever changes when an editor presses a button. Nothing in the
-- database hides, archives or deletes an issue on its own.
--   draft      not on the public site; new issues start here
--   published  on the stack
--   hidden     off the public site, still in the main CMS list
--   archived   off the public site, in the CMS archive tab

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  masthead text not null default 'Turtle Club',
  issue_number integer not null check (issue_number > 0),
  date date not null,
  headline text not null,
  excerpt text not null default '',
  cover_image text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'hidden', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  -- Copied from the editor's sign-in so the CMS can show "Edited by <email>"
  -- without reading auth.users
  updated_by_email text,
  -- Filled the first time the issue is published, never cleared
  published_at timestamptz,
  -- Set when an editor deletes the issue. It sits in "Recently deleted", off
  -- the public site, for 30 days; then the CMS removes it and its images for
  -- good (Storage files can't be removed from SQL, so it isn't a cron job).
  deleted_at timestamptz
);

create index issues_status_sort_idx on public.issues (status, sort_order);
create index issues_deleted_at_idx on public.issues (deleted_at) where deleted_at is not null;

-- Pages --------------------------------------------------------------------

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  type text not null check (type in ('photo', 'text')),
  image text,
  caption text,
  heading text,
  -- Text pages: sanitized HTML limited to p, br, strong, em, a[href]
  body text,
  "order" integer not null default 0,
  -- A photo page needs its image, a text page needs its copy
  constraint pages_content_matches_type check (
    (type = 'photo' and image is not null)
    or (type = 'text' and body is not null)
  )
);

create index pages_issue_order_idx on public.pages (issue_id, "order");

-- Who changed what, and when ----------------------------------------------

create or replace function public.stamp_issue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = auth.uid();
    new.updated_by_email = auth.jwt() ->> 'email';
    new.created_at = now();
    new.updated_at = now();
  elsif (to_jsonb(new) - 'sort_order') = (to_jsonb(old) - 'sort_order') then
    -- Only the stack position moved: not an edit, so editors who have the
    -- issue open don't get a false "someone else changed this" warning
    return new;
  else
    new.updated_at = now();
    new.updated_by = auth.uid();
    new.updated_by_email = auth.jwt() ->> 'email';
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger issues_stamp
  before insert or update on public.issues
  for each row execute function public.stamp_issue();

-- Editing a page counts as editing its issue
create or replace function public.touch_issue_from_page()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.issues set updated_at = now()
  where id = coalesce(new.issue_id, old.issue_id);
  return null;
end;
$$;

create trigger pages_touch_issue
  after insert or update or delete on public.pages
  for each row execute function public.touch_issue_from_page();

-- Saving -------------------------------------------------------------------
-- Saves an issue and its full list of pages in one transaction. For an
-- existing issue, p_expected_updated_at must match the stored updated_at, so a
-- later save never silently overwrites someone else's earlier one. Runs with
-- the caller's rights, so row level security still applies.

create or replace function public.save_issue(
  p_issue jsonb,
  p_pages jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.issues
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_issue ->> 'id', '')::uuid;
  v_row public.issues;
begin
  if v_id is null then
    insert into public.issues (slug, masthead, issue_number, date, headline, excerpt, cover_image, status, sort_order)
    values (
      p_issue ->> 'slug',
      coalesce(p_issue ->> 'masthead', 'Turtle Club'),
      (p_issue ->> 'issue_number')::integer,
      (p_issue ->> 'date')::date,
      p_issue ->> 'headline',
      coalesce(p_issue ->> 'excerpt', ''),
      nullif(p_issue ->> 'cover_image', ''),
      coalesce(p_issue ->> 'status', 'draft'),
      -- New issues go on top of the stack
      coalesce((select min(sort_order) - 1 from public.issues), 0)
    )
    returning * into v_row;
  else
    update public.issues set
      slug = p_issue ->> 'slug',
      masthead = coalesce(p_issue ->> 'masthead', masthead),
      issue_number = (p_issue ->> 'issue_number')::integer,
      date = (p_issue ->> 'date')::date,
      headline = p_issue ->> 'headline',
      excerpt = coalesce(p_issue ->> 'excerpt', ''),
      cover_image = nullif(p_issue ->> 'cover_image', ''),
      status = coalesce(p_issue ->> 'status', status)
    where id = v_id and updated_at = p_expected_updated_at
    returning * into v_row;

    if not found then
      if exists (select 1 from public.issues where id = v_id) then
        raise exception 'issue_conflict' using hint = 'Someone else changed this issue.';
      end if;
      raise exception 'issue_not_found';
    end if;
  end if;

  delete from public.pages
  where issue_id = v_row.id
    and id not in (
      select (x ->> 'id')::uuid from jsonb_array_elements(p_pages) x
      where nullif(x ->> 'id', '') is not null
    );

  insert into public.pages (id, issue_id, type, image, caption, heading, body, "order")
  select
    coalesce(nullif(x ->> 'id', '')::uuid, gen_random_uuid()),
    v_row.id,
    x ->> 'type',
    nullif(x ->> 'image', ''),
    x ->> 'caption',
    nullif(x ->> 'heading', ''),
    x ->> 'body',
    (x ->> 'order')::integer
  from jsonb_array_elements(p_pages) x
  on conflict (id) do update set
    type = excluded.type,
    image = excluded.image,
    caption = excluded.caption,
    heading = excluded.heading,
    body = excluded.body,
    "order" = excluded."order"
  -- a page can't be moved into another issue this way
  where public.pages.issue_id = excluded.issue_id;

  select * into v_row from public.issues where id = v_row.id;
  return v_row;
end;
$$;

-- Sets the stack order from a list of issue ids, first id on top
create or replace function public.reorder_issues(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.issues i
  set sort_order = o.position
  from unnest(p_ids) with ordinality as o(id, position)
  where i.id = o.id;
$$;

revoke all on function public.save_issue(jsonb, jsonb, timestamptz) from public, anon;
revoke all on function public.reorder_issues(uuid[]) from public, anon;
grant execute on function public.save_issue(jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.reorder_issues(uuid[]) to authenticated;

-- Row level security -------------------------------------------------------
-- Anyone can read published issues that aren't deleted, and their pages.
-- Admins can read everything (drafts, hidden, archived, recently deleted) and
-- are the only ones who can write.

alter table public.issues enable row level security;
alter table public.pages enable row level security;

create policy "Published issues are public"
  on public.issues for select
  to anon, authenticated
  using ((status = 'published' and deleted_at is null) or public.is_admin());

create policy "Admins can add issues"
  on public.issues for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can edit issues"
  on public.issues for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete issues"
  on public.issues for delete
  to authenticated
  using (public.is_admin());

create policy "Pages of published issues are public"
  on public.pages for select
  to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.issues i
      where i.id = pages.issue_id and i.status = 'published' and i.deleted_at is null
    )
  );

create policy "Admins can add pages"
  on public.pages for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can edit pages"
  on public.pages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete pages"
  on public.pages for delete
  to authenticated
  using (public.is_admin());
