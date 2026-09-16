insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
('academy-covers','academy-covers',true,null,null),
('avatars','avatars',true,null,null),
('creator-resources','creator-resources',true,null,null),
('product-previews','product-previews',true,null,null),
('tax-forms','tax-forms',false,null,null),
('vault-finds','vault-finds',true,null,null)
on conflict (id) do update set name=excluded.name, public=excluded.public;

update storage.buckets set file_size_limit=524288000 where id='audiobook-audio';
update storage.buckets set file_size_limit=52428800 where id='audiobook-manuscripts';
update storage.buckets set file_size_limit=10485760 where id='license-wallet-documents';