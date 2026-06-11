/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PDFKit / nodemailer はサーバ専用ネイティブ依存のため外部化する
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "nodemailer", "@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
