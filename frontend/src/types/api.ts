export type LaravelPaginatorLink = {
  url: string | null;
  label: string;
  active: boolean;
};

export type LaravelPaginator<T> = {
  current_page: number;
  data: T[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;

  // optional fields Laravel includes (harmless if unused)
  first_page_url?: string;
  last_page_url?: string;
  next_page_url?: string | null;
  prev_page_url?: string | null;
  path?: string;
  links?: LaravelPaginatorLink[];
};

// backward compatible alias (in case other files use a different name)
export type LaravelPagination<T> = LaravelPaginator<T>;