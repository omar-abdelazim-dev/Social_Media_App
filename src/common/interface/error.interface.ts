// inherite from Error -> name, message and stack 
export interface IError extends Error {
  status?: number;
  code?: number;
  statusCode?: number;
  errors?: Record<string, { message: string } | any>;
}