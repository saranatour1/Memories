import { data, type LoaderFunctionArgs } from "react-router";
import { authkitLoader } from "@workos-inc/authkit-react-router";

// Resource route: hands the AuthKit access token (from the cookie session,
// refreshed server-side when expired) to the browser Convex client.
export async function loader(args: LoaderFunctionArgs) {
  return authkitLoader(args, async ({ getAccessToken }) =>
    data({ accessToken: getAccessToken() }),
  );
}
