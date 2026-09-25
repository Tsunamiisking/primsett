import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'],
  api_key: process.env['CLOUDINARY_API_KEY'],
  api_secret: process.env['CLOUDINARY_API_SECRET'],
  secure: true,
});

export { cloudinary };

/** Upload a buffer to Cloudinary. Returns the secure URL and public_id. */
export async function uploadBuffer(
  buffer: Buffer,
  options: {
    folder: string;
    publicId: string;
    transformation?: object[];
  },
): Promise<{ url: string; thumbnailUrl: string; publicId: string }> {
  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: 'image',
          transformation: options.transformation,
        },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        },
      );
      stream.end(buffer);
    },
  );

  // Thumbnail via Cloudinary URL transformation — no extra upload needed
  const thumbnailUrl = cloudinary.url(result.public_id, {
    width: 400,
    height: 400,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto',
  });

  return {
    url: result.secure_url,
    thumbnailUrl,
    publicId: result.public_id,
  };
}

/** Download media from Meta (WhatsApp image URL) and return a buffer. */
export async function downloadMetaMedia(mediaId: string): Promise<Buffer> {
  const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'];

  // Step 1: resolve media URL
  const urlRes = await fetch(
    `https://graph.facebook.com/v19.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const { url } = await urlRes.json() as { url: string };

  // Step 2: download binary
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const arrayBuffer = await mediaRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
