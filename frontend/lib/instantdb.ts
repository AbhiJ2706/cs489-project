import { init } from '@instantdb/react';
import schema from "../instant.schema";

// Initialize InstantDB - only if APP_ID is available
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "";
const db = APP_ID ? init({ appId: APP_ID, schema }) : null;

export default db;
