"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/session";

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/");
}

export async function signOutEverywhereAction(): Promise<void> {
  await signOut({ everywhere: true });
  redirect("/");
}
