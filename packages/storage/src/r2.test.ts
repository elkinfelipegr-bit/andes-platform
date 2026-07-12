import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import {
  createStorageClient,
  storageConfigFromEnv,
  StorageConfigError,
  type StorageConfig,
} from "./r2.js";

const config: StorageConfig = {
  endpoint: "https://test-account.r2.cloudflarestorage.com",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  bucket: "andes-test",
};

const KEY = "tenants/clx0tenant000000000000001/bim/m/v.ifc";

describe("storageConfigFromEnv", () => {
  it("reads the four R2 variables", () => {
    expect(
      storageConfigFromEnv({
        R2_ENDPOINT: config.endpoint,
        R2_ACCESS_KEY_ID: config.accessKeyId,
        R2_SECRET_ACCESS_KEY: config.secretAccessKey,
        R2_BUCKET: config.bucket,
      }),
    ).toEqual(config);
  });

  it("names every missing variable", () => {
    expect(() =>
      storageConfigFromEnv({ R2_ENDPOINT: config.endpoint }),
    ).toThrow(/R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET/);
  });

  it("rejects blank values (the Vercel sensitive-pull gotcha)", () => {
    expect(() =>
      storageConfigFromEnv({
        R2_ENDPOINT: config.endpoint,
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: config.secretAccessKey,
        R2_BUCKET: config.bucket,
      }),
    ).toThrow(StorageConfigError);
  });
});

describe("presigned URLs (offline signing against a real client)", () => {
  const storage = createStorageClient(config);

  it("signs a PUT under the bucket path with the requested expiry", async () => {
    const url = await storage.presignedPutUrl(KEY, {
      contentType: "application/x-step",
      contentLength: 1234,
      expiresIn: 900,
    });
    expect(url.startsWith(`${config.endpoint}/${config.bucket}/${KEY}?`)).toBe(
      true,
    );
    expect(url).toContain("X-Amz-Expires=900");
    expect(url).toContain("X-Amz-Signature=");
  });

  it("signs a GET with the default expiry", async () => {
    const url = await storage.presignedGetUrl(KEY);
    expect(url.startsWith(`${config.endpoint}/${config.bucket}/${KEY}?`)).toBe(
      true,
    );
    expect(url).toContain("X-Amz-Expires=900");
  });

  it("rejects out-of-range expiries", async () => {
    await expect(
      storage.presignedGetUrl(KEY, { expiresIn: 0 }),
    ).rejects.toThrow(StorageConfigError);
    await expect(
      storage.presignedGetUrl(KEY, { expiresIn: 7200 }),
    ).rejects.toThrow(StorageConfigError);
  });
});

describe("headObject", () => {
  function fakeS3(send: (command: unknown) => Promise<unknown>): S3Client {
    return { send } as unknown as S3Client;
  }

  it("returns size and content type when the object exists", async () => {
    const storage = createStorageClient(
      config,
      fakeS3(async () => ({
        ContentLength: 42,
        ContentType: "application/x-step",
      })),
    );
    expect(await storage.headObject(KEY)).toEqual({
      size: 42,
      contentType: "application/x-step",
    });
  });

  it("returns null on NotFound", async () => {
    const notFound = Object.assign(new Error("not found"), {
      name: "NotFound",
    });
    const storage = createStorageClient(
      config,
      fakeS3(async () => {
        throw notFound;
      }),
    );
    expect(await storage.headObject(KEY)).toBeNull();
  });

  it("returns null on a bare 404", async () => {
    const err = Object.assign(new Error("404"), {
      $metadata: { httpStatusCode: 404 },
    });
    const storage = createStorageClient(
      config,
      fakeS3(async () => {
        throw err;
      }),
    );
    expect(await storage.headObject(KEY)).toBeNull();
  });

  it("rethrows anything else", async () => {
    const boom = Object.assign(new Error("denied"), { name: "AccessDenied" });
    const storage = createStorageClient(
      config,
      fakeS3(async () => {
        throw boom;
      }),
    );
    await expect(storage.headObject(KEY)).rejects.toThrow("denied");
  });
});
