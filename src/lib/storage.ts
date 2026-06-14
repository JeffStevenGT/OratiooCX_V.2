/**
 * lib/storage.ts — Cloudflare R2 con URLs Prefirmadas
 * ======================================================
 * Las grabaciones y documentos NUNCA se sirven con URL pública.
 * Cada acceso genera una URL temporal (5 min) firmada con las
 * credenciales del bucket.
 *
 * En desarrollo local: guarda en carpeta uploads/ con firma simulada.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// ── Detectar entorno ──────────────────────────
const IS_LOCAL = !process.env.R2_ENDPOINT;

// ── Cliente S3 compatible con R2 ─────────────
const s3 = IS_LOCAL ? null : new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/** @deprecated VPBX almacena grabaciones 1 año nativo. R2 ya no se usa. */
const BUCKET = process.env.R2_BUCKET_NAME || '';
const LOCAL_UPLOADS = path.join(process.cwd(), 'uploads');

// Asegurar que la carpeta local existe
if (IS_LOCAL && !fs.existsSync(LOCAL_UPLOADS)) {
  fs.mkdirSync(LOCAL_UPLOADS, { recursive: true });
}

// ── Subir archivo ─────────────────────────────
export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const key = `${randomUUID()}-${filename}`;

  if (IS_LOCAL) {
    // Local: guardar en carpeta
    const localPath = path.join(LOCAL_UPLOADS, key);
    fs.writeFileSync(localPath, file);
    return `local://${key}`;
  }

  await s3!.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  }));

  return key;
}

// ── URL Prefirmada (5 min de validez) ─────────
export async function getSecureUrl(fileKey: string, expiresInSeconds: number = 300): Promise<string> {
  if (IS_LOCAL) {
    // Local: devolver ruta directa con token simulado
    const token = createHash('sha256')
      .update(fileKey + Date.now())
      .digest('hex')
      .slice(0, 16);
    return `/api/files/${fileKey}?token=${token}&expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
  });

  return await getSignedUrl(s3!, command, { expiresIn: expiresInSeconds });
}

// ── Eliminar archivo ──────────────────────────
export async function deleteFile(fileKey: string): Promise<void> {
  if (IS_LOCAL) {
    const localPath = path.join(LOCAL_UPLOADS, fileKey);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    return;
  }

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  await s3!.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
  }));
}

// ── Servir archivo local (desarrollo) ─────────
export async function serveLocalFile(fileKey: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!IS_LOCAL) return null;

  const localPath = path.join(LOCAL_UPLOADS, fileKey);
  if (!fs.existsSync(localPath)) return null;

  const buffer = fs.readFileSync(localPath);
  const contentType = getContentType(fileKey);
  return { buffer, contentType };
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
}
