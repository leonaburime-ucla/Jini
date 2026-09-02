/**
 * @file `SharpImageTransformer` test (`image-transformer.sharp.ts`).
 *
 * `sharp` is an OPTIONAL runtime dependency of this package (see that file's
 * header — mirrors `identity/hasher.ts`'s treatment of `argon2`), but this
 * test statically imports it to exercise the real resize + format-conversion
 * success path, not just the honest-failure path — the same choice
 * `identity/__tests__/*.test.ts` makes for `argon2`. That means `sharp` must
 * be a real, installed devDependency of this package for this test to run;
 * see the package's `argon2` peerDependency/devDependency entries for the
 * precedent this mirrors.
 */
import assert from "node:assert/strict";
import { test } from "vitest";
import sharp from "sharp";

import { ImageSourceCorruptError, ImageTransformUnavailableError, SharpImageTransformer } from "../image-transformer.sharp.js";

test("SharpImageTransformer.transform actually resizes and re-encodes real image bytes", async () => {
  const transformer = new SharpImageTransformer();
  const sourcePng = await sharp({
    create: { width: 20, height: 10, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();

  const result = await transformer.transform({
    bytes: new Uint8Array(sourcePng),
    params: { width: 5, height: 5, format: "jpeg" },
  });

  assert.strictEqual(result.contentType, "image/jpeg");
  const outMeta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.strictEqual(outMeta.format, "jpeg");
  assert.strictEqual(outMeta.width, 5);
  assert.strictEqual(outMeta.height, 5);
  // Re-encoded output must differ from the untouched source bytes (never a passthrough).
  assert.notDeepStrictEqual(Buffer.from(result.bytes), sourcePng);
});

test("SharpImageTransformer.transform rejects genuinely invalid image bytes with a named ImageSourceCorruptError (not a silent fallback, and not an undifferentiated throw)", async () => {
  const transformer = new SharpImageTransformer();
  await assert.rejects(
    () =>
      transformer.transform({
        bytes: new TextEncoder().encode("not-real-image-bytes"),
        params: { width: 100, height: 100, format: "jpeg" },
      }),
    (error: unknown) => {
      assert.ok(error instanceof ImageSourceCorruptError, `expected ImageSourceCorruptError, got ${String(error)}`);
      return true;
    }
  );
});

// A minimal, deliberately-malformed GIF: a valid GIF89a signature/logical-screen-descriptor
// followed by a frame libvips (sharp's decoder) rejects — this is the SAME failure class the live
// defect this test guards against actually hit (a real, small user-uploaded GIF whose bytes pass
// this package's own magic-byte sniff, `sniffContentType`, yet cannot be decoded by `sharp`). Proves
// the fix does not only cover "not an image at all" but also "sniffs as an image, isn't really
// decodable" — the exact gap that produced an opaque 500 on the live route.
const MALFORMED_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
  0x08, 0x00, 0x08, 0x00, // 8x8 logical screen descriptor
  0x80, 0x00, 0x3f, // packed fields / bg color / aspect ratio
  0xff, 0xff, 0xc0, // truncated/invalid global color table + no valid image-descriptor/frame data
]);

test("SharpImageTransformer.transform rejects a malformed GIF that passes this package's own magic-byte sniff but is not really decodable", async () => {
  const transformer = new SharpImageTransformer();
  await assert.rejects(
    () => transformer.transform({ bytes: MALFORMED_GIF, params: { format: "webp" } }),
    (error: unknown) => {
      assert.ok(error instanceof ImageSourceCorruptError, `expected ImageSourceCorruptError, got ${String(error)}`);
      return true;
    }
  );
});

test("ImageTransformUnavailableError stays exported and instantiable for environments without 'sharp'", () => {
  const err = new ImageTransformUnavailableError("the 'sharp' npm package is not installed");
  assert.ok(err instanceof Error);
  assert.match(err.message, /sharp/i);
});
