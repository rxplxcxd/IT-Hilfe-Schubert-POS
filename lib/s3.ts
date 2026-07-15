import { supabaseAdmin } from './supabase/admin';

/**
 * Datei-Speicher ueber Supabase Storage.
 * Die Funktionsnamen/Signaturen bleiben identisch zur frueheren S3-Version,
 * damit die aufrufenden Routen unveraendert funktionieren.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';

function buildPath(fileName: string, isPublic: boolean): string {
  const safeName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = isPublic ? 'public/uploads' : 'uploads';
  return `${prefix}/${Date.now()}-${safeName}`;
}

/**
 * Erzeugt eine signierte Upload-URL. Der Client laedt die Datei per
 * HTTP PUT direkt zu dieser URL hoch (wie bisher).
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
) {
  const cloud_storage_path = buildPath(fileName, isPublic);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(cloud_storage_path);

  if (error || !data) {
    throw new Error(error?.message || 'Signierte Upload-URL konnte nicht erstellt werden');
  }

  // contentType wird beim PUT vom Client als Header mitgesendet.
  void contentType;
  return { uploadUrl: data.signedUrl, cloud_storage_path };
}

/**
 * Liefert eine abrufbare URL fuer eine gespeicherte Datei.
 * Oeffentliche Dateien -> permanente Public-URL.
 * Private Dateien -> signierte URL (1 Stunde gueltig).
 */
export async function getFileUrl(cloud_storage_path: string, isPublic: boolean = false) {
  if (isPublic) {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(cloud_storage_path);
    return data.publicUrl;
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(cloud_storage_path, 3600);

  if (error || !data) {
    throw new Error(error?.message || 'Signierte URL konnte nicht erstellt werden');
  }
  return data.signedUrl;
}

/**
 * Loescht eine Datei aus dem Storage-Bucket.
 */
export async function deleteFile(cloud_storage_path: string) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([cloud_storage_path]);
  if (error) {
    throw new Error(error.message);
  }
}
