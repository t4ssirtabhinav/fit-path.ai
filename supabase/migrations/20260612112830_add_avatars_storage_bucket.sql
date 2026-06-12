-- Public storage bucket for profile avatars. Files are stored under
-- {user_id}/... so RLS can restrict writes to the owner's own folder
-- while keeping read access public (avatars are shown to buddies too).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
on storage.objects for delete
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
