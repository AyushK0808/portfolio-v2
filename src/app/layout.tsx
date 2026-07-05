import type { Metadata, Viewport } from "next";
import { Orbitron, Chakra_Petch, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE } from "@/content/site";

const orbitron = Orbitron({
	variable: "--font-orbitron",
	weight: ["900"],
	subsets: ["latin"],
});

const chakra = Chakra_Petch({
	variable: "--font-chakra",
	weight: ["400", "600"],
	subsets: ["latin"],
});

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
	variable: "--font-jetbrains",
	weight: ["400", "500"],
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: `${SITE.title} — ${SITE.tagline}`,
	description: SITE.description,
	metadataBase: new URL(SITE.url),
	openGraph: {
		title: SITE.title,
		description: SITE.description,
		url: SITE.url,
		siteName: SITE.name,
		type: "website",
	},
};

export const viewport: Viewport = {
	themeColor: "#05060A",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body
				className={`${orbitron.variable} ${chakra.variable} ${inter.variable} ${jetbrains.variable} antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
