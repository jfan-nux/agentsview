import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page object for the sessions view.
 * Encapsulates selectors and common navigation actions
 * shared across E2E specs.
 */
export class SessionsPage {
  readonly sessionItems: Locator;
  readonly messageRows: Locator;
  readonly scroller: Locator;

  readonly sortButton: Locator;
  readonly projectSelect: Locator;
  readonly sessionListHeader: Locator;

  constructor(readonly page: Page) {
    this.sessionItems = page.locator("button.session-item");
    this.messageRows = page.locator(".virtual-row");
    this.scroller = page.locator(".message-list-scroll");
    this.sortButton = page.getByLabel("Toggle sort order");
    this.projectSelect = page.locator("select.project-select");
    this.sessionListHeader = page.locator(".session-list-header");
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.sessionItems.first()).toBeVisible({
      timeout: 5_000,
    });
  }

  async selectSession(index: number = 0) {
    await this.sessionItems.nth(index).click();
    await expect(this.messageRows.first()).toBeVisible({
      timeout: 3_000,
    });
  }

  async selectFirstSession() {
    await this.selectSession(0);
  }

  async selectLastSession() {
    await this.sessionItems.last().click();
    await expect(this.messageRows.first()).toBeVisible({
      timeout: 3_000,
    });
  }

  async toggleSortOrder(times: number = 1) {
    for (let i = 0; i < times; i++) {
      await this.sortButton.click();
    }
  }

  async filterByProject(project: string) {
    await this.projectSelect.selectOption(project);
  }

  async clearProjectFilter() {
    await this.projectSelect.selectOption("");
  }
}
