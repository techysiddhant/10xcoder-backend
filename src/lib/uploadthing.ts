import { createUploadthing, type FileRouter } from "uploadthing/server";

const f = createUploadthing();

export const uploadRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "2MB",
      maxFileCount: 1,
    },
  }).onUploadComplete((data) => {
    console.log("upload completed", data.metadata);
    return { metadata: data.metadata };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
