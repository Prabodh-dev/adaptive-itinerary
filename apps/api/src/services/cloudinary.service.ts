export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  filename: string
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary is not configured. Missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET.");
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append("file", blob, filename);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown Cloudinary error");
    throw new Error(`Cloudinary upload failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error("Cloudinary upload succeeded but secure_url is missing.");
  }

  return payload.secure_url;
}
