import type { IPost } from "../interface/post.interface.js";
import BaseRepo from "./base.repo.js";
import { postModel } from "../../database/models/post.model.js";
import type { ProjectionType, QueryFilter } from "mongoose";
import type { QueryOptions } from "mongoose";

export class PostRepo extends BaseRepo<IPost> {
  constructor() {
    super(postModel);
  }

  async findMany({
    filter = {},
    projection = null,
    options = {},
  }: {
    filter?: QueryFilter<IPost>;
    projection?: ProjectionType<IPost> | null;
    options?: QueryOptions<IPost>;
  }): Promise<IPost[]> {
    return await this.model.find(filter, projection, options);
  }
}
export const postRepo = new PostRepo();
