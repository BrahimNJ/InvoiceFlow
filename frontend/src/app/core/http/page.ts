/** One page of a list endpoint (backend `common.web.PageResponse`). `page` is zero-based. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
