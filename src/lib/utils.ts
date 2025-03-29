export function isResourceType(value: string): value is "video" | "article" {
  return value === "video" || value === "article";
}
export function isValidImageType(file: File): boolean {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  return allowedTypes.includes(file.type);
}
