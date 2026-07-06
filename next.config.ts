import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// keep these out of the Next server bundle — mongodb pulls optional native
	// deps and worker-mailer imports `cloudflare:sockets`; both are resolved at
	// runtime (the OpenNext worker build handles the cloudflare: externals).
	serverExternalPackages: ["mongodb", "worker-mailer"],
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
