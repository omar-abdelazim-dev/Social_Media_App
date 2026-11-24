import { z } from "zod";
import { signupSchema } from "../auth.validation.js";

// export type signUpDTO = {
//   name: string;
//   email: string;
//   password: string;
// };

// save the body of the "signupSchema" to the "signUpDTO" so we used "ReturnType"
// infer take zod schema and retrun a type from it
export type signUpDTO = z.infer<ReturnType<typeof signupSchema>>["body"];
