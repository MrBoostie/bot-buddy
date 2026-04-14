export type LocalCliIO = {
  prompt: (query: string) => Promise<string>;
  print: (line: string) => void;
  printError: (line: string, error: unknown) => void;
};

export type LocalCliDeps = {
  botName: string;
  think: (input: string) => Promise<string>;
  io: LocalCliIO;
};

function isReadlineClosedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === 'ERR_USE_AFTER_CLOSE';
}

export async function runLocalCli({ botName, think, io }: LocalCliDeps): Promise<void> {
  io.print(`[${botName}] local console online. type "exit" to quit.`);

  while (true) {
    let line: string;
    try {
      line = (await io.prompt('you> ')).trim();
    } catch (error) {
      if (isReadlineClosedError(error)) {
        io.print(`[${botName}] console closed.`);
        return;
      }
      throw error;
    }

    if (!line) continue;
    if (line.toLowerCase() === 'exit') {
      io.print(`[${botName}] bye.`);
      return;
    }

    try {
      const reply = await think(line);
      io.print(`${botName}> ${reply}`);
    } catch (error) {
      io.printError(`${botName}> error:`, error);
    }
  }
}
