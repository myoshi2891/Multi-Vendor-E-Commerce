/**
 * 属性・許容値の機械キーの形式（plan 069 / ADR-007）。不変（design.md Q7）なので URL 同様に厳格に絞る。
 *
 * `schemas.ts`（定義の作成・更新の検証）と `utils.ts`（ブラウズの `?attr.<key>=` の検証）が共有する。
 * `schemas.ts` は `@prisma/client` を実行時に import するため、client からも読まれる `utils.ts` が
 * そちらを参照しないよう、依存の無いこのモジュールに置く。
 */
export const ATTRIBUTE_MACHINE_KEY_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
