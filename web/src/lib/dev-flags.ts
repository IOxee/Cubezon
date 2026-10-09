/**
 * Development switches, read on the server. They never apply to a production build
 * (NODE_ENV = "production", i.e. `next build` + `next start`), whatever the environment says.
 */

/** CUBEZON_DEV_ALLOW_SELF_PURCHASE=1: a player may buy from their own shop (to test the flow alone). */
export function allowSelfPurchase(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CUBEZON_DEV_ALLOW_SELF_PURCHASE === "1";
}
