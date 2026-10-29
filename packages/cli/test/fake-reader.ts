import type {
  AbsRequest,
  AbsSeries,
  RbaRequest,
  RbaSeries,
  ReadAbsError,
  ReadRbaError,
  SeriesIndexEntry,
} from "@ausecon/core";
import { Effect, Layer } from "effect";

import { Reader } from "../src/reader";

/** A fake reader layer, the log of requests it received, and the words it searched for. */
export interface FakeReader {
  readonly layer: Layer.Layer<Reader>;
  readonly requests: ReadonlyArray<AbsRequest | RbaRequest>;
  readonly searches: ReadonlyArray<ReadonlyArray<string>>;
}

/** What the fake reader answers for each publisher. */
export interface FakeResults {
  readonly abs?: Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError>;
  readonly rba?: Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError>;
  /** The series index entries that every search returns, whatever its words. */
  readonly search?: ReadonlyArray<SeriesIndexEntry>;
}

const NOT_EXPECTED = Effect.die("The command read from a publisher the test did not expect.");

const SEARCH_NOT_EXPECTED = Effect.die("The command searched when the test did not expect it.");

/**
 * Build a reader that answers every request to a publisher with the same
 * result, and every search with the same entries. A read from a publisher
 * with no result, or a search with no entries given, is a defect.
 *
 * @param results - The Series to return, or the failure to fail with, for each
 * publisher, and the entries that a search returns.
 * @returns The layer, its request log, and its search log.
 */
export const fakeReader = ({
  abs = NOT_EXPECTED,
  rba = NOT_EXPECTED,
  search,
}: FakeResults): FakeReader => {
  const requests: Array<AbsRequest | RbaRequest> = [];
  const searches: Array<ReadonlyArray<string>> = [];

  const layer = Layer.succeed(Reader, {
    readAbs: (request) => {
      requests.push(request);

      return abs;
    },
    readRba: (request) => {
      requests.push(request);

      return rba;
    },
    search: (words) => {
      searches.push(words);

      return search === undefined ? SEARCH_NOT_EXPECTED : Effect.succeed(search);
    },
  });

  return { layer, requests, searches };
};

/** A reader for runs that must not read: any request is a defect. */
export const noReads: FakeReader = fakeReader({
  abs: Effect.die("The command read when it must not."),
  rba: Effect.die("The command read when it must not."),
});
