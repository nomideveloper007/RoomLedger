// scripts/addRoommate.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config(); // loads SUPABASE_URL and SUPABASE_SERVICE_ROLE from .env

// ----------------------------------------------------
// ✏️ EDIT these values as needed
// ----------------------------------------------------
const NEW_USER = {
  email: 'usman@gmail.com',
  password: 'usman123',
  fullName: 'Usman',
  roomId: 'room-register-001', // your room’s UUID (see SEED_ROOM_ID)
  role: 'member' as const, // 'owner' | 'editor' | 'member' | etc.
};
// ----------------------------------------------------

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

async function main() {
  // 1️⃣ Create the Auth user (requires service‑role)
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: NEW_USER.email,
    password: NEW_USER.password,
    email_confirm: true,
    user_metadata: { full_name: NEW_USER.fullName },
  });

  if (authErr) {
    console.error('❌ Auth user creation failed:', authErr.message);
    process.exit(1);
  }

  // 2️⃣ Insert a matching row into your own `room_members` table
  const { error: memberErr } = await supabase
    .from('room_members')
    .insert({
      id: `mem-${Date.now()}`,
      room_id: NEW_USER.roomId,
      profile_id: authUser.user.id,
      name: NEW_USER.fullName,
      email: NEW_USER.email,
      role: NEW_USER.role,
      is_active: true,
    });

  if (memberErr) {
    console.error('❌ room_members insert failed:', memberErr.message);
    process.exit(1);
  }

  console.log('✅ New roommate added successfully!');
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

