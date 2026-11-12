"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { ScannerDialog } from "./scanner";

/**
 * Entrada de códigos: la pistola (USB o Bluetooth) escribe el código y envía
 * Enter en este campo; también se puede usar la cámara del celular.
 */
export function ScanInput({
  onScan,
  placeholder = "Escanea o escribe el código…",
  autoFocus = true,
  keepFocus = true,
}: {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Vuelve a enfocar el campo tras cada lectura, para escanear sin tocar la pantalla */
  keepFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function submit(code: string) {
    const c = code.trim();
    if (!c) return;
    onScan(c);
    setValue("");
    if (keepFocus) ref.current?.focus();
  }

  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(value);
              }
            }}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="go"
            placeholder={placeholder}
            aria-label="Código de barras, QR o SKU"
            className="h-14 w-full rounded-xl border-2 border-slate-300 bg-surface pl-11 pr-3 font-mono text-lg text-slate-900 placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
          />
        </div>
        <button
          type="button"
          onClick={() => setCamera(true)}
          aria-label="Escanear con la cámara"
          className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-brand-600 text-white active:bg-brand-700"
        >
          <Camera className="h-6 w-6" />
        </button>
      </div>
      <ScannerDialog
        open={camera}
        onClose={() => setCamera(false)}
        onDetect={(code) => {
          submit(code);
          return code;
        }}
      />
    </>
  );
}
