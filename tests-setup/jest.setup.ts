import "@testing-library/jest-dom";

try {
  // Optional MSW support if tests/mocks/server is defined.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { server } = require("../tests/mocks/server");

  if (server) {
    beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
  }
} catch {
  // MSW not configured yet.
}
