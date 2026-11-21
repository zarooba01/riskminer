"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { unlock, type PasswordState } from "./actions";

export function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(unlock, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field data-invalid={Boolean(state.error)}>
        <FieldLabel htmlFor="password">Hasło dostępu</FieldLabel>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {state.error && <FieldError>{state.error}</FieldError>}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sprawdzam…" : "Wejdź"}
      </Button>
    </form>
  );
}
