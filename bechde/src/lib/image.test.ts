import { describe, it, expect } from "vitest";
import { validateImage } from "./image";

// validateImage works on the File interface but only reads `.type`, `.size` and
// `.name` — no actual file contents needed.
function fakeFile(name: string, size: number, type: string): File {
  // A minimal File-like that satisfies validateImage's property reads.
  return { name, size, type } as unknown as File;
}

describe("validateImage", () => {
  it("accepts a normal JPEG under the limit", () => {
    expect(validateImage(fakeFile("photo.jpg", 2_000_000, "image/jpeg"))).toBeNull();
  });

  it("accepts a WebP under the limit", () => {
    expect(validateImage(fakeFile("photo.webp", 500_000, "image/webp"))).toBeNull();
  });

  it("rejects a file over the default 10 MB limit", () => {
    const err = validateImage(fakeFile("huge.jpg", 15_000_000, "image/jpeg"));
    expect(err).toMatch(/15\.0 MB/);
    expect(err).toMatch(/under 10 MB/);
  });

  it("rejects a file over a custom limit", () => {
    const err = validateImage(fakeFile("big.png", 3_000_000, "image/png"), 2_000_000);
    expect(err).toMatch(/3\.0 MB/);
    expect(err).toMatch(/under 2 MB/);
  });

  it("rejects a non-image MIME type", () => {
    const err = validateImage(fakeFile("doc.pdf", 100_000, "application/pdf"));
    expect(err).toMatch(/isn't an image/);
  });

  it("accepts uncommon image types that start with image/", () => {
    expect(validateImage(fakeFile("photo.tiff", 500_000, "image/tiff"))).toBeNull();
  });
});
