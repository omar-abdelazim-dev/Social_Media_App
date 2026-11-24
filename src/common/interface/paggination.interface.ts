export interface IPgginate<T> {
  data: T[];
  meta: {
    count: number;
    totalPages: number;
    currenPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
