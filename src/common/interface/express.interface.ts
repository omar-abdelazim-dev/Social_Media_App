import type { HUser } from "../../database/index.js";
import type { ICachedUser } from "./index.js";

// declare targets the core library module where express declares the base reqest interface
declare module "express-serve-static-core" {
  // reopen express request and add validate key
  interface Request {
    validate: any;
    user?: HUser | ICachedUser;
    rejectedFiles: { name: string; reason: string }[];
  }
}
