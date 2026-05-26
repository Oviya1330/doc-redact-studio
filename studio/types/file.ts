export interface S3File {
  key: string;          // e.g. "uploads/1df531b7-f314-4a12-b5c6-665be675c921.pdf"
  size: number;
  last_modified: string;
  url: string;
}