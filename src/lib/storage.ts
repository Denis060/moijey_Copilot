import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const storageService = {
    /**
     * Uploads a file to Supabase Storage.
     */
    async uploadFile(
        file: Buffer | File,
        path: string,
        contentType: string,
        bucket = process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs"
    ) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error("Supabase Storage Error:", error);
            throw error;
        }

        return {
            path: data.path,
            bucket,
        };
    },

    /**
     * Generates a signed URL for a file.
     */
    async getSignedUrl(path: string, bucket = process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs", expires = 3600) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expires);

        if (error) {
            console.error("Supabase Signed URL Error:", error);
            throw error;
        }

        return data.signedUrl;
    },

    /**
     * Deletes a file from Supabase Storage.
     */
    async deleteFile(path: string, bucket = process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs") {
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) {
            console.error("Supabase Delete Error:", error);
            throw error;
        }
    },
};
