/**
 * @module command-registry
 *
 * The generic dispatcher shape behind OD's `SUBCOMMAND_MAP` (see
 * `source-map.md`): look at the first non-flag `argv` token, dispatch to a
 * registered handler, or report that nothing matched so the caller can fall
 * back to root help. OD's actual map (33 product command names) was not
 * ported — only the registrar pattern, which is what `@jini/core`'s
 * `Pack['cli']` hook (`cli?: (reg: unknown, services: Services) => void`)
 * needs a concrete `reg` type for.
 */

export type CommandHandler = (args: readonly string[]) => void | Promise<void>;

interface RegisteredCommand {
  name: string;
  handler: CommandHandler;
  usage?: string;
}

export type CommandDispatchResult =
  | { kind: 'handled' }
  | { kind: 'not-found'; name: string }
  | { kind: 'empty' };

/**
 * A name → handler table for top-level CLI subcommands, with first-non-flag
 * dispatch matching OD's `cli.ts` root router (`argv.find(a =>
 * !a.startsWith('-'))`, then the remaining tokens minus that one name are
 * passed to the handler).
 */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  /** Register a command. Re-registering an existing name replaces it. */
  add(name: string, handler: CommandHandler, opts: { usage?: string } = {}): this {
    this.commands.set(name, { name, handler, ...(opts.usage !== undefined ? { usage: opts.usage } : {}) });
    return this;
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  /** The usage text registered alongside `name`, if any. */
  usageFor(name: string): string | undefined {
    return this.commands.get(name)?.usage;
  }

  /** Every registered command name, insertion order. */
  names(): string[] {
    return [...this.commands.keys()];
  }

  /**
   * Find the first non-`-`-prefixed token in `argv`, look up its handler,
   * and invoke it with every other token (flags before *and* after the
   * command name are preserved, matching OD's router). Returns `'empty'`
   * when `argv` has no positional token at all, `'not-found'` when one
   * exists but nothing is registered for it.
   */
  async dispatch(argv: readonly string[]): Promise<CommandDispatchResult> {
    const name = argv.find((token) => !token.startsWith('-'));
    if (name === undefined) return { kind: 'empty' };

    const command = this.commands.get(name);
    if (command === undefined) return { kind: 'not-found', name };

    const index = argv.indexOf(name);
    const rest = [...argv.slice(0, index), ...argv.slice(index + 1)];
    await command.handler(rest);
    return { kind: 'handled' };
  }
}
