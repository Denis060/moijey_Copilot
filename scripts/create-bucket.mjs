import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs";

async function create() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Attempting to create bucket: ${bucketName}...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: false,
        allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        fileSizeLimit: 104857600 // 100MB
    });

    if (error) {
        console.error("CREATE FAIL:", error.message);
        process.exit(1);
    } else {
        console.log("BUCKET CREATED SUCCESSFULLY:", data.name);
        process.exit(0);
    }
}
create();
