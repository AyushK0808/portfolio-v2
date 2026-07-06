import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// keep mongodb out of the Next server bundle — it pulls optional native
	// deps that are resolved at runtime.
	serverExternalPackages: ["mongodb"],
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
