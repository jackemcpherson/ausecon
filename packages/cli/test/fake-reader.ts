import type { AbsRequest, ReadAbsError, Series } from "@ausecon/core";
import { Effect, Layer } from "effect";

import { AbsReader } from "../src/reader";

/** A fake reader layer and the log of requests it received. */
export interface FakeReader {
  readonly layer: Layer.Layer<AbsReader>;
  readonly requests: ReadonlyArray<AbsRequest>;
}

/**
 * Build a reader that answers every request with the same result.
 *
 * @param result - The Series to return, or the failure to fail with.
 * @returns The layer and its request log.
 */
export const fakeReader = (
  result: Effect.Effect<ReadonlyArray<Series>, ReadAbsError>,
): FakeReader => {
  const requests: Array<AbsRequest> = [];

  const layer = Layer.succeed(AbsReader, {
    read: (request) => {
      requests.push(request);

      return result;
    },
  });

  return { layer, requests };
};

/** A reader for runs that must not read: any request is a defect. */
export const noReads: FakeReader = fakeReader(Effect.die("The command read when it must not."));
