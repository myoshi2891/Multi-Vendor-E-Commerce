// [FLAKE-DIAG OI-8] TEMP — remove after review-details flake root-caused (QA_HANDOFF OI-8)
//
// review-details.test.tsx の CI フレークは「同名テストが 2〜3 回列挙され、本文がすべて空」
// という署名で、Jest のデフォルトレポーターが失敗メッセージを空文字に整形してしまう。
// そのため `gh run view --log` では失敗エラーの正体（message / stack / 非列挙プロパティ）が
// 一切見えない。process レベルの unhandledRejection リスナー(jest.setup.ts)も沈黙しており、
// 真因が unhandledRejection なのか act 由来のスローなのか別物なのか確定できていない。
//
// この一時環境は jest-circus の handleTestEvent をフックし、失敗イベント
// (test_fn_failure / hook_failure / test_done(errors>0) / error) の生エラーオブジェクトを
// util.inspect(showHidden) で CI ログへ surface する。観測専用で、テスト挙動は素の jsdom と
// 同一（jest-environment-jsdom をそのまま継承し、イベント通知に追記するだけ）。
//
// 使い方: 対象テストファイル先頭の docblock を
//   /** @jest-environment ../../../../tests-setup/flake-diag-jsdom-env.cjs */
// に差し替える。root-cause 後に docblock を `jsdom` へ戻し、本ファイルを削除する。

const util = require("node:util");
const JsdomEnvModule = require("jest-environment-jsdom");

// jest 30 の jest-environment-jsdom は TestEnvironment を named/default で公開する。
const BaseJsdomEnvironment =
    JsdomEnvModule.TestEnvironment || JsdomEnvModule.default || JsdomEnvModule;

/** 失敗エラーを CI ログへ全属性ダンプする（レポーターが空にする本文の正体を可視化）。 */
function dumpError(label, testName, value) {
    console.error(
        `[FLAKE-DIAG:circus:${label}] test="${testName ?? "unknown"}"`,
        util.inspect(value, { depth: 8, showHidden: true, getters: true }),
    );
}

class FlakeDiagJsdomEnvironment extends BaseJsdomEnvironment {
    async handleTestEvent(event, state) {
        // 親に handleTestEvent があれば先に委譲（将来の互換のため）。
        if (typeof super.handleTestEvent === "function") {
            await super.handleTestEvent(event, state);
        }

        try {
            switch (event.name) {
                case "test_fn_failure":
                case "hook_failure":
                    dumpError(event.name, event.test?.name, event.error);
                    break;
                case "test_done":
                    if (event.test && Array.isArray(event.test.errors) && event.test.errors.length > 0) {
                        dumpError(
                            `test_done(errors=${event.test.errors.length})`,
                            event.test.name,
                            event.test.errors,
                        );
                    }
                    break;
                case "error":
                    dumpError("error", undefined, event.error);
                    break;
                default:
                    break;
            }
        } catch (listenerError) {
            // 診断リスナー自身が壊れてもテスト実行に影響させない。
            console.error(
                "[FLAKE-DIAG:circus:listener-error]",
                listenerError?.message,
            );
        }
    }
}

module.exports = FlakeDiagJsdomEnvironment;
module.exports.default = FlakeDiagJsdomEnvironment;
module.exports.TestEnvironment = FlakeDiagJsdomEnvironment;
