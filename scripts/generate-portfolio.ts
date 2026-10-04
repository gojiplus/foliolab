import { parseArgs } from "node:util";
import { generateOrganization } from "../server/lib/organization-generator.js";

async function main() {
  try {
    const { values } = parseArgs({
      options: {
        config: { type: "string", default: "foliolab.config.json" },
        "data-file": { type: "string", default: "foliolab-data.json" },
        "output-directory": { type: "string", default: "_site" },
        force: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
    if (values.help) {
      console.log(
        "Usage: npm run generate:org -- --config foliolab.config.json [--data-file foliolab-data.json] [--output-directory _site] [--force]",
      );
    } else {
      const result = await generateOrganization({
        configPath: values.config,
        dataFile: values["data-file"],
        outputDirectory: values["output-directory"],
        force: values.force,
      });
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Organization generation failed");
    process.exitCode = 1;
  }
}
void main();
