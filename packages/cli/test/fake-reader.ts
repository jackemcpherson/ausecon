import type {
  AbsRequest,
  AbsSeries,
  RbaRequest,
  RbaSeries,
  ReadAbsError,
  ReadRbaError,
} from "@ausecon/core";
import { Effect, Layer } from "effect";

import { Reader } from "../src/reader";

/** A fake reader layer and the log of requests it received. */
export interface FakeReader {
  readonly layer: Layer.Layer<Reader>;
  readonly requests: ReadonlyArray<AbsRequest | RbaRequest>;
}

/** What the fake reader answers for each publisher. */
export interface FakeResults {
  readonly abs?: Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError>;
  readonly rba?: Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError>;
}

const NOT_EXPECTED = Effect.die("The command read from a publisher the test did not expect.");

/**
 * Build a reader that answers every request to a publisher with the same
 * result. A read from a publisher with no result is a defect.
 *
 * @param results - The Series to return, or the failure to fail with, for each
 * publisher.
 * @returns The layer and its request log.
 */
export const fakeReader = ({ abs = NOT_EXPECTED, rba = NOT_EXPECTED }: FakeResults): FakeReader => {
  const requests: Array<AbsRequest | RbaRequest> = [];

  const layer = Layer.succeed(Reader, {
    readAbs: (request) => {
      requests.push(request);

      return abs;
    },
    readRba: (request) => {
      requests.push(request);

      return rba;
    },
  });

  return { layer, requests };
};

/** A reader for runs that must not read: any request is a defect. */
export const noReads: FakeReader = fakeReader({
  abs: Effect.die("The command read when it must not."),
  rba: Effect.die("The command read when it must not."),
});
