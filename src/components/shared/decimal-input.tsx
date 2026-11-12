"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatMilli, parseMilli } from "@/lib/money";

/** Quantidade decimal (ex.: litros) mantida em milésimos. */
export function DecimalInput({
  value,
  onValueChange,
  placeholder,
  id,
  ...props
}: {
  value: number | null | undefined;
  onValueChange: (milli: number | null) => void;
  placeholder?: string;
  id?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = React.useState(value == null ? "" : formatMilli(value).replace(/\./g, ""));
  const last = React.useRef(value);
  React.useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value == null ? "" : formatMilli(value).replace(/\./g, ""));
    }
  }, [value]);
  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, "");
        setText(t);
        const parsed = parseMilli(t);
        last.current = parsed;
        onValueChange(parsed);
      }}
      {...props}
    />
  );
}
