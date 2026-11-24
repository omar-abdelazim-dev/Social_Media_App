export interface ICreateToken {
  accessToken: string;
  refreshToken: string;
}

export interface ICachedUser {
  _id: string;
  credintialsChangedAt?: number;
  [key: string]: unknown;
}
