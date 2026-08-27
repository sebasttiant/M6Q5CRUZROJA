import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["pdfkit"],
  // pdfkit resolves its .afm metrics through a runtime path that tracing cannot follow.
  outputFileTracingIncludes: { "/api/export/pdf": ["./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/*.afm"] },
};
export default nextConfig;
