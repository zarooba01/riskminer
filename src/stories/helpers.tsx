/** Wariant historii na telefonie: `export const Telefon = { ...phone }`. */
export const phone = { globals: { viewport: { value: "telefon", isRotated: false } } } as const;

export const fullscreen = { layout: "fullscreen" } as const;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Atrapa server action zwracającej ActionResult. */
export const fakeResult =
  <A extends unknown[]>(message = "Wykonano (atrapa w Storybooku).") =>
  async (..._args: A) => {
    void _args;
    await wait(500);
    return { ok: true, message };
  };

export const demoUser = { name: "Ekspert", email: "Panel eksperta" };
