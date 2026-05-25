"use client";

import type { ReactNode } from "react";

// DataTable — compound component shared by the People, Contracts, and
// AllowedUser admin pages.
//
// Thin wrapper around <table> + <thead>/<tbody>/<tr>/<th>/<td> that
// centralises the styling under a single `.data-table` class and adds an
// `Empty` slot the parent renders when the row collection is empty.
//
// Usage:
//   <DataTable.Root>
//     <DataTable.Head>
//       <DataTable.HeaderCell>Name</DataTable.HeaderCell>
//       <DataTable.HeaderCell width="120px">Actions</DataTable.HeaderCell>
//     </DataTable.Head>
//     <DataTable.Body>
//       {rows.map((r) => (
//         <DataTable.Row key={r.id} dim={!r.active}>
//           <DataTable.Cell>{r.name}</DataTable.Cell>
//           <DataTable.Cell>…</DataTable.Cell>
//         </DataTable.Row>
//       ))}
//     </DataTable.Body>
//   </DataTable.Root>
//   {rows.length === 0 && <DataTable.Empty>No people yet.</DataTable.Empty>}

function Root({ children }: { children: ReactNode }) {
  return <table className="data-table">{children}</table>;
}

function Head({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

function HeaderCell({
  children,
  width,
  align,
}: {
  children: ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th style={{ width, textAlign: align }}>
      {children}
    </th>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

function Row({
  children,
  dim = false,
}: {
  children: ReactNode;
  dim?: boolean;
}) {
  return <tr className={dim ? "is-dim" : undefined}>{children}</tr>;
}

function Cell({
  children,
  align,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
}) {
  return <td style={{ textAlign: align }}>{children}</td>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="data-table-empty">{children}</div>;
}

export const DataTable = {
  Root,
  Head,
  HeaderCell,
  Body,
  Row,
  Cell,
  Empty,
};
