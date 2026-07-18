import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config.js";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";

const app = defineApp();
app.use(r2);
app.use(workOSAuthKit);
export default app;
