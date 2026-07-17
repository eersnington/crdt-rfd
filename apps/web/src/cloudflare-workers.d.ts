declare module "cloudflare:workers" {
  export const env: import("../../../packages/infra/alchemy.run").WebsiteEnv;
}
