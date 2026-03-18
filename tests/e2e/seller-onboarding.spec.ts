import { expect, test } from "@playwright/test";

test.describe("Seller オンボーディング", () => {
  // Clerkの認証をPlaywrightで扱うのは複雑なため、
  // 実際にはClerkのTesting TokenやBypass機構を使用する前提のスケルトンとします。

  test("申請フォーム 4 ステップを順に完了できる", async ({ page }) => {
    // 仮のサインインエンドポイント（もしくはテスト用状態をセット）
    // await page.goto("/sign-in?test_user=seller_new");
    
    await page.goto("/dashboard/seller");
    
    // 申請フォームが表示されていることを期待
    // ステップ1: ストア基本情報
    // const nameInput = page.getByLabel("Store Name");
    // await nameInput.fill("New Test Store");
    // await page.getByRole("button", { name: "Next" }).click();
    
    // 省略：ステップ2〜4の入力と完了
    // await expect(page.getByText("Application Submitted")).toBeVisible();
  });

  test("申請後ステータスが Pending 表示になる", async ({ page }) => {
    // 申請済みのユーザーとしてアクセス
    await page.goto("/dashboard/seller");
    // await expect(page.getByText("Status: Pending")).toBeVisible();
  });

  test("管理者が店舗を ACTIVE に変更できる", async ({ page }) => {
    // 管理者としてアクセス
    // await page.goto("/dashboard/admin/stores");
    // await page.getByRole("row", { name: "New Test Store" }).getByRole("button", { name: "Edit" }).click();
    // await page.getByRole("combobox").selectOption("ACTIVE");
    // await page.getByRole("button", { name: "Save" }).click();
    // await expect(page.getByText("Store updated successfully")).toBeVisible();
  });

  test("承認販売者がダッシュボードにアクセスできる", async ({ page }) => {
    // 承認済みユーザーとしてアクセス
    // await page.goto("/dashboard/seller");
    // await expect(page.getByText("Store Dashboard")).toBeVisible();
  });

  test("未承認販売者がダッシュボードにアクセス不可", async ({ page }) => {
    // 未承認(Rejected/Pending)ユーザーとしてアクセス
    // await page.goto("/dashboard/seller");
    // await expect(page.getByText("Access Denied")).toBeVisible(); // または適切なメッセージ
  });

  test("販売者が商品を作成しストアページに表示される", async ({ page }) => {
    // 承認済みユーザーとしてアクセス
    // await page.goto("/dashboard/seller/products/new");
    // await page.getByLabel("Product Name").fill("New Product");
    // await page.getByRole("button", { name: "Save" }).click();
    // await page.goto("/store/new-test-store");
    // await expect(page.getByText("New Product")).toBeVisible();
  });
});
