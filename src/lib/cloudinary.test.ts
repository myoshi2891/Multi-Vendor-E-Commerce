import {
    DEFAULT_CLOUDINARY_UPLOAD_PRESET,
    getCloudinaryUploadPreset,
} from "@/lib/cloudinary";

describe("getCloudinaryUploadPreset", () => {
    const original = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
            return;
        }
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = original;
    });

    it("未設定なら既存の preset を返す", () => {
        // Arrange
        delete process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        // Act / Assert
        expect(getCloudinaryUploadPreset()).toBe("fefik77l");
        expect(DEFAULT_CLOUDINARY_UPLOAD_PRESET).toBe("fefik77l");
    });

    it("指定された preset を前後の空白を除いて返す", () => {
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = "  test-preset  ";

        expect(getCloudinaryUploadPreset()).toBe("test-preset");
    });

    it("空白だけなら既存の preset へ戻す", () => {
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET = "   ";

        expect(getCloudinaryUploadPreset()).toBe("fefik77l");
    });
});
