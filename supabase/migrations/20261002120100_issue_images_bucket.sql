-- Storage bucket for cover and page images. Images are public to read so the
-- site can show them by URL; only admins can upload, replace, or remove them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-images',
  'issue-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

create policy "Issue images are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'issue-images');

create policy "Admins can upload issue images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'issue-images' and public.is_admin());

create policy "Admins can replace issue images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'issue-images' and public.is_admin())
  with check (bucket_id = 'issue-images' and public.is_admin());

create policy "Admins can delete issue images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'issue-images' and public.is_admin());
