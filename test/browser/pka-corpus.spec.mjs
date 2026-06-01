import { test, expect } from "@playwright/test";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";

async function collectPacketTracerFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPacketTracerFiles(path)));
    } else if (/\.(pka|pkt)$/i.test(entry.name)) {
      files.push(path);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

const corpusRoot = process.env.OPENPT_PKA_CORPUS || "";
const corpusFiles = corpusRoot ? await collectPacketTracerFiles(corpusRoot).catch(() => []) : [];

test.describe("local Packet Tracer corpus", () => {
  test.skip(!corpusRoot, "Set OPENPT_PKA_CORPUS=/path/to/pka-folder to run the private corpus gate.");

  test("OPENPT_PKA_CORPUS contains Packet Tracer files", async () => {
    expect(corpusFiles.length, `No .pka/.pkt files found under ${corpusRoot}`).toBeGreaterThan(0);
  });

  for (const filePath of corpusFiles) {
    test(`${relative(corpusRoot, filePath)} imports with exact logical coverage`, async ({ page }) => {
      test.setTimeout(90_000);
      const bytes = await readFile(filePath);
      const fileInfo = await stat(filePath);
      await page.goto("/lab/");

      const result = await page.evaluate(
        async ({ name, base64, lastModified }) => {
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          const file = new File([bytes], name, {
            type: "application/octet-stream",
            lastModified,
          });
          const activity = await window.PacketTracerImporter.importPacketTracerFile(file);
          const topology = window.OpenPTFormat.buildTopologyFromPacketTracer(activity, window.OPT_Engine);
          const graded = window.OpenPTPacketTracerDiagnostics.gradeActivity(activity, topology.devices, topology.links);
          const report = window.OpenPTPacketTracerDiagnostics.importReport(graded);
          const devices = Object.values(topology.devices || {});
          const regularDevices = devices.filter((device) => !device.logicalOnly && !device.packetTracer?.logicalOnly);
          const logicalObjects = devices.filter((device) => device.logicalOnly || device.packetTracer?.logicalOnly);
          const sourceDevices = activity.devices || [];
          const sourceLogicalObjects = activity.logicalObjects || [];
          const sourceLinks = activity.links || [];
          const byPacketTracerName = new Map(devices.map((device) => [device.packetTracer?.name || device.name, device]));
          const coordinateMismatches = [...sourceDevices, ...sourceLogicalObjects].flatMap((source) => {
            const imported = byPacketTracerName.get(source.name);
            if (!imported) return [`${source.name}: missing imported object`];
            if (Number(imported.x) !== Number(source.x) || Number(imported.y) !== Number(source.y)) {
              return [`${source.name}: expected (${source.x}, ${source.y}), got (${imported.x}, ${imported.y})`];
            }
            return [];
          });
          const modelMismatches = sourceDevices.flatMap((source) => {
            const imported = byPacketTracerName.get(source.name);
            if (!imported) return [];
            return (imported.packetTracer?.model || "") === (source.model || "")
              ? []
              : [`${source.name}: expected model ${source.model || "<empty>"}, got ${imported.packetTracer?.model || "<empty>"}`];
          });
          const cableMismatches = sourceLinks.flatMap((source, index) => {
            const imported = topology.links[index];
            if (!imported) return [`link ${index + 1}: missing imported link`];
            return (imported.packetTracer?.type || "") === (source.type || "")
              ? []
              : [`link ${index + 1}: expected cable ${source.type || "<empty>"}, got ${imported.packetTracer?.type || "<empty>"}`];
          });
          const unchecked = (graded.assessmentItems || []).filter((item) => item.unchecked || item.status === "Unchecked");
          const otp = window.OpenPTFormat.buildOtpPackage(
            {
              title: activity.title,
              devices: topology.devices,
              links: topology.links,
              uiState: { ptActivity: graded, ptSidebarOpen: true },
              ptActivity: graded,
              exportedAt: "2026-05-27T18:00:00.000Z",
              appVersion: "pka-corpus-test",
            },
            window.OPT_Engine
          );
          const reopened = window.OpenPTFormat.projectDocumentFromOtpPackage(otp);
          const roundTripTopology = window.OPT_Engine.normalizeTopology(reopened.devices, reopened.links);

          return {
            title: activity.title,
            unsupported: !!activity.unsupported,
            reportCounts: {
              imported: report.imported.length,
              skipped: report.skipped.length,
              approximated: report.approximated.length,
              broken: report.broken.length,
            },
            reportSummary: report.summary,
            firstSkipped: report.skipped.slice(0, 5),
            firstApproximated: report.approximated.slice(0, 5),
            firstBroken: report.broken.slice(0, 5),
            unchecked: unchecked.slice(0, 10).map((item) => ({
              path: item.path || item.name,
              checkerId: item.checkerId,
              reason: item.evidence?.unsupportedReason || "",
            })),
            counts: {
              sourceDevices: sourceDevices.length,
              sourceLogicalObjects: sourceLogicalObjects.length,
              importedRegularDevices: regularDevices.length,
              importedLogicalObjects: logicalObjects.length,
              sourceLinks: sourceLinks.length,
              importedLinks: topology.links.length,
              roundTripDevices: Object.keys(roundTripTopology.devices || {}).length,
              roundTripLinks: roundTripTopology.links.length,
            },
            coordinateMismatches,
            modelMismatches,
            cableMismatches,
            roundTripAssignmentSha256: reopened.uiState.ptActivity?.sourceSha256 || "",
            sourceSha256: activity.sourceSha256 || "",
            roundTripCoverageItems: reopened.uiState.ptActivity?.featureCoverage?.coverageItems?.length || 0,
          };
        },
        {
          name: basename(filePath),
          base64: bytes.toString("base64"),
          lastModified: fileInfo.mtimeMs,
        }
      );

      expect(result.unsupported, `${result.title} decoded`).toBe(false);
      expect(result.reportCounts.skipped, `${result.reportSummary}\n${JSON.stringify(result.firstSkipped, null, 2)}`).toBe(0);
      expect(result.reportCounts.approximated, `${result.reportSummary}\n${JSON.stringify(result.firstApproximated, null, 2)}`).toBe(0);
      expect(result.reportCounts.broken, `${result.reportSummary}\n${JSON.stringify(result.firstBroken, null, 2)}`).toBe(0);
      expect(result.unchecked, "unchecked visible scored assessment leaves").toEqual([]);
      expect(result.counts.importedRegularDevices).toBe(result.counts.sourceDevices);
      expect(result.counts.importedLogicalObjects).toBe(result.counts.sourceLogicalObjects);
      expect(result.counts.importedLinks).toBe(result.counts.sourceLinks);
      expect(result.coordinateMismatches).toEqual([]);
      expect(result.modelMismatches).toEqual([]);
      expect(result.cableMismatches).toEqual([]);
      expect(result.counts.roundTripDevices).toBe(result.counts.sourceDevices + result.counts.sourceLogicalObjects);
      expect(result.counts.roundTripLinks).toBe(result.counts.sourceLinks);
      expect(result.roundTripAssignmentSha256).toBe(result.sourceSha256);
      expect(result.roundTripCoverageItems).toBeGreaterThan(0);
    });
  }
});
