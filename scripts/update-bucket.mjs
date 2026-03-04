import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs";

async function update() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Attempting to update bucket: ${bucketName} to 100MB limit...`);
    const { data, error } = await supabase.storage.updateBucket(bucketName, {
        public: false,
        allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        fileSizeLimit: 52428800 // 50MB
    });

    if (error) {
        console.error("UPDATE FAIL:", error.message);
        process.exit(1);
    } else {
        console.log("BUCKET UPDATED SUCCESSFULLY:", data);
        process.exit(0);
    }
}
update();
