-- Migration para criar bucket messages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messages',
  'messages',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']::text[]
)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de segurança
CREATE POLICY "Mensagens públicas para visualização" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'messages' );

CREATE POLICY "Usuários autenticados podem enviar arquivos nas mensagens" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'messages' AND auth.role() = 'authenticated' );

CREATE POLICY "Usuários podem atualizar seus próprios arquivos"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'messages' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'messages' AND auth.uid() = owner );

CREATE POLICY "Usuários podem deletar seus próprios arquivos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'messages' AND auth.uid() = owner );
