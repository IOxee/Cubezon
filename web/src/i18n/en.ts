import { account } from "./en/account";
import { admin } from "./en/admin";
import { catalog } from "./en/catalog";
import { common } from "./en/common";
import { help } from "./en/help";
import { roleplay } from "./en/roleplay";
import { roles } from "./en/roles";
import { seller } from "./en/seller";
import { shopping } from "./en/shopping";

/** All English texts. Each area owns its own file under ./en/. */
export const en = { ...common, catalog, shopping, account, seller, admin, help, roleplay, roles } as const;
