"use client";

import { useState } from "react";
import type { AvailableObject } from "@/components/dashboard/DashboardCanvas";
import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import {
  FilterBar,
  initialFilterValues,
  type FilterValues,
} from "@/components/dashboard/FilterBar";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteTabBar } from "@/components/sites/SiteTabBar";
import type { SiteView } from "@/server/sites/service";

export function SiteWorkspace({
  site,
  availableObjects,
  preview = false,
  hrefBase,
}: {
  site: SiteView;
  availableObjects: AvailableObject[];
  preview?: boolean;
  hrefBase?: string;
}) {
  const [filterValues, setFilterValues] = useState<FilterValues>(() =>
    initialFilterValues(site.filters),
  );
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const navBase = hrefBase ?? `/sites/${site.slug}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {site.menu ? (
        <SiteNav
          siteSlug={site.slug}
          items={site.menu.items}
          currentPageSlug={site.currentPage.slug}
          hrefBase={navBase}
        />
      ) : null}

      {site.filtersVisible && site.filters.length > 0 ? (
        <FilterBar
          filters={site.filters}
          values={filterValues}
          onChange={setFilterValues}
          collapsed={filtersCollapsed}
          onToggleCollapsed={() => setFiltersCollapsed((value) => !value)}
        />
      ) : null}

      <SiteTabBar
        dashboardId={site.id}
        pageId={site.currentPage.id}
        siteSlug={site.slug}
        pageSlug={site.currentPage.slug}
        tabs={site.currentPage.tabs}
        currentTabId={site.currentTab.id}
        showTabs={site.currentPage.showTabs}
        editing={preview ? false : editing}
        preview={preview}
        hrefBase={navBase}
      />

      <DashboardCanvas
        dashboardId={site.id}
        tabId={site.currentTab.id}
        filterValues={filterValues}
        widgets={site.widgets}
        availableObjects={availableObjects}
        onEditingChange={preview ? undefined : setEditing}
        preview={preview}
      />
    </div>
  );
}
