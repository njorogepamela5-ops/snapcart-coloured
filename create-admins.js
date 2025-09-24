// create-admins.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fkxsrwhyvnzyvuywsljp.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZreHNyd2h5dm56eXZ1eXdzbGpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODAwNzQ0OSwiZXhwIjoyMDczNTgzNDQ5fQ.JQYEIble2hIQqNNUqdoaEe9siPe78tNST8K-MnSLgIM";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const admins = [
  "washington.admin@gmail.com",
  "newyork.admin@gmail.com",
  "london.admin@gmail.com",
  "paris.admin@gmail.com",
  "berlin.admin@gmail.com",
];

const DEFAULT_PASSWORD = "Supa123!";

async function createAdmins() {
  for (const email of admins) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });

      if (error) {
        console.error(`❌ Error creating user: ${email}`);
        console.error(error); // 👈 Print the full error object
      } else {
        console.log(`✅ Successfully created user: ${email}`, data);
      }
    } catch (err) {
      console.error(`⚠️ Unexpected error for ${email}:`, err);
    }
  }
}

createAdmins();
