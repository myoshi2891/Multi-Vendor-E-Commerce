/** 既存の Cloudinary upload preset。未設定時はこれを使い、従来の挙動を保つ。 */
export const DEFAULT_CLOUDINARY_UPLOAD_PRESET = "fefik77l";

/**
 * アップロードウィジェットに渡す upload preset を返す。
 * 検証時だけテスト用 preset へ切り替えられるよう env で上書きする。
 * `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、参照は直書きのままにすること。
 */
export function getCloudinaryUploadPreset(): string {
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
    return preset ? preset : DEFAULT_CLOUDINARY_UPLOAD_PRESET;
}
