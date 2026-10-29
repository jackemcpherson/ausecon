import { Schema } from "effect";

/**
 * The index build cannot go on: the tables page or a table cannot be
 * downloaded, or does not hold what the build needs. `url` names the page or
 * table, and `reason` says why.
 */
export class IndexBuildError extends Schema.TaggedError<IndexBuildError>()("IndexBuildError", {
  url: Schema.String,
  reason: Schema.String,
}) {
  override get message(): string {
    return `${this.url}: ${this.reason}`;
  }
}

/**
 * The unreadable tables differ from those in the committed series index, so
 * an RBA layout change may have slipped in. `added` and `removed` hold RBA
 * table numbers.
 */
export class UnreadableTablesChanged extends Schema.TaggedError<UnreadableTablesChanged>()(
  "UnreadableTablesChanged",
  {
    added: Schema.Array(Schema.String),
    removed: Schema.Array(Schema.String),
  },
) {
  override get message(): string {
    const list = (tableNumbers: ReadonlyArray<string>): string =>
      tableNumbers.length === 0 ? "none" : tableNumbers.join(", ");

    return (
      `The unreadable tables changed. Newly unreadable: ${list(this.added)}. ` +
      `Now readable: ${list(this.removed)}. ` +
      "Check the reasons, then run again with --accept-unreadable to accept the new set."
    );
  }
}
