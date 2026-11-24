import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import * as routers from "./modules/index.js";
import { errorHandler } from "./common/middleware/index.js";
import { dbConnection } from "./database/index.js";
import { resolve } from "path";
import cors from "cors";
import { s3Service } from "./common/services/s3.service.js";
import { pipeline } from "stream";
import { promisify } from "util";
import { services } from "./common/index.js";

// convert any function into async function
const s3Get = promisify(pipeline);
const app = express();
app.use(express.json(), cors());
await dbConnection();

app.use("/upload", express.static(resolve("uploads")));
app.use("/auth", routers.authRouter);
app.use("/user", routers.userRoter);
app.use("/post", routers.postRouter);

app.get("/", (req: Request, res: Response, next: NextFunction): Response => {
  return res.status(200).json({
    msg: "Server is health",
  });
});

app.post(
  "/",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    await services.notificationService.sendNotification({
      token: req.body.token,
      title: req.body.title,
      body: req.body.data,
    });
    return res.status(200).json({
      msg: "Notification sent",
    });
  },
);

app.post(
  "/notifications",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    await services.notificationService.sendNotifications({
      tokens: req.body.tokens,
      title: req.body.title,
      body: req.body.data,
    });
    return res.status(200).json({
      msg: "Notification sent",
    });
  },
);

app.get(
  // accept any number of parameters
  "/uploads/*path",
  async (req: Request, res: Response, next: NextFunction) => {
    let { download, filename } = req.query;
    const Key = (req.params.path as string[]).join("/");

    // ------------------------------- BOTH DO THE SAME ACTION -------------------------------
    // if (!filename) filename = (req.params.path as string[]).pop();
    // const { Body } = await s3Service.getAsset({
    //   Key,
    // });

    // must in deployment
    // res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    // only use if download
    // if (download == "true")
    //   res.setHeader(
    //     "content-Disposition",
    //     `attachrnent; filename="${filename}"`,
    //   );
    // connect the readableStream of the body to the writableStream of the response
    // s3Get(Body as ReadableStream, res);
    // ---------------------------------------------------------------------------------------

    const url: Promise<string> = s3Service.createGetPresignedUrl({
      Key,
      download: download == "true",
      filename: filename as string,
    });

    res.status(200).json({
      url,
    });
  },
);

app.use(errorHandler);
app.listen(3000, () => {
  console.log(`Server running on port 3000`);
});
