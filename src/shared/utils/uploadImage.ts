import { supabase } from '@/infrastructure/supabase/client';

export type UploadPublicImageInput = {
  bucket: string;
  folderPath: string;
  file: File;
};

export type UploadPublicImageResult = {
  objectPath: string;
  publicUrl: string;
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export async function uploadPublicImage(input: UploadPublicImageInput): Promise<UploadPublicImageResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(input.file.type)) {
    throw new Error('Formato inválido. Utilize JPG, PNG ou WEBP.');
  }

  if (input.file.size > MAX_IMAGE_SIZE) {
    throw new Error('A imagem deve possuir no máximo 2 MB.');
  }

  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const randomId = crypto.randomUUID();
  const objectPath = `${input.folderPath}/${randomId}.${extension}`;

  const { error } = await supabase.storage
    .from(input.bucket)
    .upload(objectPath, input.file, {
      upsert: false,
      contentType: input.file.type,
      cacheControl: '3600',
    });

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(input.bucket)
    .getPublicUrl(objectPath);

  return { objectPath, publicUrl };
}
