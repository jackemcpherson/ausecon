export { parseTable } from "./abs/table-parse";

export { readAbs, type ReadAbsError } from "./abs/time-series";

export { readRba, type ReadRbaError } from "./rba/statistical-tables";

export {
  AbsRequest,
  AbsSeries,
  AbsUnavailable,
  CatalogueNotFound,
  CatalogueNumber,
  InvalidRequest,
  Observation,
  RbaRequest,
  RbaSeries,
  RbaTable,
  RbaTableLayoutError,
  RbaTableNotFound,
  RbaTableNumber,
  RbaUnavailable,
  Series,
  SeriesId,
  SeriesNotFound,
  Table,
  TableId,
  TableNotFound,
  TableNumber,
  TimeSeriesDirectoryError,
  TableLayoutError,
} from "./types";
