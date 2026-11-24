export interface IResponse<T = any> {
  status: number;
  data: T;
  msg: string;
}
