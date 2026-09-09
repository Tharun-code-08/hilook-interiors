// Stub for the `server-only` package under test. The real module throws by
// design when imported outside a server component; vitest aliases it here so
// the modules that legitimately import it can be exercised.
export {};
