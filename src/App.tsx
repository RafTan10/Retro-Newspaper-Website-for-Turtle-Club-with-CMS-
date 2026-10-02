/* eslint-disable react-refresh/only-export-components -- route table, not a component module */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

// The CMS (and its editor) loads only when someone opens /admin, so visitors
// to the stack never download it.
const AdminLayout = lazy(() =>
  import("./admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const IssueList = lazy(() =>
  import("./admin/IssueList").then((m) => ({ default: m.IssueList })),
);
const IssueEditor = lazy(() =>
  import("./admin/IssueEditor").then((m) => ({ default: m.IssueEditor })),
);

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <p style={{ padding: 24, fontFamily: "var(--font-ui)" }}>
          Opening the press room…
        </p>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    { path: "/", element: <HomePage /> },
    {
      path: "/admin",
      element: (
        <Loading>
          <AdminLayout />
        </Loading>
      ),
      children: [
        {
          index: true,
          element: (
            <Loading>
              <IssueList />
            </Loading>
          ),
        },
        {
          path: "issues/new",
          element: (
            <Loading>
              <IssueEditor />
            </Loading>
          ),
        },
        {
          path: "issues/:id",
          element: (
            <Loading>
              <IssueEditor />
            </Loading>
          ),
        },
      ],
    },
  ],
  {
    // Opt in to v7 behaviour now (and silence the upgrade warnings)
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);
