import type z from "zod";
import { createPopstSchema } from "../index.js";
export type createPostDTO = z.infer<
  ReturnType<typeof createPopstSchema>
>["body"];
