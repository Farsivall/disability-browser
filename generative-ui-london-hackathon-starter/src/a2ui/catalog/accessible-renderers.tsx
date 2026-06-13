"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import type { RendererProps } from "@copilotkit/a2ui-renderer";
import {
  buildProxyMessage,
  useProxyEmit,
} from "@/a2ui/proxy-context";

const AccessibleHeading = ({
  props,
}: RendererProps<{
  text: string;
  level?: "1" | "2" | "3" | "4" | "5" | "6";
  sourceRef?: string;
  size?: "default" | "large" | "xlarge";
}>) => {
  const level = props.level ?? "2";
  const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
  const sizeClass =
    props.size === "xlarge"
      ? "pw-heading--1"
      : props.size === "large"
        ? "pw-heading--2"
        : `pw-heading--${level}`;

  return (
    <Tag
      className={clsx("pw-heading pw-focusable", sizeClass)}
      data-source-ref={props.sourceRef}
      tabIndex={props.sourceRef ? 0 : undefined}
    >
      {props.text}
    </Tag>
  );
};

const ReadableText = ({
  props,
}: RendererProps<{
  text: string;
  sourceRef?: string;
  font?: "default" | "readable";
  size?: "default" | "large";
}>) => (
  <p
    className={clsx(
      "pw-readable",
      props.font === "readable" && "pw-readable--readable-font",
      props.size === "large" && "text-[var(--pw-text-large)]",
    )}
    data-source-ref={props.sourceRef}
  >
    {props.text}
  </p>
);

const BigButton = ({
  props,
}: RendererProps<{
  label: string;
  sourceRef: string;
  variant?: "primary" | "secondary";
}>) => {
  const emit = useProxyEmit();
  return (
    <button
      type="button"
      className={clsx(
        "pw-big-target pw-focusable",
        props.variant === "secondary" && "pw-big-target--secondary",
      )}
      data-source-ref={props.sourceRef}
      onClick={() =>
        emit(buildProxyMessage("click", props.sourceRef))
      }
    >
      {props.label}
    </button>
  );
};

const BigLink = ({
  props,
}: RendererProps<{
  label: string;
  sourceRef: string;
  href?: string;
}>) => {
  const emit = useProxyEmit();
  return (
    <button
      type="button"
      className="pw-big-link pw-focusable"
      data-source-ref={props.sourceRef}
      onClick={() =>
        emit(buildProxyMessage("navigate", props.sourceRef))
      }
    >
      {props.label}
    </button>
  );
};

const BigInput = ({
  props,
}: RendererProps<{
  label: string;
  sourceRef: string;
  inputType?: "text" | "email" | "tel" | "textarea" | "number";
  placeholder?: string;
  value?: string;
}>) => {
  const emit = useProxyEmit();
  const isTextarea = props.inputType === "textarea";
  const shared = {
    id: props.sourceRef,
    name: props.sourceRef,
    className: clsx(
      "pw-field-input pw-focusable",
      isTextarea && "pw-field-textarea",
    ),
    "data-source-ref": props.sourceRef,
    placeholder: props.placeholder,
    defaultValue: props.value,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      emit(buildProxyMessage("input", props.sourceRef, e.target.value));
    },
  };

  return (
    <div className="pw-field">
      <label htmlFor={props.sourceRef} className="pw-field-label">
        {props.label}
      </label>
      {isTextarea ? (
        <textarea {...shared} rows={4} />
      ) : (
        <input
          type={props.inputType ?? "text"}
          {...shared}
        />
      )}
    </div>
  );
};

