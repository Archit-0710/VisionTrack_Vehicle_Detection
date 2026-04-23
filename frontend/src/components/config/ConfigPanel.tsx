import { useState } from "react";
import { Settings, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { ProcessingConfig } from "@/types";

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
      >
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-x-6 gap-y-3 border-t" style={{ borderColor: "var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function NumInput({ label, value, onChange, step = 1, min, max }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type="number"
        className="form-input"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function BoolInput({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <input
        id={label}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-blue-500 cursor-pointer rounded"
      />
      <label htmlFor={label} className="text-xs text-slate-400 cursor-pointer">{label}</label>
    </div>
  );
}

export default function ConfigPanel() {
  const { config, setConfig, resetConfig } = useStore();

  const update = <K extends keyof ProcessingConfig>(section: K) =>
    (field: string, value: unknown) =>
      setConfig({ [section]: { ...config[section], [field]: value } } as Partial<ProcessingConfig>);

  const sp = update("speedTrap");
  const bs = update("backgroundSubtraction");
  const cf = update("contourFiltering");
  const tr = update("tracking");
  const pr = update("preprocessing");
  const po = update("processing");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-slate-400" />
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Detection Configuration</h2>
        </div>
        <button className="btn btn-ghost py-1 px-3 text-xs" onClick={resetConfig}>
          <RefreshCw size={12} />
          Defaults
        </button>
      </div>

      <Section title="🎯 Speed Trap" defaultOpen>
        <NumInput label="Line 1 Y (px)" value={config.speedTrap.line1Y} onChange={(v) => sp("line1Y", v)} />
        <NumInput label="Line 2 Y (px)" value={config.speedTrap.line2Y} onChange={(v) => sp("line2Y", v)} />
        <NumInput label="Distance (m)" value={config.speedTrap.knownDistanceM} step={0.5} onChange={(v) => sp("knownDistanceM", v)} />
        <NumInput label="Speed Limit (km/h)" value={config.speedTrap.speedLimitKmph} onChange={(v) => sp("speedLimitKmph", v)} />
      </Section>

      <Section title="🎨 Background Subtraction">
        <div className="col-span-2">
          <label className="form-label">Method</label>
          <div className="flex gap-4 mt-1">
            {["MOG2", "KNN"].map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  name="bs-method"
                  value={m}
                  checked={config.backgroundSubtraction.method === m}
                  onChange={() => bs("method", m)}
                  className="accent-blue-500"
                />
                {m}
              </label>
            ))}
          </div>
        </div>
        {config.backgroundSubtraction.method === "MOG2" ? (
          <>
            <NumInput label="History Frames" value={config.backgroundSubtraction.mog2History} onChange={(v) => bs("mog2History", v)} />
            <NumInput label="Var Threshold" value={config.backgroundSubtraction.mog2VarThreshold} step={1} onChange={(v) => bs("mog2VarThreshold", v)} />
            <BoolInput label="Detect Shadows" value={config.backgroundSubtraction.mog2DetectShadows} onChange={(v) => bs("mog2DetectShadows", v)} />
          </>
        ) : (
          <>
            <NumInput label="History Frames" value={config.backgroundSubtraction.knnHistory} onChange={(v) => bs("knnHistory", v)} />
            <NumInput label="Dist² Threshold" value={config.backgroundSubtraction.knnDist2Threshold} step={10} onChange={(v) => bs("knnDist2Threshold", v)} />
            <BoolInput label="Detect Shadows" value={config.backgroundSubtraction.knnDetectShadows} onChange={(v) => bs("knnDetectShadows", v)} />
          </>
        )}
      </Section>

      <Section title="🔍 Contour Filtering">
        <NumInput label="Min Area (px²)" value={config.contourFiltering.minArea} step={500} onChange={(v) => cf("minArea", v)} />
        <NumInput label="Max Area (px²)" value={config.contourFiltering.maxArea} step={5000} onChange={(v) => cf("maxArea", v)} />
        <NumInput label="Min Aspect Ratio" value={config.contourFiltering.minAspectRatio} step={0.05} onChange={(v) => cf("minAspectRatio", v)} />
        <NumInput label="Max Aspect Ratio" value={config.contourFiltering.maxAspectRatio} step={0.1} onChange={(v) => cf("maxAspectRatio", v)} />
        <NumInput label="Min Solidity" value={config.contourFiltering.minSolidity} step={0.05} min={0} max={1} onChange={(v) => cf("minSolidity", v)} />
      </Section>

      <Section title="🔗 Tracking">
        <NumInput label="Max Match Distance" value={config.tracking.maxMatchDistance} onChange={(v) => tr("maxMatchDistance", v)} />
        <NumInput label="Max Missed Frames" value={config.tracking.maxMissedFrames} onChange={(v) => tr("maxMissedFrames", v)} />
        <NumInput label="Confirm Frames" value={config.tracking.confirmFrames} onChange={(v) => tr("confirmFrames", v)} />
      </Section>

      <Section title="⚙️ Preprocessing">
        <BoolInput label="Use CLAHE Enhancement" value={config.preprocessing.useClahe} onChange={(v) => pr("useClahe", v)} />
        <NumInput label="Blur Kernel (odd)" value={config.preprocessing.blurKernel[0]} step={2} min={1} onChange={(v) => pr("blurKernel", [v, v])} />
        <NumInput label="Warmup Frames" value={config.processing.warmupFrames} onChange={(v) => po("warmupFrames", v)} />
      </Section>
    </div>
  );
}
