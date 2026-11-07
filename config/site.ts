export const siteConfig = {
  name: "benchcn",
  tagline: "Hardware and maker UI components for shadcn/ui",
  description:
    "Oscilloscopes, logic analyzers, seven-segment displays, pinout maps and actuator controls that behave like the real thing. Copy-paste React components built the shadcn way, live against a mock device, ready for your ESP32, Pico or Raspberry Pi.",
  url: "https://nathan-abela.github.io/benchcn",
  basepath: "/benchcn",
  registry: {
    namespace: "@benchcn",
    /** Every registry source file starts with this so public usage is findable on GitHub. */
    fileHeader: "// benchcn.dev · ",
    get baseUrl() {
      return `${siteConfig.url}/r`;
    },
    get itemUrlTemplate() {
      return `${siteConfig.url}/r/{name}.json`;
    },
  },
  repo: {
    owner: "nathan-abela",
    name: "benchcn",
    branch: "main",
    get url() {
      return `https://github.com/${siteConfig.repo.owner}/${siteConfig.repo.name}`;
    },
  },
  author: {
    name: "Nathan Abela",
    url: "https://github.com/nathan-abela",
  },
  socials: {
    github: "https://github.com/nathan-abela/benchcn",
  },
  analytics: {
    posthogHost: "https://eu.i.posthog.com",
    posthogKey: "",
    superProperties: { site: "benchcn" },
  },
  license: "MIT",
} as const;

export type SiteConfig = typeof siteConfig;