const BigSelect = ({
  props,
}: RendererProps<{
  label: string;
  sourceRef: string;
  options: { label: string; value: string }[];
  value?: string;
}>) => {
  const emit = useProxyEmit();
  const options = Array.isArray(props.options) ? props.options : [];

  return (
    <div className="pw-field">
      <label htmlFor={props.sourceRef} className="pw-field-label">
        {props.label}
      </label>
      <select
        id={props.sourceRef}
        name={props.sourceRef}
        className="pw-field-select pw-focusable"
        data-source-ref={props.sourceRef}
        defaultValue={props.value}
        onChange={(e) =>
          emit(buildProxyMessage("input", props.sourceRef, e.target.value))
        }
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const BigToggle = ({
  props,
}: RendererProps<{
  label: string;
  sourceRef: string;
  inputType?: "checkbox" | "radio";
  checked?: boolean;
  name?: string;
  value?: string;
}>) => {
  const emit = useProxyEmit();
  const type = props.inputType ?? "checkbox";

  return (
    <label className="pw-toggle-row pw-focusable">
      <input
        type={type}
        name={props.name ?? props.sourceRef}
        value={props.value}
        className="pw-toggle-input"
        data-source-ref={props.sourceRef}
        defaultChecked={props.checked}
        onChange={(e) =>
          emit(
            buildProxyMessage(
              "input",
              props.sourceRef,
              type === "checkbox"
                ? String(e.target.checked)
                : (e.target.value ?? ""),
            ),
          )
        }
      />
      <span>{props.label}</span>
    </label>
  );
};

const FlatNav = ({
  props,
}: RendererProps<{
  items: { label: string; sourceRef: string; href?: string }[];
}>) => {
  const emit = useProxyEmit();
  const items = props.items ?? [];

  return (
    <nav className="pw-flat-nav" aria-label="Navigation">
      {items.map((item) => (
        <button
          key={item.sourceRef}
          type="button"
          className="pw-big-target pw-big-target--secondary pw-focusable"
          data-source-ref={item.sourceRef}
          onClick={() =>
            emit(
              buildProxyMessage(
                item.href ? "navigate" : "click",
                item.sourceRef,
              ),
            )
          }
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};

const StaticImageGrid = ({
  props,
}: RendererProps<{
  images: { alt: string; label?: string; sourceRef?: string }[];
  columns?: number;
}>) => {
  const cols = props.columns ?? 3;
  const colClass =
    cols <= 2
      ? "grid-cols-2"
      : cols >= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3";

  return (
    <div
      className={clsx("pw-image-grid grid", colClass)}
      role="group"
      aria-label="Product images"
    >
      {(props.images ?? []).map((img, i) => (
        <div
          key={img.sourceRef ?? i}
          className="pw-image-grid-item"
          data-source-ref={img.sourceRef}
          role="img"
          aria-label={img.alt}
        >
          {img.label ?? img.alt}
        </div>
      ))}
    </div>
  );
};

function PaginatedSlot({ render }: { render: ReactNode }) {
  return <>{render}</>;
}

const PaginatedList = ({
  props,
  children,
}: RendererProps<{
  children: string[];
  pageSize?: number;
}>) => {
  const [page, setPage] = useState(0);
  const ids = Array.isArray(props.children) ? props.children : [];
  const pageSize = props.pageSize ?? 3;
  const totalPages = Math.max(1, Math.ceil(ids.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = ids.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );

  return (
    <div className="pw-paginated">
      <div className="flex flex-col gap-3">
        {slice.map((id) => (
          <PaginatedSlot key={id} render={children(id)} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pw-paginated-controls">
          <button
            type="button"
            className="pw-big-target pw-big-target--secondary pw-focusable"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="pw-paginated-status">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="pw-big-target pw-focusable"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

const AccessibleCallout = ({
  props,
}: RendererProps<{
  body: string;
  title?: string;
  tone?: "info" | "positive" | "warning" | "neutral" | "uncertain";
  sourceRef?: string;
}>) => {
  const tone = props.tone ?? "info";
  const isUncertain = tone === "uncertain";

  const accents: Record<
    Exclude<typeof tone, "uncertain">,
    { bar: string; bg: string; chip: string }
  > = {
    info: {
      bar: "bg-[var(--lilac,#bec2ff)]",
      bg: "bg-[color-mix(in_oklab,var(--lilac,#bec2ff)_7%,var(--card))]",
      chip: "text-[var(--foreground)]",
    },
    positive: {
      bar: "bg-[var(--mint,#85ecce)]",
      bg: "bg-[color-mix(in_oklab,var(--mint,#85ecce)_8%,var(--card))]",
      chip: "text-[var(--foreground)]",
    },
    warning: {
      bar: "bg-[var(--orange,#ffac4d)]",
      bg: "bg-[color-mix(in_oklab,var(--orange,#ffac4d)_8%,var(--card))]",
      chip: "text-[var(--foreground)]",
    },
    neutral: {
      bar: "bg-[var(--muted-foreground)]",
      bg: "bg-[var(--muted)]",
      chip: "text-[var(--foreground)]",
    },
  };

  const a = isUncertain
    ? {
        bar: "bg-[var(--muted-foreground)]",
        bg: "bg-[var(--muted)]",
        chip: "text-[var(--foreground)]",
      }
    : accents[tone as keyof typeof accents];

  return (
    <div
      className={clsx(
        "relative rounded-[var(--radius)] border border-[var(--border)] pl-4 pr-5 py-4 flex flex-col gap-1.5",
        a.bg,
        isUncertain && "pw-callout-uncertain",
      )}
      role="status"
      data-source-ref={props.sourceRef}
    >
      <span
        aria-hidden
        className={clsx("absolute left-0 top-0 bottom-0 w-1", a.bar)}
      />
      {props.title && (
        <span className={clsx("text-sm font-semibold uppercase", a.chip)}>
          {props.title}
        </span>
      )}
      <span className="pw-readable text-[var(--foreground)]">{props.body}</span>
    </div>
  );
};

export const accessibleRenderers = {
  AccessibleHeading,
  ReadableText,
  BigButton,
  BigLink,
  BigInput,
  BigSelect,
  BigToggle,
  FlatNav,
  StaticImageGrid,
  PaginatedList,
  AccessibleCallout,
};
