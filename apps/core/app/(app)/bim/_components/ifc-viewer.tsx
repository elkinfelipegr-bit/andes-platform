"use client";

// In-browser IFC viewer (RFC-002): fetch the version straight from
// storage via its presigned URL, parse with web-ifc (WASM served from
// /public/wasm — no CDN), render with Three.js through
// @thatopen/components. 100% client-side by ratified decision — no
// server geometry work exists. This module is only ever loaded through
// next/dynamic, keeping the 3D stack out of every other page's bundle.
import { useEffect, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

interface SelectedElement {
  expressID: number;
  attributes: Array<[string, string]>;
}

function flattenAttributes(props: Record<string, unknown>): SelectedElement {
  const attributes: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      const inner = (value as { value?: unknown }).value;
      if (inner !== undefined && inner !== null && typeof inner !== "object") {
        attributes.push([key, String(inner)]);
      }
      continue;
    }
    attributes.push([key, String(value)]);
  }
  return {
    expressID: Number(props.expressID ?? 0),
    attributes,
  };
}

export default function IfcViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Preparing viewer…");
  const [selected, setSelected] = useState<SelectedElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const components = new OBC.Components();

    async function init() {
      try {
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create<
          OBC.SimpleScene,
          OBC.SimpleCamera,
          OBC.SimpleRenderer
        >();
        world.scene = new OBC.SimpleScene(components);
        world.renderer = new OBC.SimpleRenderer(components, container!);
        world.camera = new OBC.SimpleCamera(components);
        components.init();
        world.scene.setup();
        components.get(OBC.Grids).create(world);

        setMessage("Downloading model from storage…");
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("The model could not be downloaded from storage.");
        }
        const buffer = new Uint8Array(await response.arrayBuffer());
        if (disposed) return;

        setMessage("Parsing IFC (runs entirely in your browser)…");
        const ifcLoader = components.get(OBC.IfcLoader);
        ifcLoader.settings.autoSetWasm = false;
        ifcLoader.settings.wasm = { path: "/wasm/", absolute: true };
        await ifcLoader.setup(ifcLoader.settings);
        const model = await ifcLoader.load(buffer);
        if (disposed) return;
        world.scene.three.add(model);

        // Frame the model.
        const box = model.boundingBox;
        if (box && !box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const distance = Math.max(size.x, size.y, size.z) * 1.5 || 10;
          await world.camera.controls.setLookAt(
            center.x + distance,
            center.y + distance,
            center.z + distance,
            center.x,
            center.y,
            center.z,
          );
        }

        // Click-to-select with an element attribute panel.
        const highlighter = components.get(OBF.Highlighter);
        highlighter.setup({ world });
        highlighter.events.select?.onHighlight.add((idMap) => {
          void (async () => {
            const first = Object.values(idMap)[0];
            const expressID = first ? [...first][0] : undefined;
            if (expressID === undefined) return;
            const props = await model.getProperties(expressID);
            if (props && !disposed) setSelected(flattenAttributes(props));
          })();
        });
        highlighter.events.select?.onClear.add(() => setSelected(null));

        setStatus("ready");
      } catch (e) {
        if (!disposed) {
          setStatus("error");
          setMessage(
            e instanceof Error ? e.message : "The model could not be loaded.",
          );
        }
      }
    }

    void init();
    return () => {
      disposed = true;
      components.dispose();
    };
  }, [url]);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
      <div ref={containerRef} className="absolute inset-0" />
      {status !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <p
            className={
              status === "error"
                ? "max-w-md text-center text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {message}
          </p>
        </div>
      )}
      {selected && (
        <aside className="absolute right-3 top-3 z-10 max-h-[60%] w-72 overflow-y-auto rounded-lg border border-border bg-background/95 p-3 shadow-md">
          <p className="mb-2 font-mono text-xs text-muted-foreground">
            Element #{selected.expressID}
          </p>
          <dl className="space-y-1">
            {selected.attributes.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[40%_60%] gap-2">
                <dt className="truncate text-xs font-medium">{key}</dt>
                <dd className="break-words text-xs text-muted-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </div>
  );
}
