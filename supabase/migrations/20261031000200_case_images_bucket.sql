-- Public bucket for case thumbnails and evidence pictures, uploaded from the admin screens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-images', 'case-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists case_images_read on storage.objects;
create policy case_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'case-images');

drop policy if exists case_images_admin_insert on storage.objects;
create policy case_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'case-images' and public.is_admin());

drop policy if exists case_images_admin_update on storage.objects;
create policy case_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'case-images' and public.is_admin())
  with check (bucket_id = 'case-images' and public.is_admin());

drop policy if exists case_images_admin_delete on storage.objects;
create policy case_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'case-images' and public.is_admin());
