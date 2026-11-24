export type IFile = Express.Multer.File & {
  fullPath?: string;
  rejectedFiles?: string[];
};
