import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
let child: ChildProcess | undefined;
let directory: string | undefined;

afterEach(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
  child = undefined;
  directory = undefined;
});

describe("server startup", () => {
  it.each(["production", "development"])(
    "serves health, root, and client routes in %s",
    async (mode) => {
      directory = await mkdtemp(join(tmpdir(), "foliolab-server-"));
      await mkdir(join(directory, "dist/public"), { recursive: true });
      await writeFile(
        join(directory, "dist/public/index.html"),
        "<!doctype html><html><body>Portfolio application</body></html>",
      );
      child = spawn(
        process.execPath,
        [
          "--import",
          resolve(root, "node_modules/tsx/dist/loader.mjs"),
          resolve(root, "server/index.ts"),
        ],
        {
          cwd: mode === "production" ? directory : root,
          env: { PATH: process.env.PATH, NODE_ENV: mode, PORT: "0" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const running = child;
      const port = await new Promise<string>((resolvePort, reject) => {
        let output = "";
        const timer = setTimeout(
          () => reject(new Error(`Server did not start:\n${output}`)),
          20000,
        );
        const capture = (chunk: Buffer) => {
          output += chunk.toString();
          const match = output.match(/serving on port (\d+)/);
          if (match) {
            clearTimeout(timer);
            resolvePort(match[1]);
          }
        };
        running.stdout?.on("data", capture);
        running.stderr?.on("data", capture);
        running.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        running.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Server exited (${code}):\n${output}`));
        });
      });
      const baseURL = `http://127.0.0.1:${port}`;
      const health = await fetch(`${baseURL}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ status: "healthy", environment: mode });
      for (const path of ["/", "/portfolio/preview"]) {
        const response = await fetch(`${baseURL}${path}`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(await response.text()).toMatch(/<!doctype html>/i);
      }
    },
    30000,
  );
});
