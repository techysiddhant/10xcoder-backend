const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export function isResourceType(value: string): value is "video" | "article" {
  return value === "video" || value === "article";
}
export function isValidImageType(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type as any);
}
export function isValidImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return { valid: false, error: "Invalid image type" };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { valid: false, error: "Image too large (max 2MB)" };
  }

  return { valid: true };
}
