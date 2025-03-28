export function isResourceType(value: string): value is "video" | "article" {
  return value === "video" || value === "article";
}
