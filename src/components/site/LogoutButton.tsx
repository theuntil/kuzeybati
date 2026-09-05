"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutButton({
  label, homeHref,
}: {
  label: string;
  homeHref: string;
}) {
  return (
    <button
      className="btn"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        window.location.href = homeHref;
      }}
    >
      {label}
    </button>
  );
}
