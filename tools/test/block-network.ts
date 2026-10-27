import { beforeAll } from "vite-plus/test";

/**
 * Fail any test that reaches the network.
 *
 * Unit tests must use recorded fixtures. The live test project skips this file.
 */
beforeAll(() => {
  globalThis.fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString();

    return Promise.reject(new Error(`Network access is blocked in unit tests: ${url}`));
  };
});
