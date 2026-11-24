import { exceptions, type IFile } from "../index.js";
import { fileTypeFromBuffer, fileTypeFromFile } from "file-type";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import type { Request, RequestHandler } from "express";

export const fileTypes: Record<string, string[]> = {
  images: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
  pdfs: ["application/pdf"],
  vidoes: ["video/mp4"],
};

// ---------------------- FUNCTIONS --------------------------
const processSingleFile = async ({
  file,
  fileType,
}: {
  file: IFile;
  fileType: string[];
}): Promise<IFile | null> => {
  let result;

  // store on memory
  if (file.buffer) result = await fileTypeFromBuffer(file.buffer);
  // store on local storage
  else if (file.path) result = await fileTypeFromFile(file.path); // reading the file magic number

  // store the file mimeType
  const mime = result?.mime as string;

  // delete unsupported file
  if (!result || !fileType.includes(mime)) {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return null;
  }

  // if stored in memory
  if (file.buffer) {
    const folderPath = checkPath("./uploads");
    const fullPath = `${folderPath}/${Date.now()}.${result.ext}`;
    fs.writeFileSync(fullPath, file.buffer);
    file.fullPath = fullPath;
  }

  return file;
};

const checkPath = (fileName: string) => {
  const folderPath = path.resolve(fileName);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
  return folderPath;
};

const checkValidFiles = ({
  req,
  file,
  processed,
  approvedFiles,
}: {
  req: Request;
  file: IFile;
  processed: IFile | null;
  approvedFiles: IFile[];
}) => {
  req.rejectedFiles = req.rejectedFiles || [];
  if (processed) approvedFiles.push(processed);
  else {
    req.rejectedFiles.push({
      name: file.originalname,
      reason: "Invalid file type",
    });
  }
};

const processFilesList = async ({
  files,
  fileType,
  req,
}: {
  files: IFile[];
  fileType: string[];
  req: Request;
}): Promise<IFile[]> => {
  const approvedFiles: IFile[] = [];

  for (const file of files) {
    // check the magic number of the provided files
    const processed = await processSingleFile({
      file,
      fileType,
    });
    checkValidFiles({
      req,
      file,
      processed,
      approvedFiles,
    });
  }
  return approvedFiles;
};
// -----------------------------------------------------------

// store data on local storage
export const multerLocal = ({
  fileType,
  customPath,
}: {
  fileType: string[];
  customPath?: string;
}): multer.Multer => {
  const storage = multer.diskStorage({
    destination: (req: Request, file: IFile, cb: Function) => {
      let folderPath: string = checkPath(path.resolve("./uploads"));
      if (customPath) {
        folderPath = checkPath(path.resolve(`./uploads/${customPath}`));
      }
      cb(null, folderPath);
    },
    filename: (req: Request, file: IFile, cb: Function) => {
      cb(null, `${Date.now()}-${file.fieldname}-${file.originalname}`);
    },
  });

  const fileFilter = (req: Request, file: IFile, cb: FileFilterCallback) => {
    if (!fileType.includes(file.mimetype))
      cb(new exceptions.BadRequestException("Worng file type"));
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
  });
};

// store data on RAM
export const multerMemory = ({ fileType }: { fileType: string[] }) => {
  const storage = multer.memoryStorage();

  const fileFilter = (req: Request, file: IFile, cb: FileFilterCallback) => {
    if (!fileType.includes(file.mimetype)) {
      return cb(
        new exceptions.BadRequestException("This format is not supported"),
      );
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
  });
};

export const processFiles = ({
  fileType,
}: {
  fileType: string[];
}): RequestHandler => {
  return async (req, res, next) => {
    try {
      // Signle
      if (req.file) {
        // return file if approved || return nothing if rejected
        const [approved] = await processFilesList({
          files: [req.file],
          fileType,
          req,
        });
        req.file = approved ?? undefined;
        // Array
      } else if (Array.isArray(req.files) && req.files.length > 0) {
        req.files = await processFilesList({
          files: req.files,
          fileType,
          req,
        }); // keeps only valid files
        // Fields
      } else if (req.files && !Array.isArray(req.files)) {
        const filesByField = req.files;
        for (const key of Object.keys(filesByField)) {
          const files = filesByField[key];
          if (!files) continue;
          filesByField[key] = await processFilesList({
            files,
            fileType,
            req,
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
