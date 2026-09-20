import type { ReceiptContentType } from '@stampp/domain';
import { createHash, createHmac } from 'node:crypto';
import { ENV } from '~/server/utils/env.ts';

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
};

export type SignedStorageRequest = {
  url: string;
  headers: Record<string, string>;
};

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured');
    this.name = 'StorageNotConfiguredError';
  }
}

function readStorageConfig(): StorageConfig | null {
  const endpoint = ENV.STORAGE_ENDPOINT;
  const accessKey = ENV.STORAGE_ACCESS_KEY;
  const secretKey = ENV.STORAGE_SECRET_KEY;
  const bucket = ENV.STORAGE_BUCKET?.trim() ?? 'stampp';
  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }
  return {
    endpoint: endpoint.replace(/\/$/, ''),
    region: ENV.STORAGE_REGION?.trim() ?? 'us-east-1',
    bucket,
    accessKey,
    secretKey,
  };
}

export function isStorageConfigured(): boolean {
  return readStorageConfig() !== null;
}

function amzDate(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { dateStamp: iso.slice(0, 8), dateTime: `${iso}Z` };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildCanonicalUri(objectKey: string): string {
  return `/${encodeRfc3986(objectKey).replace(/%2F/g, '/')}`;
}

function signRequest(
  config: StorageConfig,
  method: string,
  objectKey: string,
  contentType: string,
  body: Uint8Array,
  date: Date,
): SignedStorageRequest {
  const endpoint = new URL(config.endpoint);
  const host = endpoint.host;
  const { dateStamp, dateTime } = amzDate(date);
  const payloadHash = sha256Hex(body);
  const canonicalUri = buildCanonicalUri(objectKey);
  const canonicalQuery = '';
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${dateTime}`,
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const dateKey = hmac(`AWS4${config.secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    url: `${config.endpoint}/${config.bucket}/${objectKey}`,
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateTime,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export async function putReceiptObject(
  objectKey: string,
  body: Uint8Array,
  contentType: ReceiptContentType,
): Promise<void> {
  const config = readStorageConfig();
  if (!config) {
    throw new StorageNotConfiguredError();
  }
  const signed = signRequest(config, 'PUT', objectKey, contentType, body, new Date());
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body: Buffer.from(body),
  });
  if (!response.ok) {
    throw new Error(`Receipt upload failed with status ${response.status}`);
  }
}

export async function getReceiptObject(
  objectKey: string,
  contentType: string,
): Promise<Uint8Array> {
  const config = readStorageConfig();
  if (!config) {
    throw new StorageNotConfiguredError();
  }
  const signed = signRequest(config, 'GET', objectKey, contentType, new Uint8Array(), new Date());
  const response = await fetch(signed.url, {
    method: 'GET',
    headers: signed.headers,
  });
  if (!response.ok) {
    throw new Error(`Receipt download failed with status ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
