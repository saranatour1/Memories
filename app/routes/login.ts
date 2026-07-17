import { redirect, type LoaderFunctionArgs } from "react-router";
import { getSignInUrl } from "@workos-inc/authkit-react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/";
  const { url, headers } = await getSignInUrl(returnTo, request);
  return redirect(url, { headers });
}
