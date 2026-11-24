import { isValidObjectId, Model, Types } from "mongoose";
import { exceptions, type IPgginate } from "../index.js";
import type {
  ApplyBasicCreateCasting,
  DeepPartial,
  DeleteResult,
  FlattenMaps,
  HydratedDocument,
  PopulateOptions,
  ProjectionType,
  QueryFilter,
  QueryOptions,
  Require_id,
  UpdateQuery,
  UpdateWriteOpResult,
  MongooseBaseQueryOptions,
  CreateOptions,
} from "mongoose";
import type { Abortable, CountOptions, DeleteOptions } from "mongodb";

type createObject<TRawDocType> = DeepPartial<
  ApplyBasicCreateCasting<Require_id<TRawDocType>>
>;

export default class BaseRepo<TRawDocType> {
  constructor(protected model: Model<TRawDocType>) {
    this.model = model;
  }

  // -------------------- CREATE ---------------------
  // create method signatures
  // first signature
  async create({
    data,
  }: {
    // parameters data types
    data: createObject<TRawDocType>;
  }): Promise<HydratedDocument<TRawDocType>>;

  // second signature
  async create({
    data,
    options,
  }: {
    // parameters data types
    data: createObject<TRawDocType>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDocType>[]>;

  // main function
  async create({
    data,
    options,
  }: {
    // parameters data types
    data: createObject<TRawDocType> | createObject<TRawDocType>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDocType> | HydratedDocument<TRawDocType>[]> {
    try {
      return await this.model.create(data as any, options);
    } catch (e) {
      throw new exceptions.BadRequestException("Something went wrong");
    }
  }

  // -------------------- FINDERS --------------------
  async paggination({
    filter = {},
    projection,
    options = {},
    page = 1,
    limit = 10,
    select,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType>;
    options?: QueryOptions<TRawDocType>;
    page?: number;
    limit?: number;
    select?: string | readonly string[];
  }): Promise<IPgginate<HydratedDocument<TRawDocType>>> {
    const skip = Math.max(0, (page - 1) * limit);
    const data = this.model.find(filter, projection, options).limit(limit);

    if (skip) data.skip(skip);
    if (options?.sort) data.sort(options.sort);
    if (select) data.select(select);

    const [result, count] = await Promise.all([
      data.exec(),
      this.model.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(count / limit) || 1;
    const hasNextPage = page < totalPages;

    return {
      data: result as HydratedDocument<TRawDocType>[],
      meta: {
        count,
        totalPages,
        currenPage: page,
        hasNextPage,
        hasPreviousPage: page > 1,
      },
    };
  }

  async countDocument({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    options?:
      | (CountOptions & MongooseBaseQueryOptions<TRawDocType> & Abortable)
      | null;
  }): Promise<number> {
    return this.model.countDocuments(filter, options);
  }

  async findOne({
    filter = {},
    projection,
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType>;
    options?: QueryOptions<TRawDocType>;
    // FlattenMaps works as lean
  }): Promise<HydratedDocument<TRawDocType> | FlattenMaps<TRawDocType> | null> {
    const query = this.model.findOne(filter, projection, options);
    if (options?.populate) {
      query?.populate(options.populate as PopulateOptions[]);
    }
    if (options?.lean) {
      // to remove the virtuals fields
      query?.lean(options.lean);
    }
    return query.exec();
  }

  async findById({
    id,
    select = "",
  }: {
    id: Types.ObjectId;
    select?: string | readonly string[];
  }): Promise<HydratedDocument<TRawDocType> | null> {
    if (!isValidObjectId(id)) {
      throw new exceptions.BadRequestException("Invalid ID");
    }
    return await this.model.findById(id).select(select);
  }

  // -------------------- UPADTE ---------------------
  async updateOne({
    filter = {},
    update = {},
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    update: UpdateQuery<TRawDocType>;
    options?: QueryOptions<TRawDocType>;
  }): Promise<UpdateWriteOpResult> {
    return await this.model.updateOne(filter, update);
  }

  async updateMany({
    filter = {},
    update = {},
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    update: UpdateQuery<TRawDocType>;
    options?: QueryOptions<TRawDocType>;
  }): Promise<UpdateWriteOpResult> {
    return await this.model.updateMany(filter, update);
  }

  async findByIdAndUpdate({
    id,
    update = {},
    options = { new: true },
  }: {
    id: Types.ObjectId;
    update?: UpdateQuery<TRawDocType>;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | null> {
    if (!isValidObjectId(id)) {
      throw new exceptions.BadRequestException("Invalid ID");
    }
    return await this.model.findByIdAndUpdate(id, update, options);
  }

  async findOneAndUpdate({
    filter,
    update = {},
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    update?: UpdateQuery<TRawDocType>;
    options?: QueryOptions<TRawDocType> | null;
  }) {
    return await this.model.findOneAndUpdate(filter, update, {
      ...options,
      returnDocument: "after",
    });
  }

  // -------------------- DELETE ---------------------
  async findByIdAndDelete({
    id,
    options = {},
  }: {
    id: Types.ObjectId;
    options?: QueryOptions;
  }) {
    if (!isValidObjectId(id)) {
      throw new exceptions.BadRequestException("Invalid ID");
    }
    return await this.model.findByIdAndDelete(id, options);
  }

  async deleteOne({
    filter = {},
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    options?: DeleteOptions & MongooseBaseQueryOptions<TRawDocType>;
  }): Promise<DeleteResult> {
    return await this.model.deleteOne(filter, options);
  }

  async deleteMany({
    filter = {},
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    options?: DeleteOptions & MongooseBaseQueryOptions<TRawDocType>;
  }): Promise<DeleteResult> {
    return await this.model.deleteMany(filter, options);
  }

  async findOneAndDelete({
    filter,
    options = {},
  }: {
    filter: QueryFilter<TRawDocType>;
    options?: QueryOptions<TRawDocType> | null;
  }) {
    return await this.model.findOneAndDelete(filter, options);
  }
}
