import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  getUserSchema,
  handlePendingRequestSchema,
  searchUsersSchema,
  suggestUsersSchema,
  softDeleteSchema,
  userService,
  userUpdateSchema,
} from "./index.js";
import {
  roleBasedAccessMiddleware,
  respopnseFormatter,
  authMiddleware,
  validator,
  enums,
  multerLocal,
  fileTypes,
  processFiles,
  type IUser,
  type IFile,
} from "../../common/index.js";
import { Types } from "mongoose";
import type { HUser } from "../../database/index.js";

export const userRoter = Router({
  strict: true,
  caseSensitive: true,
});

userRoter.get(
  "/search",
  authMiddleware,
  validator(searchUsersSchema),
  respopnseFormatter(async (req: Request) => {
    const { q, page, limit } = req.validate.query;
    const data = await userService.searchUsers({
      user: req.user!,
      query: q,
      page,
      limit,
    });
    return { msg: "Users fetched", status: 200, data };
  }),
);

userRoter.get(
  "/suggestions",
  authMiddleware,
  validator(suggestUsersSchema),
  respopnseFormatter(async (req: Request) => {
    const { page, limit } = req.validate.query;
    const data = await userService.suggestUsers({
      user: req.user!,
      page,
      limit,
    });
    return { msg: "User suggestions fetched", status: 200, data };
  }),
);

userRoter.delete(
  "/softDelete",
  validator(softDeleteSchema),
  authMiddleware,
  roleBasedAccessMiddleware([enums.roleEnum.admin]),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.softDelete({
        userId: req.body.userId,
      });
      return {
        data,
        msg: "User soft deleted",
      };
    },
  ),
);

userRoter.delete(
  "/hardDelete",
  validator(softDeleteSchema),
  authMiddleware,
  roleBasedAccessMiddleware([enums.roleEnum.admin]),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.hardDelete({
        userId: req.body.userId,
      });
      return {
        data,
        msg: "User hard deleted",
      };
    },
  ),
);

userRoter.get(
  "/getUser/:userId",
  roleBasedAccessMiddleware([enums.roleEnum.admin]),
  validator(getUserSchema),
  authMiddleware,
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.getUser({
        userId: new Types.ObjectId(req.validate.params.userId),
      });
      return {
        data,
        msg: "User fetched",
      };
    },
  ),
);

userRoter.patch(
  "/restore/:userId",
  roleBasedAccessMiddleware([enums.roleEnum.admin]),
  validator(getUserSchema),
  authMiddleware,
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.restore({
        userId: new Types.ObjectId(req.validate.params.userId),
      });
      return {
        data,
        msg: "User restored",
      };
    },
  ),
);

userRoter.put(
  "/update",
  validator(userUpdateSchema),
  authMiddleware,
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.update({
        user: req.user as HUser,
        userData: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          accountPrivacy: req.body.accountPrivacy,
        },
      });
      return {
        data,
        msg: "User updated",
      };
    },
  ),
);

userRoter.put(
  "/adminUpdate/:userId",
  roleBasedAccessMiddleware([enums.roleEnum.admin]),
  validator(userUpdateSchema),
  authMiddleware,
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.adminUpdate({
        userId: req.params.userId as string,
        userData: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
        },
      });
      return {
        data,
        msg: "User updated",
      };
    },
  ),
);

userRoter.patch(
  "/image",
  authMiddleware,
  multerLocal({
    fileType: fileTypes.images!,
    customPath: "profile",
  }).single("image"),
  processFiles({
    fileType: fileTypes.images!,
  }),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const key: string = await userService.upadteImage({
        user: req.user!,
        file: req.file!,
      });
      return {
        msg: "Image uploaded",
        data: { key },
      };
    },
  ),
);

userRoter.patch(
  "/preSignedImage",
  authMiddleware,
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const key: string = await userService.preSignedupadteImage({
        user: req.user!,
        data: req.body,
      });
      return {
        msg: "URL created",
        data: { key },
      };
    },
  ),
);

userRoter.patch(
  "/coverImages",
  authMiddleware,
  multerLocal({
    fileType: fileTypes.images!,
    customPath: "profile",
  }).array("images"),
  processFiles({
    fileType: fileTypes.images!,
  }),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const keys: string[] = await userService.updloadCoverImages({
        user: req.user!,
        files: req.files! as IFile[],
      });
      return {
        msg: "Image uploaded",
        data: { keys },
      };
    },
  ),
);

userRoter.post(
  "/largImage",
  authMiddleware,
  multerLocal({
    fileType: fileTypes.images!,
    customPath: "profile",
  }).single("image"),
  processFiles({
    fileType: fileTypes.images!,
  }),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const data = await userService.updloadLargImage({
        user: req.user!,
        file: req.file!,
      });
      return {
        msg: "Image uploaded",
        data,
      };
    },
  ),
);

userRoter.post(
  "/follow/:userId",
  authMiddleware,
  validator(getUserSchema),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = await userService.followUser({
        currentUser: req.user!,
        targetUserId: req.params.userId as string,
      });
      return {
        msg: result,
        status: 200,
        data: null,
      };
    },
  ),
);

userRoter.post(
  "/unfollow/:userId",
  authMiddleware,
  validator(getUserSchema),
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = await userService.unfollowUser({
        currentUser: req.user!,
        targetUserId: req.params.userId as string,
      });
      return {
        msg: result,
        status: 200,
        data: null,
      };
    },
  ),
);

userRoter.get(
  "/pendingRequest",
  authMiddleware,
  respopnseFormatter(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = await userService.getPendingRequest(req.user!);
      return {
        msg: "Pending requests fetched",
        status: 200,
        data: result,
      };
    },
  ),
);

userRoter.post(
  "/pendingRequest/:userId",
  authMiddleware,
  validator(handlePendingRequestSchema),
  respopnseFormatter(async (req: Request) => {
    const result = await userService.handlePendingRequest({
      currentUser: req.user!,
      requesterId: req.validate.params.userId,
      status: req.validate.body.status,
      followBack: req.validate.body.followBack,
    });
    return {
      msg: result.msg,
      status: 200,
      data: { followBack: result.followBack },
    };
  }),
);

userRoter.post(
  "/block/:userId",
  authMiddleware,
  validator(getUserSchema),
  respopnseFormatter(async (req: Request) => {
    const result = await userService.blockUser({
      currentUser: req.user!,
      targetUserId: req.validate.params.userId,
    });
    return { msg: result, status: 200, data: null };
  }),
);

userRoter.post(
  "/unblock/:userId",
  authMiddleware,
  validator(getUserSchema),
  respopnseFormatter(async (req: Request) => {
    const result = await userService.unblockUser({
      currentUser: req.user!,
      targetUserId: req.validate.params.userId,
    });
    return { msg: result, status: 200, data: null };
  }),
);
