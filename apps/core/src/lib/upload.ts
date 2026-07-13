// Direct-to-storage PUT with progress (ADR-008): bytes go browser→R2
// on a presigned URL; the app only ever sees the percentage.
export function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(`Storage rejected the upload (HTTP ${xhr.status}).`),
          );
    xhr.onerror = () =>
      reject(new Error("Network error while uploading to storage."));
    xhr.send(file);
  });
}
