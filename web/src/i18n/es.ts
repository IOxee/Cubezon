import { account } from "./es/account";
import { admin } from "./es/admin";
import { catalog } from "./es/catalog";
import { common } from "./es/common";
import { help } from "./es/help";
import { roleplay } from "./es/roleplay";
import { roles } from "./es/roles";
import { seller } from "./es/seller";
import { shopping } from "./es/shopping";

/** All Spanish texts. Each area owns its own file under ./es/. */
export const es = { ...common, catalog, shopping, account, seller, admin, help, roleplay, roles } as const;
