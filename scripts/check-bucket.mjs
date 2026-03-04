import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs";

async function check() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.storage.getBucket(bucketName);

    if (error) {
        console.error("BUCKET ERROR:", error.message);
        process.exit(1);
    } else {
        console.log("BUCKET FOUND:", data.name);
        process.exit(0);
    }
}
check();
